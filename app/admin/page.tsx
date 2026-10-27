"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// --- TELEFON GALERİSİ VE BİLGİSAYARDAN FOTOĞRAF SEÇME BİLEŞENİ ---
function ImagePicker({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  helperText?: string;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Vercel ve veritabanı performansı için fotoğrafı otomatik optimize eder (Max 800px)
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        onChange(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm w-full">
          <span>📷 Qalereyadan / Cihazdan Şəkil Seç</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {value && (
          <div className="relative h-11 w-11 shrink-0 rounded-lg overflow-hidden border border-gray-300 shadow-sm bg-gray-50">
            <img src={value} alt="Önizləmə" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-0 right-0 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-bl hover:bg-red-700"
              title="Şəkli sil"
            >
              ✕
            </button>
