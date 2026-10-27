"use client";

import { useState } from "react";

interface Props {
  name: string;
  label: string;
  defaultValue?: string;
}

export default function ImagePickerInput({
  name,
  label,
  defaultValue = "",
}: Props) {
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

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setValue(compressedDataUrl);
        setLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input type="hidden" name={name} value={value} />

      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="Seçilən şəkil"
            className="h-16 w-16 object-cover rounded-xl border-2 border-amber-500 shadow-sm shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs shrink-0">
            Şəkil yox
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition shadow-sm">
            <span>📷 {loading ? "Yüklənir..." : "Telefon / Kompüterdən Şəkil Seç"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl font-medium transition"
            >
              Şəkli Sil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
