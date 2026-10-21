// 後端網址。沒設定就代表後端還沒好，資料層會走假資料分支
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const useMock = BASE === "";

const TOKEN_KEY = "authToken";

export function saveToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 瀏覽器停用儲存空間時，登入狀態只在這次開啟期間有效
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // 讀不到就當作已經清掉
  }
}

function authHeader(): Record<string, string> {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// 所有後端呼叫共用：統一帶 token，統一把 { error } 轉成 Error
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "操作失敗，請稍後再試");
  }
  return data as T;
}

// 上傳檔案用：不能自己設 Content-Type，要讓瀏覽器補上 multipart 邊界
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: authHeader(), body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "上傳失敗，請稍後再試");
  }
  return data as T;
}

export type LoginResult = { token: string; account: string };

export async function login(account: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ account, password }),
  });
  saveToken(result.token);
  return result;
}

export async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    // 後端叫不動也要讓使用者登出
    clearToken();
  }
}
