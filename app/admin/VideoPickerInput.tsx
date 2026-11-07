"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MENU_VIDEO_BYTES } from "@/app/lib/menu-video";

type Selection = { src: string; name: string };

export default function VideoPickerInput({
  defaultUrl = "",
}: {
  defaultUrl?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (selection) URL.revokeObjectURL(selection.src);
    };
  }, [selection]);

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type) || !/\.(mp4|webm)$/i.test(file.name)) {
      event.currentTarget.value = "";
      setError("Yalnız MP4 və WebM video seçə bilərsiniz.");
      return;
    }
    if (file.size < 12 || file.size > MAX_MENU_VIDEO_BYTES) {
      event.currentTarget.value = "";
      setError("Video maksimum 2.5 MB olmalıdır. Qısa, sıxılmış video seçin.");
      return;
    }
    setError("");
    setRemoveExisting(false);
    setSelection({ src: URL.createObjectURL(file), name: file.name });
  }

  function remove() {
    if (input.current) input.current.value = "";
    setSelection(null);
    setRemoveExisting(true);
    setError("");
  }

  const preview = selection?.src ?? (removeExisting ? "" : defaultUrl);

  return (
    <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <input type="hidden" name="removeVideo" value={removeExisting ? "1" : "0"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sky-950">🎬 Məhsulun videosu (istəyə bağlı)</p>
          <p className="mt-1 text-xs text-sky-900">MP4 / WebM · maksimum 2.5 MB · qısa, səssiz animasiyalar üçün</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white hover:bg-sky-800">
            🎥 Video əlavə et
            <input
              ref={input}
              name="videoFile"
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              onChange={choose}
              className="sr-only"
              aria-label="Video faylı seç"
            />
          </label>
          {(preview || defaultUrl) && (
            <button type="button" onClick={remove}
              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-800">
              Videonu sil
            </button>
          )}
        </div>
      </div>
      {preview && (
        <div className="space-y-1">
          <video src={preview} controls playsInline preload="none"
            aria-label="Məhsul videosuna ön baxış"
            className="max-h-48 w-full rounded-lg bg-black object-contain" />
          {selection?.name && <p className="text-xs text-sky-900">{selection.name}</p>}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-900">{error}</p>}
    </div>
  );
}
