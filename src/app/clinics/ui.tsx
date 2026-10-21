"use client";

type ImageProps = {
  image: string | null;
  imageError: string | null;
  alt: string;
  loading: boolean;
  className?: string;
};

// 固定 4:3，所以生圖模型輸出什麼比例都不會讓版面跳動
export function GeneratedImage({ image, imageError, alt, loading, className }: ImageProps) {
  const box = `aspect-[4/3] w-full ${className ?? "rounded"}`;

  if (loading) {
    return <div className={`${box} animate-pulse bg-zinc-200`} />;
  }
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 來源是 data URL，next/image 不支援
      <img src={image} alt={alt} className={`${box} object-cover`} />
    );
  }
  return (
    <div
      className={`${box} flex items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-sm`}
    >
      {imageError ? (
        <span className="text-red-600">{imageError}</span>
      ) : (
        <span className="text-zinc-500">尚未生成圖片</span>
      )}
    </div>
  );
}

// 字數超出建議範圍就標紅，但不擋儲存
export function CountHint({ value, min, max }: { value: string; min: number; max: number }) {
  const length = value.trim().length;
  const ok = length >= min && length <= max;
  return (
    <span className={`text-xs ${ok ? "text-zinc-500" : "text-red-600"}`}>
      {length} 字（建議 {min}–{max} 字）
    </span>
  );
}
