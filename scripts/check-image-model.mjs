// 拋棄式診斷腳本：比較不同設定下 Gemini 會不會真的回圖片。
// 用法（PowerShell）：$env:GEMINI_API_KEY="你的key"; node scripts/check-image-model.mjs
// 確認完就可以把這個檔案刪掉。
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("請先設定環境變數 GEMINI_API_KEY");
  process.exit(1);
}

const prompt = `為台灣的牙科診所官網繪製一張「牙齒美白」的衛教示意圖。
風格：乾淨明亮的醫療插畫，淺色背景，橫式構圖。
限制：畫面中不要有任何文字、字母或浮水印，不要出現可辨識的真人臉孔。`;

const cases = [
  { label: "flash-image / 不給 config", model: "gemini-2.5-flash-image", config: undefined },
  { label: "flash-image / TEXT+IMAGE", model: "gemini-2.5-flash-image", config: { responseModalities: ["TEXT", "IMAGE"] } },
  { label: "flash-image / 只給 IMAGE", model: "gemini-2.5-flash-image", config: { responseModalities: ["IMAGE"] } },
  { label: "flash-image-preview / TEXT+IMAGE", model: "gemini-2.5-flash-image-preview", config: { responseModalities: ["TEXT", "IMAGE"] } },
];

const ai = new GoogleGenAI({ apiKey });

for (const { label, model, config } of cases) {
  try {
    const response = await ai.models.generateContent({ model, contents: prompt, ...(config ? { config } : {}) });
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const image = parts.find((part) => part.inlineData?.data);
    const text = parts.find((part) => part.text?.trim())?.text?.trim();

    if (image) {
      const kb = Math.round((image.inlineData.data.length * 3) / 4 / 1024);
      console.log(`✅ ${label} → 有圖片（${image.inlineData.mimeType}, 約 ${kb} KB）`);
    } else {
      console.log(`❌ ${label} → 沒有圖片 | finishReason=${candidate?.finishReason ?? "(無)"} | blockReason=${response.promptFeedback?.blockReason ?? "(無)"}`);
      if (text) console.log(`   模型回的文字：${text.slice(0, 120)}`);
    }
  } catch (err) {
    console.log(`💥 ${label} → 錯誤 status=${err.status ?? "(無)"} ${err.message?.slice(0, 160)}`);
  }
}
