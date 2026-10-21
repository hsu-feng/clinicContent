export type AiProvider = "gemini" | "openai" | "anthropic";

export type AiSettings = {
  provider: AiProvider;
  model: string;
  apiKey: string;
};

export const AI_PROVIDERS: { id: AiProvider; label: string; defaultModel: string; keyHint: string }[] = [
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-flash-latest", keyHint: "在 Google AI Studio 申請，AIza 開頭" },
  { id: "openai", label: "OpenAI（ChatGPT）", defaultModel: "gpt-5.5", keyHint: "在 OpenAI Platform 申請，sk- 開頭" },
  { id: "anthropic", label: "Anthropic（Claude）", defaultModel: "claude-opus-5-5", keyHint: "在 Claude Console 申請，sk-ant- 開頭" },
];

export const DEFAULT_AI_SETTINGS: AiSettings = { provider: "gemini", model: "gemini-flash-latest", apiKey: "" };

export function providerLabel(provider: AiProvider) {
  return AI_PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
}

function storageKey(account: string) {
  return `aiSettings:${account}`;
}

// 暫時存在瀏覽器，每個帳號各一份；之後有資料庫時改成加密存在後端
export function loadAiSettings(account: string): AiSettings {
  try {
    const raw = localStorage.getItem(storageKey(account));
    return raw ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(account: string, settings: AiSettings) {
  try {
    localStorage.setItem(storageKey(account), JSON.stringify(settings));
  } catch {
    // 瀏覽器停用儲存空間時，設定只在這次開啟期間有效
  }
}