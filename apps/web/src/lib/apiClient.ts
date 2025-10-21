export interface ApiClientOptions {
  token?: string;
}

const DEFAULT_BASE_URL = "http://localhost:4000";

const normalizeBaseUrl = (raw?: string): string => {
  const fallback = DEFAULT_BASE_URL;
  if (!raw) {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  if (/^\/\//.test(trimmed)) {
    if (typeof window !== "undefined") {
      return `${window.location.protocol}${trimmed}`.replace(/\/+$/, "");
    }
    return `http:${trimmed}`.replace(/\/+$/, "");
  }

  if (/^:/.test(trimmed)) {
    const port = trimmed.replace(/^:+/, "");
    const protocol =
      typeof window !== "undefined" && window.location.protocol ? window.location.protocol : "http:";
    const host =
      typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
    return `${protocol}//${host}:${port}`.replace(/\/+$/, "");
  }

  if (/^[a-zA-Z0-9.-]+(:\d+)?$/.test(trimmed)) {
    return `http://${trimmed}`.replace(/\/+$/, "");
  }

  return trimmed.replace(/\/+$/, "") || fallback;
};

export class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(options?: ApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
    this.token = options?.token;
  }

  setToken(token?: string | null) {
    this.token = token ?? undefined;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.withAuth()
    });
    if (!response.ok) {
      throw new Error(await this.buildErrorMessage(response));
    }
    return (await response.json()) as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.withAuth()
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await this.buildErrorMessage(response));
    }
    return (await response.json()) as T;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...this.withAuth()
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await this.buildErrorMessage(response));
    }
    return (await response.json()) as T;
  }

  private withAuth() {
    return this.token
      ? {
          Authorization: `Bearer ${this.token}`
        }
      : {};
  }

  private async buildErrorMessage(response: Response) {
    let fallback = `API 요청 실패: ${response.status}`;
    try {
      const data = await response.clone().json();
      const message = Array.isArray(data?.message)
        ? data.message.join("\n")
        : typeof data?.message === "string"
        ? data.message
        : null;
      if (message) {
        return message;
      }
      if (typeof data?.error === "string") {
        return `${data.error}${data?.statusCode ? ` (${data.statusCode})` : ""}`;
      }
      return fallback;
    } catch {
      try {
        const text = await response.text();
        return text ? `${fallback} ${text}` : fallback;
      } catch {
        return fallback;
      }
    }
  }
}

export const apiClient = new ApiClient();
