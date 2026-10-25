"use client";

import { useEffect, useState } from "react";

export default function QrCodeBox({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const [menuUrl, setMenuUrl] = useState("");

  useEffect(() => {
    // Sitenin çalıştığı adresi otomatik algılar (localhost veya gerçek domain)
    setMenuUrl(`${window.location.origin}/${slug}`);
  }, [slug]);

  if (!menuUrl) return null;

  // Yüksek çözünürlüklü QR Kod API adresi
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(
    menuUrl
  )}`;

  const downloadQr = async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-qr-menyu.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("QR kod yüklənərkən xəta baş verdi.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 border border-gray-200">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-xl font-bold text-zinc-900">📱 Masaüstü QR Kodunuz</h2>
        <p className="text-gray-500 text-sm max-w-md">
          Müştərilər telefon kamerası ilə bu kodu oxudaraq birbaşa{" "}
          <strong>{restaurantName}</strong> menyusuna daxil ola bilərlər.
        </p>
        <div className="pt-1">
          <span className="inline-block bg-gray-100 text-zinc-700 text-xs px-3 py-1.5 rounded-lg font-mono">
            {menuUrl}
          </span>
        </div>
        <div className="pt-3">
          <button
            onClick={downloadQr}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition shadow-sm"
          >
            ⬇ QR Kodu Yüklə (PNG)
          </button>
        </div>
      </div>

      <div className="bg-white p-3 border-2 border-dashed border-gray-300 rounded-2xl shrink-0">
        <img
          src={qrImageUrl}
          alt="Restoran QR Kodu"
          className="w-36 h-36 object-contain"
        />
      </div>
    </div>
  );
}