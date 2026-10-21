"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { logout as apiLogout, useMock } from "@/lib/api";
import {
  deleteContent,
  fetchClinics,
  fetchContent,
  generateSection,
  generateServiceImage,
  newEducationItem,
  publishContent,
  saveContent,
  newServiceItem,
  type Clinic,
  type ClinicContent,
  type EducationItem,
  type SectionKey,
  type SectionResult,
} from "@/lib/clinics";
import {
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  providerLabel,
  saveAiSettings,
  type AiSettings,
} from "@/lib/ai-settings";
import AiSettingsModal from "./AiSettingsModal";
import ClinicList from "./ClinicList";
import ContentPanel from "./ContentPanel";

// 會用到 AI 配圖的兩個區塊
type ImageSection = "services" | "education";

// sessionStorage 不會主動通知變更，所以不需要訂閱
function subscribeNothing() {
  return () => {};
}

export default function ClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Clinic | null>(null);
  // 每間診所各自的內容，key 是診所 id
  const [contents, setContents] = useState<Record<string, ClinicContent>>({});
  // 正在生成的診所與區塊
  const [generating, setGenerating] = useState<{ clinicId: string; section: SectionKey } | null>(null);
  // 正在生圖的診療項目 id
  const [imageJobs, setImageJobs] = useState<string[]>([]);
  // 跟 generating 一樣綁定診所，否則 A 診所遲到的失敗會畫在 B 診所的面板上
  const [error, setError] = useState<{ clinicId: string; message: string } | null>(null);
  const [draft, setDraft] = useState<ClinicContent | null>(null);
  // 登入帳號存在 sessionStorage；伺服器端產生畫面時讀不到，先當成空字串
  const account = useSyncExternalStore(
    subscribeNothing,
    () => sessionStorage.getItem("account") ?? "",
    () => "",
  );
  // 這次開啟頁面後改過的 AI 設定；沒改過就讀取瀏覽器裡存的
  const [changedAiSettings, setChangedAiSettings] = useState<AiSettings | null>(null);
  const aiSettings = changedAiSettings ?? (account ? loadAiSettings(account) : DEFAULT_AI_SETTINGS);
  // AI 設定視窗：null 代表關閉，notice 是開啟時要顯示的提示
  const [aiModal, setAiModal] = useState<{ notice: string | null } | null>(null);

  // 沒登入就送回登入頁
  useEffect(() => {
    if (sessionStorage.getItem("loggedIn") !== "true" || !sessionStorage.getItem("account")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    fetchClinics().then((data) => {
      setClinics(data);
      setLoading(false);
    });
  }, []);

  const editing = draft !== null;
  const content = selected ? contents[selected.id] ?? null : null;
  const generatingSection =
    selected && generating?.clinicId === selected.id ? generating.section : null;
  const visibleError = selected && error?.clinicId === selected.id ? error.message : null;

  // 把失敗記在發動時的那間診所上，就算使用者已經切走也不會貼錯面板
  function fail(clinicId: string, err: unknown, fallback: string) {
    setError({ clinicId, message: err instanceof Error ? err.message : fallback });
  }

  function handleSelect(clinic: Clinic) {
    if (editing && !confirm("尚未儲存的編輯會遺失，確定要切換診所嗎？")) return;
    setDraft(null);
    setSelected(clinic);
    // 還沒載過就去後端拿已儲存的內容
    if (!useMock && !contents[clinic.id]) {
      void loadContent(clinic.id);
    }
  }

  async function loadContent(clinicId: string) {
    try {
      const saved = await fetchContent(clinicId);
      setContents((prev) => ({ ...prev, [clinicId]: saved }));
    } catch (err) {
      fail(clinicId, err, "讀取內容失敗，請稍後再試");
    }
  }

  async function handleGenerate(section: SectionKey, specialty: string) {
    if (!selected) return;
    if (!aiSettings.apiKey) {
      setAiModal({ notice: "請先選擇要使用的 AI 並填入 API key。" });
      return;
    }
    if (content?.[section] && !confirm("重新生成會覆蓋這個區塊的內容，確定嗎？")) return;
    const clinic = selected;
    setError(null);
    setGenerating({ clinicId: clinic.id, section });
    try {
      const result = await generateSection(clinic, section, aiSettings, specialty);
      setContents((prev) => ({ ...prev, [clinic.id]: { ...prev[clinic.id], [section]: result } }));
      // 文字先顯示，圖片一張一張補上
      const subject = result.specialty ?? "";
      if (section === "services" && result.items) {
        void generateImagesInOrder(clinic.id, "services", subject, result.items);
      }
      if (section === "education" && result.cards) {
        void generateImagesInOrder(clinic.id, "education", subject, result.cards);
      }
    } catch (err) {
      fail(clinic.id, err, "生成失敗，請稍後再試");
    } finally {
      setGenerating(null);
    }
  }

  // 一次只生一張：三張同時打，第二、三張很容易被擋下或撞到頻率限制
  async function generateImagesInOrder(
    clinicId: string,
    section: ImageSection,
    specialty: string,
    items: { id: string; title: string }[],
  ) {
    for (const item of items) {
      await runImageJob(clinicId, section, specialty, item.id, item.title);
    }
  }

  // 只更新某一筆的圖片欄位，不動其他筆
  function patchItem(
    clinicId: string,
    section: ImageSection,
    itemId: string,
    patch: { image?: string | null; imageError?: string | null },
  ) {
    const patchSection = (target: SectionResult): SectionResult => {
      if (section === "services") {
        return target.items
          ? { ...target, items: target.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : target;
      }
      return target.cards
        ? { ...target, cards: target.cards.map((c) => (c.id === itemId ? { ...c, ...patch } : c)) }
        : target;
    };

    setContents((prev) => {
      const target = prev[clinicId]?.[section];
      if (!target) return prev;
      return { ...prev, [clinicId]: { ...prev[clinicId], [section]: patchSection(target) } };
    });
    // 編輯中的草稿也要跟著更新，否則儲存時會蓋掉剛生好的圖
    setDraft((prev) => {
      const target = prev?.[section];
      return prev && target ? { ...prev, [section]: patchSection(target) } : prev;
    });
  }

  async function runImageJob(
    clinicId: string,
    section: ImageSection,
    specialty: string,
    itemId: string,
    title: string,
  ) {
    if (!title.trim()) return;
    setImageJobs((prev) => [...prev, itemId]);
    patchItem(clinicId, section, itemId, { imageError: null });
    try {
      const image = await generateServiceImage(title, specialty, aiSettings);
      patchItem(clinicId, section, itemId, { image, imageError: null });
    } catch (err) {
      patchItem(clinicId, section, itemId, {
        imageError: err instanceof Error ? err.message : "圖片生成失敗",
      });
    } finally {
      setImageJobs((prev) => prev.filter((id) => id !== itemId));
    }
  }

  function handleRegenerateImage(itemId: string) {
    if (!selected) return;
    if (!aiSettings.apiKey) {
      setAiModal({ notice: "請先選擇要使用的 AI 並填入 API key。" });
      return;
    }
    const target = (draft ?? contents[selected.id])?.services;
    const item = target?.items?.find((i) => i.id === itemId);
    if (!item) return;
    void runImageJob(selected.id, "services", target?.specialty ?? "", itemId, item.title);
  }

  function handleRegenerateCardImage(itemId: string) {
    if (!selected) return;
    if (!aiSettings.apiKey) {
      setAiModal({ notice: "請先選擇要使用的 AI 並填入 API key。" });
      return;
    }
    const target = (draft ?? contents[selected.id])?.education;
    const card = target?.cards?.find((c) => c.id === itemId);
    if (!card) return;
    void runImageJob(selected.id, "education", target?.specialty ?? "", itemId, card.title);
  }

  function handleDraftChange(key: SectionKey, value: string) {
    setDraft((prev) =>
      prev
        ? { ...prev, [key]: { ...prev[key], text: value, sources: prev[key]?.sources ?? [] } }
        : prev,
    );
  }

  function handleItemChange(itemId: string, field: "title" | "body", value: string) {
    setDraft((prev) => {
      const section = prev?.services;
      if (!prev || !section?.items) return prev;
      return {
        ...prev,
        services: {
          ...section,
          items: section.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)),
        },
      };
    });
  }

  function handleAddItem() {
    setDraft((prev) => {
      if (!prev) return prev;
      const section = prev.services ?? { text: "", sources: [] };
      return { ...prev, services: { ...section, items: [...(section.items ?? []), newServiceItem()] } };
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!confirm("確定要刪除這筆診療項目嗎？")) return;
    setDraft((prev) => {
      const section = prev?.services;
      if (!prev || !section?.items) return prev;
      return { ...prev, services: { ...section, items: section.items.filter((i) => i.id !== itemId) } };
    });
  }

  function handleCardChange(itemId: string, patch: Partial<EducationItem>) {
    setDraft((prev) => {
      const target = prev?.education;
      if (!prev || !target?.cards) return prev;
      return {
        ...prev,
        education: {
          ...target,
          cards: target.cards.map((c) => (c.id === itemId ? { ...c, ...patch } : c)),
        },
      };
    });
  }

  function handleAddCard() {
    setDraft((prev) => {
      if (!prev) return prev;
      const target = prev.education ?? { text: "", sources: [] };
      return { ...prev, education: { ...target, cards: [...(target.cards ?? []), newEducationItem()] } };
    });
  }

  function handleRemoveCard(itemId: string) {
    if (!confirm("確定要刪除這張衛教卡片嗎？")) return;
    setDraft((prev) => {
      const target = prev?.education;
      if (!prev || !target?.cards) return prev;
      return { ...prev, education: { ...target, cards: target.cards.filter((c) => c.id !== itemId) } };
    });
  }

  async function handleSave() {
    if (!selected || !draft) return;
    const clinic = selected;
    setError(null);
    try {
      await saveContent(clinic.id, draft);
      setContents((prev) => ({ ...prev, [clinic.id]: draft }));
      setDraft(null);
    } catch (err) {
      fail(clinic.id, err, "儲存失敗，請稍後再試");
    }
  }

  async function handleSend() {
    if (!selected || !confirm(`確定要送出「${selected.name}」的內容嗎？`)) return;
    const clinic = selected;
    setError(null);
    try {
      await publishContent(clinic.id);
      alert(useMock ? "已送出（模擬，尚未串接後端）" : "已送出");
    } catch (err) {
      fail(clinic.id, err, "送出失敗，請稍後再試");
    }
  }

  async function handleDelete() {
    if (!selected || !confirm(`確定要刪除「${selected.name}」的內容嗎？`)) return;
    const clinic = selected;
    setError(null);
    try {
      await deleteContent(clinic.id);
      setContents((prev) => {
        const next = { ...prev };
        delete next[clinic.id];
        return next;
      });
    } catch (err) {
      fail(clinic.id, err, "刪除失敗，請稍後再試");
    }
  }

  function handleSaveAiSettings(settings: AiSettings) {
    setChangedAiSettings(settings);
    saveAiSettings(account, settings);
    setAiModal(null);
  }

  function handleLogout() {
    if (editing && !confirm("尚未儲存的編輯會遺失，確定要登出嗎？")) return;
    if (!useMock) {
      void apiLogout();
    }
    sessionStorage.removeItem("loggedIn");
    sessionStorage.removeItem("account");
    router.replace("/login");
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 text-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">診所內容管理</h1>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-zinc-500 sm:inline">{account}</span>
          <button
            onClick={() => setAiModal({ notice: null })}
            className="rounded border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100"
          >
            AI 設定：{providerLabel(aiSettings.provider)}
            {!aiSettings.apiKey && <span className="ml-1 text-red-600">（未設定）</span>}
          </button>
          <button
            onClick={handleLogout}
            className="rounded border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100"
          >
            登出
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <ClinicList
          clinics={clinics}
          loading={loading}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
        />
        <ContentPanel
          clinic={selected}
          content={content}
          generatingSection={generatingSection}
          error={visibleError}
          editing={editing}
          draft={draft}
          imageJobs={imageJobs}
          onGenerate={handleGenerate}
          onEdit={() => setDraft(content)}
          onDraftChange={handleDraftChange}
          onItemChange={handleItemChange}
          onRegenerateImage={handleRegenerateImage}
          onCardChange={handleCardChange}
          onRegenerateCardImage={handleRegenerateCardImage}
          onAddCard={handleAddCard}
          onRemoveCard={handleRemoveCard}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onSave={handleSave}
          onCancelEdit={() => setDraft(null)}
          onSend={handleSend}
          onDelete={handleDelete}
        />
      </div>

      {aiModal && (
        <AiSettingsModal
          initial={aiSettings}
          notice={aiModal.notice}
          onSave={handleSaveAiSettings}
          onClose={() => setAiModal(null)}
        />
      )}
    </main>
  );
}
