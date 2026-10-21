"use client";

import { useState } from "react";
import type { Clinic } from "@/lib/clinics";

type Props = {
  clinics: Clinic[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (clinic: Clinic) => void;
};

export default function ClinicList({ clinics, loading, selectedId, onSelect }: Props) {
  const [keyword, setKeyword] = useState("");

  const trimmed = keyword.trim();
  const filtered = clinics.filter(
    (c) => c.name.includes(trimmed) || c.address.includes(trimmed),
  );

  return (
    <aside className="flex flex-col border-b border-zinc-200 bg-white md:w-72 md:border-b-0 md:border-r">
      <div className="border-b border-zinc-200 p-3">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜尋診所名稱或地址"
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <ul className="max-h-64 flex-1 overflow-y-auto md:max-h-none">
        {loading && <li className="p-4 text-sm text-zinc-500">載入中…</li>}

        {!loading && filtered.length === 0 && (
          <li className="p-4 text-sm text-zinc-500">找不到符合的診所</li>
        )}

        {filtered.map((clinic) => (
          <li key={clinic.id}>
            <button
              onClick={() => onSelect(clinic)}
              className={`w-full border-l-4 px-4 py-3 text-left hover:bg-zinc-50 ${
                clinic.id === selectedId
                  ? "border-blue-600 bg-blue-50 hover:bg-blue-50"
                  : "border-transparent"
              }`}
            >
              <div className="font-medium">{clinic.name}</div>
              <div className="text-xs text-zinc-500">{clinic.address}</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
