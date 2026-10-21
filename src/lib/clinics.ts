import { apiFetch, apiUpload, useMock } from "@/lib/api";
import type { AiSettings } from "@/lib/ai-settings";

export type Clinic = {
  id: string;
  name: string;
  address: string;
};

export type SectionKey = "info" | "notices" | "services" | "education";

export type Source = { title: string; uri: string };

// 診療項目的單筆內容
export type ServiceItem = {
  id: string;
  title: string;
  body: string;
  image: string | null; // data URL；null 代表還沒生圖
  imageError: string | null;
};

// 標題與內容的字數範圍，前後端共用
export const SERVICE_LIMITS = {
  count: 3,
  titleMin: 4,
  titleMax: 10,
  bodyMin: 100,
  bodyMax: 300,
};

// 衛教卡片的標籤色票，沿用 iCare 衛教版型編輯器的六個固定顏色
export const LABEL_COLORS: { bg: string; text: string; border?: string }[] = [
  { bg: "#767676", text: "#ffffff" },
  { bg: "#ffffff", text: "#767676", border: "#767676" },
  { bg: "#d93c37", text: "#ffffff" },
  { bg: "#c65204", text: "#ffffff" },
  { bg: "#06c755", text: "#ffffff" },
  { bg: "#0c6efd", text: "#ffffff" },
];

// LINE 卡片訊息的動作：網址說明 + 點擊導向網址
export type EducationAction = {
  enabled: boolean;
  label: string;
  uri: string;
};

// 衛教資訊的單張卡片
export type EducationItem = {
  id: string;
  label: string;
  labelColorIndex: number;
  image: string | null;
  imageError: string | null;
  title: string;
  body: string;
  // 固定兩組，沒勾選就不顯示
  actions: EducationAction[];
};

export const EDUCATION_LIMITS = {
  count: 3,
  labelMin: 2,
  labelMax: 6,
  titleMin: 4,
  titleMax: 14,
  bodyMin: 40,
  bodyMax: 100,
};

export type SectionResult = {
  text: string;
  sources: Source[];
  // 科別：診療項目與衛教資訊都會用到
  specialty?: string;
  // 只有診療項目會用到
  items?: ServiceItem[];
  // 只有衛教資訊會用到
  cards?: EducationItem[];
};

// 每個區塊各自生成，所以可能只有部分區塊有內容
export type ClinicContent = Partial<Record<SectionKey, SectionResult>>;

export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "info", label: "診所資訊" },
  { key: "notices", label: "注意事項" },
  { key: "services", label: "診療項目" },
  { key: "education", label: "衛教資訊" },
];

export function newEducationItem(): EducationItem {
  return {
    id: crypto.randomUUID(),
    label: "",
    labelColorIndex: 0,
    image: null,
    imageError: null,
    title: "",
    body: "",
    // 自動生成不產出動作，兩組都先不勾選，由管理者在編輯時開啟
    actions: [
      { enabled: false, label: "", uri: "" },
      { enabled: false, label: "", uri: "" },
    ],
  };
}

export function newServiceItem(): ServiceItem {
  return { id: crypto.randomUUID(), title: "", body: "", image: null, imageError: null };
}

// 測試用：請換成真實存在的診所，AI 才搜尋得到資料
// 測試用：取自 Google Maps 的真實診所
const MOCK_CLINICS: Clinic[] = [
  { id: "c001", name: "博安家庭醫學科診所", address: "台北市大安區麗水街3號" },
  { id: "c002", name: "羅醫師 親子診所", address: "台北市大安區通化街38巷14號1樓" },
  { id: "c003", name: "和平大愛眼科診所", address: "台北市大安區和平東路一段6號2樓" },
  { id: "c004", name: "安曼牙醫診所", address: "台北市大安區復興南路一段135巷27號8樓之3" },
  { id: "c005", name: "劉耳鼻喉科診所", address: "台北市大安區復興南路二段151巷27號" },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 沒設定 NEXT_PUBLIC_API_BASE 時走假資料，後端一好就自動改打真的 API
export async function fetchClinics(): Promise<Clinic[]> {
  if (useMock) {
    await delay(600);
    return MOCK_CLINICS;
  }
  return apiFetch<Clinic[]>("/api/clinics");
}

// 讀回這間診所已儲存的四個區塊
export async function fetchContent(clinicId: string): Promise<ClinicContent> {
  if (useMock) {
    return {};
  }
  return apiFetch<ClinicContent>(`/api/clinics/${clinicId}/content`);
}

// 儲存：整份覆蓋，對應畫面上的「儲存」
export async function saveContent(clinicId: string, content: ClinicContent): Promise<void> {
  if (useMock) {
    return;
  }
  await apiFetch(`/api/clinics/${clinicId}/content`, {
    method: "PUT",
    body: JSON.stringify(content),
  });
}

// 對應畫面上的「刪除」
export async function deleteContent(clinicId: string): Promise<void> {
  if (useMock) {
    return;
  }
  await apiFetch(`/api/clinics/${clinicId}/content`, { method: "DELETE" });
}

// 對應畫面上的「傳送」
export async function publishContent(clinicId: string): Promise<void> {
  if (useMock) {
    return;
  }
  await apiFetch(`/api/clinics/${clinicId}/content/publish`, { method: "POST" });
}

// 把圖片存到後端換成 HTTPS 網址。
// LINE Flex 訊息不接受 data URL，所以發布前每張圖都必須走這一步
export async function uploadImage(clinicId: string, file: Blob): Promise<string> {
  const form = new FormData();
  form.append("clinicId", clinicId);
  form.append("file", file);
  const data = await apiUpload<{ url: string }>("/api/images", form);
  return data.url;
}

// 呼叫後端 API，由後端依使用者選的 AI 搜尋並生成單一區塊
// specialty 只有診療項目會用到，留空代表交給 AI 自己判斷科別
export async function generateSection(
  clinic: Clinic,
  section: SectionKey,
  ai: AiSettings,
  specialty = "",
): Promise<SectionResult> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: clinic.name, address: clinic.address, section, specialty, ...ai }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "生成失敗，請稍後再試");
  }
  return data;
}

// 單張診療項目配圖，回傳可直接放進 img src 的 data URL
export async function generateServiceImage(
  title: string,
  specialty: string,
  ai: AiSettings,
): Promise<string> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, specialty, ...ai }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "圖片生成失敗，請稍後再試");
  }
  return data.image;
}
