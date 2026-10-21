"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type Props = {
  src: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

// 卡片圖片固定 4:3，裁切框跟著一樣
const ASPECT = 4 / 3;
// 輸出上限：data URL 整份存在記憶體，太大會拖慢畫面
const MAX_OUTPUT_WIDTH = 1280;

export default function ImageCropModal({ src, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleConfirm() {
    if (!area) return;
    setWorking(true);
    setError(null);
    try {
      onConfirm(await cropToDataUrl(src, area));
    } catch (err) {
      setError(err instanceof Error ? err.message : "裁切失敗，請換一張圖片");
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 text-zinc-900 shadow-xl">
        <h2 className="text-lg font-semibold">調整圖片</h2>
        <p className="text-sm text-zinc-500">
          拖曳可移動位置，下方滑桿可放大縮小。框內範圍就是卡片會顯示的內容。
        </p>

        <div className="relative h-72 overflow-hidden rounded bg-zinc-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="shrink-0 text-zinc-600">縮放</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={working}
            className="rounded border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!area || working}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working ? "處理中…" : "確定"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function cropToDataUrl(src: string, area: Area) {
  const image = await loadImage(src);
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / area.width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("瀏覽器不支援圖片裁切");
  }
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);

  // 用 jpeg 是為了把 data URL 的體積壓下來
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片讀取失敗，請換一張試試"));
    image.src = src;
  });
}
