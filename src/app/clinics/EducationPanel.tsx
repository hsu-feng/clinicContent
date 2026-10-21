"use client";

import { useRef, useState } from "react";
import {
  EDUCATION_LIMITS,
  LABEL_COLORS,
  type EducationAction,
  type EducationItem,
} from "@/lib/clinics";
import ImageCropModal from "./ImageCropModal";
import { CountHint, GeneratedImage } from "./ui";

type Props = {
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  cards: EducationItem[];
  editing: boolean;
  busy: boolean;
  // 正在生圖的卡片 id
  imageJobs: string[];
  onCardChange: (id: string, patch: Partial<EducationItem>) => void;
  onRegenerateImage: (id: string) => void;
  onAddCard: () => void;
  onRemoveCard: (id: string) => void;
};

const CARD_WIDTH = 288;
// data URL 會整份放進記憶體，太大的圖會讓畫面變慢
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default function EducationPanel(props: Props) {
  const { specialty, cards, editing, busy, imageJobs } = props;
  const trackRef = useRef<HTMLDivElement>(null);
  // 選好檔案後先進裁切視窗，確定了才寫回卡片
  const [cropping, setCropping] = useState<{ cardId: string; src: string } | null>(null);

  // 左右點選切換，不靠滾輪
  function scrollCards(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * (CARD_WIDTH + 16), behavior: "smooth" });
  }

  function updateAction(card: EducationItem, index: number, patch: Partial<EducationAction>) {
    const actions = card.actions.map((action, i) => (i === index ? { ...action, ...patch } : action));
    props.onCardChange(card.id, { actions });
  }

  function uploadImage(card: EducationItem, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      props.onCardChange(card.id, { imageError: "請選擇圖片檔" });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      props.onCardChange(card.id, { imageError: "圖片請小於 5MB" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropping({ cardId: card.id, src: String(reader.result) });
    reader.onerror = () => props.onCardChange(card.id, { imageError: "圖片讀取失敗，請換一張試試" });
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="eduSpecialty" className="text-sm font-medium text-zinc-600">
            科別
          </label>
          <input
            id="eduSpecialty"
            value={specialty}
            onChange={(e) => props.onSpecialtyChange(e.target.value)}
            disabled={busy}
            placeholder="留空由 AI 自動判斷"
            className="w-56 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:bg-zinc-100"
          />
          <span className="text-xs text-zinc-500">
            AI 會依科別決定衛教主題與配圖，改好後按上方「重新生成」。
          </span>
        </div>
      )}

      {cards.length === 0 ? (
        <p className="text-zinc-500">「衛教資訊」尚未生成內容，請按「生成內容」。</p>
      ) : editing ? (
        <div className="space-y-4">
          {cards.map((card, index) => {
            const generatingImage = imageJobs.includes(card.id);
            return (
              <div key={card.id} className="rounded border border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-500">卡片 {index + 1}</span>
                  <button
                    onClick={() => props.onRemoveCard(card.id)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    刪除這筆
                  </button>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row">
                  {/* 左側：即時預覽，右側改什麼這裡就跟著變 */}
                  <div className="space-y-2 lg:shrink-0">
                    <p className="text-xs text-zinc-500">預覽</p>
                    <EducationCard card={card} loading={generatingImage} />
                    <div className="flex w-72 gap-2">
                      <button
                        onClick={() => props.onRegenerateImage(card.id)}
                        disabled={generatingImage || !card.title.trim()}
                        className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {generatingImage ? "生成中…" : "AI 生圖"}
                      </button>
                      <label className="flex-1 cursor-pointer rounded border border-zinc-300 px-3 py-1.5 text-center text-sm hover:bg-zinc-100">
                        上傳圖片
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            uploadImage(card, e.target.files?.[0]);
                            // 清掉才能重選同一個檔案
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {/* 已經有圖時，錯誤不會畫在佔位框裡，所以另外顯示 */}
                    {card.imageError && !generatingImage && (
                      <p className="w-72 text-xs text-red-600">{card.imageError}</p>
                    )}
                  </div>

                  {/* 右側：編輯區塊 */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-600">標籤</span>
                        <CountHint
                          value={card.label}
                          min={EDUCATION_LIMITS.labelMin}
                          max={EDUCATION_LIMITS.labelMax}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={card.label}
                          onChange={(e) => props.onCardChange(card.id, { label: e.target.value })}
                          className="w-40 rounded border border-zinc-300 px-3 py-2"
                        />
                        <div className="flex gap-1">
                          {LABEL_COLORS.map((color, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => props.onCardChange(card.id, { labelColorIndex: i })}
                              aria-label={`標籤顏色 ${i + 1}`}
                              style={{
                                backgroundColor: color.bg,
                                borderColor: color.border ?? color.bg,
                              }}
                              className={`h-7 w-7 rounded border ${
                                card.labelColorIndex === i ? "ring-2 ring-blue-500 ring-offset-1" : ""
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-600">頁面標題</span>
                        <CountHint
                          value={card.title}
                          min={EDUCATION_LIMITS.titleMin}
                          max={EDUCATION_LIMITS.titleMax}
                        />
                      </div>
                      <input
                        value={card.title}
                        onChange={(e) => props.onCardChange(card.id, { title: e.target.value })}
                        className="w-full rounded border border-zinc-300 px-3 py-2"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-zinc-600">文字說明</span>
                        <CountHint
                          value={card.body}
                          min={EDUCATION_LIMITS.bodyMin}
                          max={EDUCATION_LIMITS.bodyMax}
                        />
                      </div>
                      <textarea
                        value={card.body}
                        rows={4}
                        onChange={(e) => props.onCardChange(card.id, { body: e.target.value })}
                        className="w-full rounded border border-zinc-300 px-3 py-2 leading-relaxed"
                      />
                    </div>

                    {card.actions.map((action, i) => (
                      <div key={i} className="rounded border border-zinc-200 p-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                          <input
                            type="checkbox"
                            checked={action.enabled}
                            onChange={(e) => updateAction(card, i, { enabled: e.target.checked })}
                          />
                          動作 {i + 1}
                        </label>

                        {action.enabled && (
                          <div className="mt-2 space-y-2">
                            <input
                              value={action.label}
                              onChange={(e) => updateAction(card, i, { label: e.target.value })}
                              placeholder="網址說明"
                              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            />
                            <input
                              value={action.uri}
                              onChange={(e) => updateAction(card, i, { uri: e.target.value })}
                              placeholder="點擊導向網址（https://…）"
                              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={props.onAddCard}
            className="w-full rounded border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            新增一筆
          </button>
        </div>
      ) : (
        <div className="relative">
          <div ref={trackRef} className="flex gap-4 overflow-x-auto pb-2">
            {cards.map((card) => (
              <EducationCard
                key={card.id}
                card={card}
                loading={imageJobs.includes(card.id)}
                onRetry={() => props.onRegenerateImage(card.id)}
              />
            ))}
          </div>

          {cards.length > 1 && (
            <>
              <CarouselButton direction={-1} onClick={() => scrollCards(-1)} />
              <CarouselButton direction={1} onClick={() => scrollCards(1)} />
            </>
          )}
        </div>
      )}
      {cropping && (
        <ImageCropModal
          src={cropping.src}
          onCancel={() => setCropping(null)}
          onConfirm={(dataUrl) => {
            props.onCardChange(cropping.cardId, { image: dataUrl, imageError: null });
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

// 預覽和編輯共用同一個卡片，所以編輯時看到的就是實際呈現
function EducationCard({
  card,
  loading,
  onRetry,
}: {
  card: EducationItem;
  loading: boolean;
  onRetry?: () => void;
}) {
  const actions = card.actions.filter((action) => action.enabled && action.label.trim());

  return (
    <article className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="relative">
        <GeneratedImage
          image={card.image}
          imageError={card.imageError}
          alt={card.title}
          loading={loading}
          className="rounded-none"
        />
        {card.label && (
          <span
            className="absolute left-3 top-3 rounded px-2 py-1 text-xs font-medium"
            style={labelStyle(card.labelColorIndex)}
          >
            {card.label}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-2 p-4">
        <h3 className="text-base font-semibold">
          {card.title || <span className="text-zinc-400">（尚未填寫標題）</span>}
        </h3>
        <p className="text-sm leading-relaxed text-zinc-600">{card.body}</p>
        {onRetry && card.imageError && !loading && (
          <button
            onClick={onRetry}
            className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            重新生圖
          </button>
        )}
      </div>

      {actions.length > 0 && (
        <div className="border-t border-zinc-100">
          {actions.map((action, i) => (
            <a
              key={i}
              href={action.uri || undefined}
              target="_blank"
              rel="noreferrer"
              className="block border-b border-zinc-100 px-4 py-3 text-center text-sm text-blue-600 last:border-b-0 hover:underline"
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function CarouselButton({ direction, onClick }: { direction: 1 | -1; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === 1 ? "下一張" : "上一張"}
      className={`absolute top-24 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 shadow hover:bg-zinc-50 ${
        direction === 1 ? "-right-2" : "-left-2"
      }`}
    >
      {direction === 1 ? "›" : "‹"}
    </button>
  );
}

function labelStyle(index: number) {
  const color = LABEL_COLORS[index] ?? LABEL_COLORS[0];
  return {
    backgroundColor: color.bg,
    color: color.text,
    border: color.border ? `1px solid ${color.border}` : undefined,
  };
}
