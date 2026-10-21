"use client";

import { useEffect, useState } from "react";
import { AI_PROVIDERS, type AiProvider, type AiSettings } from "@/lib/ai-settings";

type Props = {
  initial: AiSettings;
  notice: string | null;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
};

export default function AiSettingsModal({ initial, notice, onSave, onClose }: Props) {
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [showKey, setShowKey] = useState(false);
  const info = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0];

  // 按 Esc 關閉
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleProviderChange(next: AiProvider) {
    setProvider(next);
    setModel(AI_PROVIDERS.find((p) => p.id === next)?.defaultModel ?? "");
    // 不同廠商的 key 不能共用，切回原本的廠商才還原
    setApiKey(next === initial.provider ? initial.apiKey : "");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ provider, model: model.trim(), apiKey: apiKey.trim() });
        }}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 text-zinc-900 shadow-xl"
      >
        <h2 id="ai-settings-title" className="text-lg font-semibold">AI 設定</h2>

        {notice && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">使用的 AI</legend>
          {AI_PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-2 ${
                provider === p.id ? "border-blue-600 bg-blue-50" : "border-zinc-300"
              }`}
            >
              <input
                type="radio"
                name="provider"
                checked={provider === p.id}
                onChange={() => handleProviderChange(p.id)}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">模型名稱</span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
          <span className="block text-xs text-zinc-500">
            預設為 {info.defaultModel}，可改成同廠商其他支援上網搜尋的模型
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">API key</span>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              autoComplete="off"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded border border-zinc-300 px-3 text-sm hover:bg-zinc-100"
            >
              {showKey ? "隱藏" : "顯示"}
            </button>
          </div>
          <span className="block text-xs text-zinc-500">{info.keyHint}。只會存在這台電腦的瀏覽器裡。</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100"
          >
            取消
          </button>
          <button type="submit" className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}