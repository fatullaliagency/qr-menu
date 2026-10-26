"use client";

import { useState } from "react";

interface ImagePickerProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  compact?: boolean;
}

export default function ImagePickerInput({
  name,
  defaultValue = "",
  placeholder = "Şəkil seçin və ya link yapışdırın...",
  compact = false,
}: ImagePickerProps) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.78);
        setValue(compressedDataUrl);
        setLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />

      <div className="flex items-center gap-2">
        <label className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium px-3.5 py-2 rounded-xl text-xs sm:text-sm transition shrink-0 flex items-center gap-1.5">
          <span>📁 {loading ? "Yüklənir..." : "Qalereyadan Şəkil Seç"}</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {!compact && (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
          />
        )}

        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-xs text-red-500 hover:underline shrink-0"
          >
            Təmizlə
          </button>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt="Önizləmə"
            className="w-14 h-14 rounded-lg object-cover border border-amber-400"
          />
          <span className="text-xs text-emerald-600 font-medium">
            ✓ Şəkil hazırdır
          </span>
        </div>
      )}
    </div>
  );
}
