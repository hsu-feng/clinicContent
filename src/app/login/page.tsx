"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, useMock } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!account || !password) {
      setError("請輸入帳號和密碼");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // 沒設定後端時維持原本的假登入
      if (!useMock) {
        await login(account, password);
      }
      sessionStorage.setItem("loggedIn", "true");
      sessionStorage.setItem("account", account);
      router.push("/clinics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請稍後再試");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-4 text-zinc-900">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 className="text-center text-2xl font-semibold">登入</h1>

        <label className="block space-y-1">
          <span className="text-sm">帳號</span>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm">密碼</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {busy ? "登入中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
