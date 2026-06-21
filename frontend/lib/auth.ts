const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "engcalc_token";
const USER_KEY = "engcalc_user";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/v1/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : "";
    if (detail === "Username already taken") {
      throw new Error("Этот логин уже занят");
    }
    if (detail === "Email already registered") {
      throw new Error("Этот email уже зарегистрирован");
    }
    if (detail === "Password must be at least 6 characters") {
      throw new Error("Пароль должен быть не короче 6 символов");
    }
    throw new Error(detail || "Ошибка регистрации");
  }
  return res.json();
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : "";
    if (detail === "Invalid credentials") {
      throw new Error(
        "Неверный логин или пароль. Аккаунт с другого ПК здесь не действует — зарегистрируйтесь на этой машине."
      );
    }
    throw new Error(detail || "Ошибка входа");
  }
  return res.json();
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me/`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      clearAuth();
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}
