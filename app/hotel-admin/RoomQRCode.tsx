"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Build the room QR strictly in the hotel manager's browser.
 * In particular, NEVER send a room bearer-token URL to an external QR API.
 */
export default function RoomQRCode({
  slug,
  number,
  token,
}: {
  slug: string;
  number: string;
  token: string;
}) {
  const [url, setUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const guestUrl =
      window.location.origin +
      "/hotel/" + encodeURIComponent(slug) +
      "/room/" + encodeURIComponent(number) +
      "?t=" + encodeURIComponent(token);
    setUrl(guestUrl);
    setQrDataUrl("");
    setError(false);
    let cancelled = false;
    void QRCode.toDataURL(guestUrl, {
      errorCorrectionLevel: "M",
      margin: 3,
      width: 440,
    }).then((data) => {
      if (!cancelled) setQrDataUrl(data);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [slug, number, token]);

  return (
    <div className="space-y-2">
      {qrDataUrl ? (
        <>
          <img
            src={qrDataUrl}
            width={138}
            height={138}
            alt={"Otaq " + number + " QR kodu"}
            className="rounded-lg bg-white p-1"
          />
          <a
            className="block text-xs text-blue-700 underline"
            href={qrDataUrl}
            download={slug + "-otaq-" + number + "-qr.png"}
          >
            QR kodu PNG kimi yüklə
          </a>
        </>
      ) : (
        <p className="text-xs text-zinc-500">
          {error ? "QR təsviri hazırlana bilmədi." : "QR hazırlanır..."}
        </p>
      )}
      {url && (
        <a
          className="block break-all text-xs text-blue-700 underline"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Qonaq linkini aç
        </a>
      )}
      <p className="text-xs text-zinc-500">
        QR kod lokal olaraq yaradılır. Qonaq linkini yalnız həmin otağa yerləşdirin.
      </p>
    </div>
  );
}
