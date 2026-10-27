"use client";

import { useState } from "react";

export default function ImagePickerInput({
  name,
  label,
  defaultValue = "",
}: {
  name: string;
  label: string;
  defaultValue?: any;
}) {
  const [val, setVal] = useState<string>(defaultValue ? defaultValue : "");

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 700;
        let w = img.width;
        let h = img.height;
        if (w > h && w > max) {
          h = Math.round((h * max) / w);
          w = max;
        } else if (h > max) {
          w = Math.round((w * max) / h);
          h = max;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        setVal(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
      <input type="hidden" name={name} value={val} />
      <div className="flex items-center gap-2">
        {val ? (
          <img src={val} alt="" className="w-11 h-11 rounded-lg object-cover border border-amber-400" />
        ) : null}
        <span className="text-xs font-bold text-zinc-800">{label}</span>
      </div>
      <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0">
        📷 Qalereyadan Seç
        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
      </label>
    </div>
  );
}

export function EditToggleButton({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.style.display = el.style.display === "none" ? "block" : "none";
        }
      }}
      className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
    >
      ✏️ Düzənlə
    </button>
  );
}
