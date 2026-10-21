"use client";

import { useState } from "react";
import {
  SECTIONS,
  type Clinic,
  type ClinicContent,
  type EducationItem,
  type SectionKey,
} from "@/lib/clinics";
import EducationPanel from "./EducationPanel";
import ServicesPanel from "./ServicesPanel";

type Props = {
  clinic: Clinic | null;
  content: ClinicContent | null;
  generatingSection: SectionKey | null;
  error: string | null;
  editing: boolean;
  draft: ClinicContent | null;
  imageJobs: string[];
  onGenerate: (section: SectionKey, specialty: string) => void;
  onEdit: () => void;
  onDraftChange: (key: SectionKey, value: string) => void;
  onItemChange: (id: string, field: "title" | "body", value: string) => void;
  onRegenerateImage: (id: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onCardChange: (id: string, patch: Partial<EducationItem>) => void;
  onRegenerateCardImage: (id: string) => void;
  onAddCard: () => void;
  onRemoveCard: (id: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
};

const buttonBase = "rounded px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${buttonBase} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${buttonBase} border border-zinc-300 bg-white hover:bg-zinc-100`;
const danger = `${buttonBase} border border-red-300 bg-white text-red-600 hover:bg-red-50`;

export default function ContentPanel(props: Props) {
  const { clinic, content, generatingSection, error, editing, draft } = props;
  const [activeTab, setActiveTab] = useState<SectionKey>("info");

  // 科別輸入框：換診所、或 AI 判斷出科別時同步回來，之後讓管理者自由修改。
  // 一間診所只有一個科別，所以診療項目與衛教資訊共用同一個值
  const generatedSpecialty = content?.services?.specialty || content?.education?.specialty || "";
  const syncKey = `${clinic?.id ?? ""}|${generatedSpecialty}`;
  const [lastSync, setLastSync] = useState(syncKey);
  const [specialty, setSpecialty] = useState(generatedSpecialty);
  if (lastSync !== syncKey) {
    setLastSync(syncKey);
    setSpecialty(generatedSpecialty);
  }

  if (!clinic) {
    return (
      <section className="flex flex-1 items-center justify-center p-6 text-zinc-500">
        請從左側選擇一間診所
      </section>
    );
  }

  const busy = generatingSection !== null;
  const hasContent = content !== null && Object.keys(content).length > 0;
  const current = (editing ? draft : content)?.[activeTab];
  const activeLabel = SECTIONS.find((s) => s.key === activeTab)?.label;
  const isServices = activeTab === "services";
  const isEducation = activeTab === "education";

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-4">
        <h2 className="text-lg font-semibold">{clinic.name}</h2>

        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button onClick={props.onSave} className={primary}>儲存</button>
              <button onClick={props.onCancelEdit} className={secondary}>取消</button>
            </>
          ) : (
            <>
              <button
                onClick={() => props.onGenerate(activeTab, specialty)}
                disabled={busy}
                className={primary}
              >
                {generatingSection === activeTab ? "生成中…" : current ? "重新生成" : "生成內容"}
              </button>
              <button onClick={props.onEdit} disabled={!hasContent || busy} className={secondary}>
                編輯
              </button>
              <button onClick={props.onSend} disabled={!hasContent || busy} className={secondary}>
                傳送
              </button>
              <button onClick={props.onDelete} disabled={!hasContent || busy} className={danger}>
                刪除
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="flex overflow-x-auto border-b border-zinc-200 bg-white px-6">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm ${
              activeTab === s.key
                ? "border-blue-600 font-medium text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-4 p-6">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        {generatingSection === activeTab ? (
          <p className="text-zinc-500">AI 正在搜尋並生成「{activeLabel}」，約需 5–20 秒…</p>
        ) : (
          <>
            {isServices ? (
              <ServicesPanel
                specialty={specialty}
                onSpecialtyChange={setSpecialty}
                items={current?.items ?? []}
                editing={editing}
                busy={busy}
                imageJobs={props.imageJobs}
                onItemChange={props.onItemChange}
                onRegenerateImage={props.onRegenerateImage}
                onAddItem={props.onAddItem}
                onRemoveItem={props.onRemoveItem}
              />
            ) : isEducation ? (
              <EducationPanel
                specialty={specialty}
                onSpecialtyChange={setSpecialty}
                cards={current?.cards ?? []}
                editing={editing}
                busy={busy}
                imageJobs={props.imageJobs}
                onCardChange={props.onCardChange}
                onRegenerateImage={props.onRegenerateCardImage}
                onAddCard={props.onAddCard}
                onRemoveCard={props.onRemoveCard}
              />
            ) : editing ? (
              <textarea
                value={current?.text ?? ""}
                onChange={(e) => props.onDraftChange(activeTab, e.target.value)}
                className="h-80 w-full rounded border border-zinc-300 bg-white p-3 leading-relaxed"
              />
            ) : !current ? (
              <p className="text-zinc-500">「{activeLabel}」尚未生成內容，請按「生成內容」。</p>
            ) : (
              <div className="whitespace-pre-wrap rounded border border-zinc-200 bg-white p-4 leading-relaxed">
                {current.text || <span className="text-zinc-400">（此區塊沒有內容）</span>}
              </div>
            )}

            {!editing && current && current.sources.length > 0 && (
              <div className="text-sm">
                <p className="mb-1 font-medium text-zinc-600">參考來源（請核對內容是否正確）</p>
                <ul className="list-disc space-y-1 pl-5">
                  {current.sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.uri} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
