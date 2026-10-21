"use client";

import { useState } from "react";
import { SERVICE_LIMITS, type ServiceItem } from "@/lib/clinics";
import { CountHint, GeneratedImage } from "./ui";

type Props = {
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  items: ServiceItem[];
  editing: boolean;
  busy: boolean;
  // 正在生圖的項目 id
  imageJobs: string[];
  onItemChange: (id: string, field: "title" | "body", value: string) => void;
  onRegenerateImage: (id: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
};

export default function ServicesPanel(props: Props) {
  const { specialty, items, editing, busy, imageJobs } = props;
  const [activeId, setActiveId] = useState<string | null>(null);
  // 選取的項目被刪掉或重新生成後 id 會消失，自動退回第一筆
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;

  return (
    <div className="space-y-4">
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="specialty" className="text-sm font-medium text-zinc-600">
            科別
          </label>
          <input
            id="specialty"
            value={specialty}
            onChange={(e) => props.onSpecialtyChange(e.target.value)}
            disabled={busy}
            placeholder="留空由 AI 自動判斷"
            className="w-56 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:bg-zinc-100"
          />
          <span className="text-xs text-zinc-500">
            AI 會依科別決定診療項目與配圖，改好後按上方「重新生成」。
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-zinc-500">「診療項目」尚未生成內容，請按「生成內容」。</p>
      ) : editing ? (
        <div className="space-y-4">
          {items.map((item, index) => {
            const generatingImage = imageJobs.includes(item.id);
            return (
              <div key={item.id} className="rounded border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-500">項目 {index + 1}</span>
                  <button
                    onClick={() => props.onRemoveItem(item.id)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    刪除這筆
                  </button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="space-y-2 sm:w-56 sm:shrink-0">
                    <GeneratedImage
                      image={item.image}
                      imageError={item.imageError}
                      alt={item.title}
                      loading={generatingImage}
                    />
                    <button
                      onClick={() => props.onRegenerateImage(item.id)}
                      disabled={generatingImage || !item.title.trim()}
                      className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generatingImage ? "生成中…" : item.image ? "重新生圖" : "生成圖片"}
                    </button>
                  </div>

                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-600">標題</span>
                        <CountHint
                          value={item.title}
                          min={SERVICE_LIMITS.titleMin}
                          max={SERVICE_LIMITS.titleMax}
                        />
                      </div>
                      <input
                        value={item.title}
                        onChange={(e) => props.onItemChange(item.id, "title", e.target.value)}
                        className="w-full rounded border border-zinc-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-600">內容</span>
                        <CountHint
                          value={item.body}
                          min={SERVICE_LIMITS.bodyMin}
                          max={SERVICE_LIMITS.bodyMax}
                        />
                      </div>
                      <textarea
                        value={item.body}
                        rows={6}
                        onChange={(e) => props.onItemChange(item.id, "body", e.target.value)}
                        className="w-full rounded border border-zinc-300 px-3 py-2 leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={props.onAddItem}
            className="w-full rounded border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            新增一筆
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row">
          <ul className="flex shrink-0 gap-2 overflow-x-auto md:max-h-96 md:w-44 md:flex-col md:overflow-x-visible md:overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveId(item.id)}
                  className={`w-full whitespace-nowrap rounded-full border px-4 py-2 text-sm md:whitespace-normal ${
                    item.id === active?.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {item.title || "（未命名）"}
                </button>
              </li>
            ))}
          </ul>

          {active && (
            <div className="flex flex-1 flex-col gap-4 rounded border border-zinc-200 bg-white p-4 sm:flex-row">
              <div className="space-y-2 sm:w-64 sm:shrink-0">
                <GeneratedImage
                  image={active.image}
                  imageError={active.imageError}
                  alt={active.title}
                  loading={imageJobs.includes(active.id)}
                />
                {active.imageError && !imageJobs.includes(active.id) && (
                  <button
                    onClick={() => props.onRegenerateImage(active.id)}
                    className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
                  >
                    重新生圖
                  </button>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{active.title}</h3>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-700">{active.body}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
