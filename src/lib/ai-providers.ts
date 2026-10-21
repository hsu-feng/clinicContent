import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, AiSettings } from "@/lib/ai-settings";
import type { SectionResult, Source } from "@/lib/clinics";

// 只在後端使用：依使用者選的 AI 呼叫對應的服務，並開啟上網搜尋。
// readUrls 會額外開啟讀取網頁的工具，讓模型真的打開網站，而不是只看搜尋結果摘要
export async function generateWithAi(
  settings: AiSettings,
  prompt: string,
  options: { readUrls?: boolean } = {},
): Promise<SectionResult> {
  const readUrls = options.readUrls ?? false;
  switch (settings.provider) {
    case "gemini":
      return generateWithGemini(settings, prompt, readUrls);
    case "openai":
      return generateWithOpenAI(settings, prompt);
    case "anthropic":
      return generateWithClaude(settings, prompt, readUrls);
  }
}

async function generateWithGemini(
  { model, apiKey }: AiSettings,
  prompt: string,
  readUrls: boolean,
): Promise<SectionResult> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: readUrls ? [{ googleSearch: {} }, { urlContext: {} }] : [{ googleSearch: {} }] },
  });

  const candidate = response.candidates?.[0];
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks.flatMap((chunk) =>
    chunk.web?.uri ? [{ title: chunk.web.title ?? chunk.web.uri, uri: chunk.web.uri }] : [],
  );

  // 實際讀過的網頁不一定出現在搜尋來源裡，補進來
  for (const meta of candidate?.urlContextMetadata?.urlMetadata ?? []) {
    if (meta.retrievedUrl) {
      sources.push({ title: meta.retrievedUrl, uri: meta.retrievedUrl });
    }
  }
  return { text: response.text ?? "", sources: uniqueSources(sources) };
}

async function generateWithOpenAI({ model, apiKey }: AiSettings, prompt: string): Promise<SectionResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    input: prompt,
    tools: [{ type: "web_search" }],
  });

  const sources: Source[] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type === "url_citation") {
          sources.push({ title: annotation.title, uri: annotation.url });
        }
      }
    }
  }
  return { text: response.output_text, sources: uniqueSources(sources) };
}

// 支援拒答時自動改由其他模型回答（server-side fallback）的 Claude 模型
const CLAUDE_FALLBACK_MODELS = ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"];

async function generateWithClaude(
  { model, apiKey }: AiSettings,
  prompt: string,
  readUrls: boolean,
): Promise<SectionResult> {
  const client = new Anthropic({ apiKey });
  const fallback = CLAUDE_FALLBACK_MODELS.includes(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  ];
  if (readUrls) {
    tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 });
  }

  let response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    tools,
    messages,
    ...fallback,
  });

  // 搜尋太久時 Claude 會暫停（pause_turn），把暫停的回覆送回去讓它接著做
  for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
    messages.push({ role: "assistant", content: response.content });
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      tools,
      messages,
      ...fallback,
    });
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude 拒絕回答這個請求");
  }

  let text = "";
  const sources: Source[] = [];
  for (const block of response.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        sources.push({ title: result.title, uri: result.url });
      }
    } else if (block.type === "web_fetch_tool_result") {
      // 實際讀過的網頁
      const fetched = block.content;
      if (fetched.type === "web_fetch_result") {
        sources.push({ title: fetched.content.title ?? fetched.url, uri: fetched.url });
      }
    }
  }
  return { text: text.trim(), sources: uniqueSources(sources) };
}

function uniqueSources(sources: Source[]) {
  return sources.filter((s, i) => sources.findIndex((o) => o.uri === s.uri) === i);
}
// 請求本身成功、但 AI 沒給圖（通常是內容被擋下）。和額度、金鑰那類錯誤要分開處理
export class NoImageError extends Error {}

// 繪圖模型和使用者在「AI 設定」選的文字模型是不同的 model，所以寫死在這裡
const IMAGE_MODELS: Partial<Record<AiProvider, string>> = {
  gemini: "gemini-2.5-flash-image",
  openai: "gpt-image-1",
};

// 只在後端使用：生成一張圖片，回傳可直接放進 img src 的 data URL
export async function generateImageWithAi(
  settings: Pick<AiSettings, "provider" | "apiKey">,
  prompt: string,
): Promise<string> {
  const model = IMAGE_MODELS[settings.provider];
  if (!model) {
    throw new Error("這個 AI 沒有繪圖功能");
  }
  return settings.provider === "gemini"
    ? generateImageWithGemini(settings.apiKey, model, prompt)
    : generateImageWithOpenAI(settings.apiKey, model, prompt);
}

async function generateImageWithGemini(apiKey: string, model: string, prompt: string) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    // 文件寫明這個欄位是「回應要包含的所有modality」，只給 IMAGE 會讓圖文交錯的模型回 NO_IMAGE
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) {
      return `data:${part.inlineData?.mimeType ?? "image/png"};base64,${data}`;
    }
  }
  throw new NoImageError(geminiNoImageReason(response));
}

// 內容被擋下來時，Gemini 會用這些結束原因回 200 但不給圖
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_PROHIBITED_CONTENT",
  "BLOCKLIST",
  "RECITATION",
  "IMAGE_RECITATION",
  "SPII",
]);

// 回了 200 卻沒有圖片，把模型給的原因翻成管理者看得懂的訊息
function geminiNoImageReason(response: GenerateContentResponse) {
  const candidate = response.candidates?.[0];
  const finishReason = String(candidate?.finishReason ?? "");
  if (response.promptFeedback?.blockReason || BLOCKED_FINISH_REASONS.has(finishReason)) {
    return "這個標題被 AI 的安全機制擋下，沒有產出圖片";
  }

  const text = candidate?.content?.parts?.find((part) => part.text?.trim())?.text?.trim();
  if (text) {
    return `AI 沒有產出圖片，只回了文字：${text.slice(0, 60)}`;
  }
  return finishReason ? `AI 沒有產出圖片（${finishReason}）` : "AI 沒有產出圖片";
}

async function generateImageWithOpenAI(apiKey: string, model: string, prompt: string) {
  const client = new OpenAI({ apiKey });
  // webp 是為了把 base64 的體積壓下來
  const response = await client.images.generate({
    model,
    prompt,
    n: 1,
    size: "1536x1024",
    quality: "low",
    output_format: "webp",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new NoImageError("AI 沒有產出圖片");
  }
  return `data:image/webp;base64,${b64}`;
}

// 兩支 API 路由共用：把 AI 服務回傳的狀態碼轉成看得懂的訊息
export function aiErrorMessage(status: number | undefined) {
  switch (status) {
    case 400:
      return "AI 拒絕了請求，可能是模型不支援上網搜尋，請檢查模型名稱";
    case 401:
    case 403:
      return "API key 無效或沒有權限，請到「AI 設定」檢查";
    case 404:
      return "找不到這個模型，請到「AI 設定」檢查模型名稱";
    case 429:
      return "AI 額度已用完或呼叫太頻繁，請稍後再試";
    default:
      return "AI 生成失敗，請稍後再試";
  }
}
