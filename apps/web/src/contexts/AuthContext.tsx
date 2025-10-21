import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { useAuthToken } from "@/hooks/useAuthToken";

interface SiteSummary {
  id: string;
  code: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  site: SiteSummary | null;
  status: string;
  lastLoginAt: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, refreshToken, setTokens, clearTokens } = useAuthToken();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === undefined || refreshToken === undefined) {
      return;
    }

    let cancelled = false;

    const fetchProfile = async () => {
      const requireLogin = () => {
        if (cancelled) return;
        clearTokens();
        setUser(null);
        setLoading(false);
        setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      };

      if (!token) {
        if (!refreshToken) {
          requireLogin();
          return;
        }

        setLoading(true);
        try {
          const response = await apiClient.post<AuthTokensResponse>("/auth/refresh", { refreshToken });
          if (cancelled) return;
          setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
          setError(null);
        } catch {
          if (!cancelled) {
            requireLogin();
          }
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const profile = await apiClient.get<AuthUser>("/auth/me");
        if (cancelled) return;
        setUser(profile);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message.includes("401") && refreshToken) {
          try {
            const response = await apiClient.post<AuthTokensResponse>("/auth/refresh", { refreshToken });
            if (cancelled) return;
            setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
            setError(null);
          } catch {
            requireLogin();
          }
        } else {
          setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    };

    void fetchProfile();

    return () => {
      cancelled = true;
    };
  }, [token, refreshToken, setTokens, clearTokens]);

  const login = useCallback(
    (accessToken: string, newRefreshToken: string) => {
      setTokens({ accessToken, refreshToken: newRefreshToken });
    },
    [setTokens]
  );

  const logout = useCallback(() => {
    const currentRefresh = typeof refreshToken === "string" ? refreshToken : null;
    if (currentRefresh) {
      void apiClient
        .post("/auth/logout", { refreshToken: currentRefresh })
        .catch(() => undefined);
    }
    setUser(null);
    setError(null);
    clearTokens();
  }, [refreshToken, clearTokens]);

  const refresh = useCallback(async () => {
    if (typeof token !== "string") return;
    setLoading(true);
    setError(null);
    try {
      const profile = await apiClient.get<AuthUser>("/auth/me");
      setUser(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "사용자 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      token: typeof token === "string" ? token : null,
      loading,
      error,
      refresh,
      login,
      logout
    }),
    [user, token, loading, error, refresh, login, logout]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
};
