import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

const ACCESS_TOKEN_KEY = "ikjinAccessToken";
const REFRESH_TOKEN_KEY = "ikjinRefreshToken";

type TokenState = string | null | undefined;

export function useAuthToken() {
  const [token, setTokenState] = useState<TokenState>(undefined);
  const [refreshToken, setRefreshTokenState] = useState<TokenState>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);

    if (storedAccess) {
      setTokenState(storedAccess);
      apiClient.setToken(storedAccess);
    } else {
      setTokenState(null);
    }

    if (storedRefresh) {
      setRefreshTokenState(storedRefresh);
    } else {
      setRefreshTokenState(null);
    }

    const handler = (event: StorageEvent) => {
      if (event.key === ACCESS_TOKEN_KEY) {
        const value = event.newValue;
        setTokenState(value ?? null);
        apiClient.setToken(value ?? "");
      }
      if (event.key === REFRESH_TOKEN_KEY) {
        const value = event.newValue;
        setRefreshTokenState(value ?? null);
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setTokens = useCallback((tokens: { accessToken?: string | null; refreshToken?: string | null }) => {
    if (typeof window === "undefined") return;

    if (tokens.accessToken !== undefined) {
      if (tokens.accessToken) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        setTokenState(tokens.accessToken);
        apiClient.setToken(tokens.accessToken);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
        setTokenState(null);
        apiClient.setToken("");
      }
    }

    if (tokens.refreshToken !== undefined) {
      if (tokens.refreshToken) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        setRefreshTokenState(tokens.refreshToken);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        setRefreshTokenState(null);
      }
    }
  }, []);

  const clearTokens = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    setTokenState(null);
    setRefreshTokenState(null);
    apiClient.setToken("");
  }, []);

  return { token, refreshToken, setTokens, clearTokens };
}
