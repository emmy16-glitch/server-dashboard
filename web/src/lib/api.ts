// API client: tries server /api/* with stored token, falls back to local mock.
// Token is pasted once in the UI (Settings) and kept in localStorage.
export function getToken(): string {
  return localStorage.getItem("sd-token") || "";
}
export function setToken(t: string) {
  if (t) localStorage.setItem("sd-token", t);
  else localStorage.removeItem("sd-token");
}

async function req<T>(path: string, init?: RequestInit): Promise<T | null> {
  const t = getToken();
  if (!t) return null;
  try {
    const r = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(init?.headers || {}) },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  get: req,
  async login(token: string): Promise<boolean> {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) return false;
      setToken(token);
      return true;
    } catch {
      return false;
    }
  },
};
