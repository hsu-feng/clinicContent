import { NoImageError, aiErrorMessage, generateImageWithAi } from "@/lib/ai-providers";
import { AI_PROVIDERS } from "@/lib/ai-settings";

// 模型偶爾只回一句「好的，這是…」卻沒附圖，重試通常就會拿到
const RETRY_DELAY_MS = 1500;

export async function POST(request: Request) {
  const { title, specialty, provider, apiKey } = await request.json();

  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "請先填入診療項目標題，才能生成圖片" }, { status: 400 });
  }
  if (!AI_PROVIDERS.some((p) => p.id === provider) || !apiKey) {
    return Response.json({ error: "請先在「AI 設定」選擇 AI 並填入 API key" }, { status: 400 });
  }
  if (provider === "anthropic") {
    return Response.json(
      { error: "Claude 無法生成圖片，請在「AI 設定」改用 Gemini 或 OpenAI" },
      { status: 400 },
    );
  }

  const subject = typeof specialty === "string" ? specialty.trim() : "";
  // 先用項目標題試兩次；還是拿不到圖，才換成不含標題的通用提示詞
  const attempts = [
    imagePrompt(title.trim(), subject),
    imagePrompt(title.trim(), subject),
    fallbackPrompt(subject),
    fallbackPrompt(subject),
  ];
  let lastError = "AI 沒有產出圖片";

  for (let i = 0; i < attempts.length; i++) {
    try {
      const image = await generateImageWithAi({ provider, apiKey }, attempts[i]);
      return Response.json({ image });
    } catch (err) {
      // 只印狀態碼和訊息，避免把 API key 等請求內容寫進記錄
      const status = (err as { status?: number }).status;
      console.error(`[generate-image] ${provider} 第 ${i + 1} 次失敗`, status, (err as Error).message);
      // 額度、金鑰那類錯誤重試也沒用，直接回報
      if (!(err instanceof NoImageError)) {
        return Response.json({ error: aiErrorMessage(status) }, { status: 502 });
      }
      lastError = err.message;
      if (i < attempts.length - 1) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }
  return Response.json(
    { error: `${lastError}（已自動重試 ${attempts.length} 次，可按「重新生圖」再試）` },
    { status: 502 },
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 開頭直接要圖，可以減少模型只回一句話就結束的情況；
// 禁文字是因為繪圖模型畫中文幾乎必錯，禁真人臉是避免醫療情境的肖像疑慮
function imagePrompt(title: string, specialty: string) {
  return `請直接產生一張圖片：台灣的${specialty}診所官網用的「${title}」衛教示意圖。
風格：乾淨明亮的醫療插畫，淺色背景，橫式構圖。
限制：畫面中不要有任何文字、字母或浮水印，不要出現可辨識的真人臉孔。`;
}

// 標題被擋下或反覆失敗時的退路：不提具體療程，只畫診間氛圍
function fallbackPrompt(specialty: string) {
  return `請直接產生一張圖片：台灣的${specialty}診所明亮整潔的診間示意圖。
風格：乾淨的醫療插畫，淺色背景，橫式構圖。
限制：畫面中不要有任何文字、字母或浮水印，不要出現可辨識的真人臉孔。`;
}
