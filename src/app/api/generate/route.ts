import { aiErrorMessage, generateWithAi } from "@/lib/ai-providers";
import { AI_PROVIDERS } from "@/lib/ai-settings";
import {
  EDUCATION_LIMITS,
  SECTIONS,
  SERVICE_LIMITS,
  newEducationItem,
  newServiceItem,
  type EducationItem,
  type SectionKey,
  type ServiceItem,
} from "@/lib/clinics";

export async function POST(request: Request) {
  const { name, address, section, specialty, provider, model, apiKey } = await request.json();

  if (!name || !SECTIONS.some((s) => s.key === section)) {
    return Response.json({ error: "缺少診所名稱或區塊參數" }, { status: 400 });
  }
  if (!AI_PROVIDERS.some((p) => p.id === provider) || !model || !apiKey) {
    return Response.json({ error: "請先在「AI 設定」選擇 AI 並填入 API key" }, { status: 400 });
  }

  // 管理者指定的科別；留空代表交給 AI 自己判斷
  const assigned = typeof specialty === "string" ? specialty.trim() : "";
  const prompt = buildPrompt(section as SectionKey, name, address, assigned);

  try {
    // 診所資訊要真的打開網站讀內容，不是只看搜尋結果摘要
    const result = await generateWithAi({ provider, model, apiKey }, prompt, {
      readUrls: section === "info" || section === "notices",
    });

    if (section === "services") {
      const parsed = parseServices(result.text);
      if (!parsed) return formatError(result.text);
      return Response.json({
        text: "",
        sources: result.sources,
        specialty: parsed.specialty || assigned,
        items: parsed.items,
      });
    }

    if (section === "education") {
      const parsed = parseEducation(result.text);
      if (!parsed) return formatError(result.text);
      return Response.json({
        text: "",
        sources: result.sources,
        specialty: parsed.specialty || assigned,
        cards: parsed.cards,
      });
    }

    return Response.json(result);
  } catch (err) {
    // 只印狀態碼和訊息，避免把 API key 等請求內容寫進記錄
    const status = (err as { status?: number }).status;
    console.error(`[generate] ${provider}/${model} 失敗`, status, (err as Error).message);
    return Response.json({ error: aiErrorMessage(status) }, { status: 502 });
  }
}

function formatError(text: string) {
  console.error("[generate] JSON 解析失敗", text.slice(0, 200));
  return Response.json({ error: "AI 回傳的格式不正確，請重新生成" }, { status: 502 });
}

function buildPrompt(section: SectionKey, name: string, address: string, specialty: string) {
  switch (section) {
    case "services":
      return servicesPrompt(name, address, specialty);
    case "education":
      return educationPrompt(name, address, specialty);
    case "info":
      return infoPrompt(name, address);
    case "notices":
      return noticesPrompt(name, address);
  }
}

// 診所資訊：只輸出診所簡介
function infoPrompt(name: string, address: string) {
  return `請用「${name}」（地址：${address}）上網搜尋這間診所的官方網站、社群粉專或相關介紹頁面，
打開這些網頁讀取實際內容後再整理，不要只依賴搜尋結果的摘要。

請只輸出這間診所的簡介，使用繁體中文，盡可能詳細：

・診所定位與主要照護範圍
・主要科別與專長
・特色服務或設備
・適合的就診對象

規則：
- 主項目每點一行，開頭用「・」；次項目縮排兩個空白後用「－」開頭。
- 不要使用 Markdown 的 #、*、- 等符號。
- 上面列的項目只是提示涵蓋範圍，讀到什麼就寫什麼，不必照抄標題。
- 只寫實際讀到的資訊，不要推測或補上「一般診所通常有」的內容。
- 不要寫地址、電話、門診時間、交通方式、社群連結，這些另有段落處理。`;
}

// 注意事項：病患就診前要知道的事，門診時間也歸在這裡
function noticesPrompt(name: string, address: string) {
  return `請用「${name}」（地址：${address}）上網搜尋這間診所的官方網站、掛號系統頁面或社群粉專，
打開這些網頁讀取實際內容後再整理，不要只依賴搜尋結果的摘要。

請只輸出下列四個段落，使用繁體中文，每個段落都盡可能詳細：

【門診時間】
・各時段的門診時間（平日與假日，早診、午診、晚診分開寫）
・醫師分診，哪位醫師負責哪個診次
・休診、國定假日或醫師調班的公告方式

【掛號方式】
・可用的掛號管道（現場、電話、網路、LINE 等，有網址或 ID 請寫出來）
・預約規則，可預約幾天內
・報到截止時間與過號的處理方式

【看診規則】
【需攜帶證件】

規則：
- 主項目每點一行，開頭用「・」；次項目縮排兩個空白後用「－」開頭。
- 不要使用 Markdown 的 #、*、- 等符號。
- 上面列的子項目只是提示涵蓋範圍，讀到什麼就寫什麼，不必照抄標題。
- 單一點查不到就略過該點，整個段落都查不到才寫「查無資料」。
- 絕對不要推測或補上「一般診所通常有」的內容。
- 不要輸出上面四個段落以外的內容。`;
}

function servicesPrompt(name: string, address: string, specialty: string) {
  const { count, titleMin, titleMax, bodyMin, bodyMax } = SERVICE_LIMITS;
  return `請上網搜尋「${name}」（地址：${address}）。
${specialtyLine(specialty)}
請依科別產出 ${count} 筆適合放在診所官網的診療項目介紹。
規則：
- 使用繁體中文。
- title 為具體的診療項目名稱，${titleMin}–${titleMax} 字。
- body ${bodyMin}–${bodyMax} 字，說明這個項目在做什麼、適合哪些症狀、療程特點。
- 只寫這間診所真的有提供、或該科別常見的項目；不要誇大療效或保證效果。
- 只輸出 JSON，不要加說明文字或 Markdown 程式碼框：
{"specialty":"科別","items":[{"title":"標題","body":"內容"}]}`;
}

function educationPrompt(name: string, address: string, specialty: string) {
  const { count, labelMin, labelMax, titleMin, titleMax, bodyMin, bodyMax } = EDUCATION_LIMITS;
  return `請上網搜尋「${name}」（地址：${address}）。
${specialtyLine(specialty)}
請依科別產出 ${count} 筆適合用 LINE 卡片訊息推播給病患的衛教資訊。
規則：
- 使用繁體中文。
- label 是卡片左上角的標籤，${labelMin}–${labelMax} 字的短詞，例如「季節提醒」「用藥安全」。
- title 是卡片標題，${titleMin}–${titleMax} 字。
- body 是卡片說明文字，${bodyMin}–${bodyMax} 字，寫給一般民眾看。
- 內容要正確保守，不要提供診斷建議或療效保證。
- 只輸出 JSON，不要加說明文字或 Markdown 程式碼框：
{"specialty":"科別","items":[{"label":"標籤","title":"標題","body":"說明"}]}`;
}

function specialtyLine(specialty: string) {
  return specialty ? `這間診所的主要科別是「${specialty}」。` : "先判斷這間診所的主要科別。";
}

// AI 常把 JSON 包在程式碼框裡或前後加說明，所以只取第一個 { 到最後一個 }
function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as { specialty?: unknown; items?: unknown };
  } catch {
    return null;
  }
}

function rowsOf(parsed: { items?: unknown } | null) {
  return parsed && Array.isArray(parsed.items)
    ? parsed.items.map((raw) => raw as Record<string, unknown>)
    : null;
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseServices(text: string) {
  const parsed = parseJson(text);
  const rows = rowsOf(parsed);
  if (!rows) {
    return null;
  }

  const items: ServiceItem[] = rows
    .filter((row) => str(row.title) && str(row.body))
    .slice(0, SERVICE_LIMITS.count)
    .map((row) => ({ ...newServiceItem(), title: str(row.title), body: str(row.body) }));

  return items.length > 0 ? { specialty: str(parsed?.specialty), items } : null;
}

function parseEducation(text: string) {
  const parsed = parseJson(text);
  const rows = rowsOf(parsed);
  if (!rows) {
    return null;
  }

  const cards: EducationItem[] = rows
    .filter((row) => str(row.title) && str(row.body))
    .slice(0, EDUCATION_LIMITS.count)
    .map((row) => ({
      ...newEducationItem(),
      label: str(row.label),
      title: str(row.title),
      body: str(row.body),
    }));

  return cards.length > 0 ? { specialty: str(parsed?.specialty), cards } : null;
}
