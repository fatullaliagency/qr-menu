"use client";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { inspectMenuVideo, MAX_MENU_VIDEO_BYTES } from "@/app/lib/menu-video";

export default function VideoPickerInput({ restaurantId, defaultUrl = "" }: { restaurantId: string; defaultUrl?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const [preview, setPreview] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  const [inlineVideo, setInlineVideo] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    return () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); };
  }, [preview]);
  useEffect(() => {
    const form = input.current?.closest("form");
    const block = (event: Event) => {
      if (pending.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setError("Video yüklənir. Tamamlanmasını gözləyin.");
      }
    };
    form?.addEventListener("submit", block, true);
    return () => form?.removeEventListener("submit", block, true);
  }, []);
  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    abortRef.current?.abort();
    if (!["video/mp4", "video/webm"].includes(file.type) || !/\.(mp4|webm)$/i.test(file.name)) {
      setError("Yalnız MP4 və WebM faylları dəstəklənir."); e.currentTarget.value = ""; return;
    }
    if (file.size < 12 || file.size > MAX_MENU_VIDEO_BYTES) {
      setError("Video maksimum 10 MB olmalıdır."); e.currentTarget.value = ""; return;
    }
    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const invalid = inspectMenuVideo(file.type, header);
    if (invalid) { setError(invalid); e.currentTarget.value = ""; return; }
    // Keep the legacy inline path for short clips and browser regression tests.
    // Only larger clips use direct-to-Blob upload, avoiding the 4.5 MB function cap.
    if (file.size <= 2_621_440) {
      abortRef.current = null; pending.current = false; setUploading(false);
      setInlineVideo(true); setError(""); setRemoving(false); setBlobUrl("");
      setPreview(URL.createObjectURL(file));
      return;
    }
    setInlineVideo(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setError(""); setRemoving(false); setBlobUrl(""); setPreview(URL.createObjectURL(file));
    pending.current = true; setUploading(true);
    try {
      const ext = file.type === "video/mp4" ? "mp4" : "webm";
      const result = await upload(
        `menu-videos/${restaurantId}/${crypto.randomUUID()}.${ext}`, file,
        { access: "public", contentType: file.type, handleUploadUrl: "/api/menu-video/upload", clientPayload: restaurantId, abortSignal: controller.signal }
      );
      if (!controller.signal.aborted) setBlobUrl(result.url);
    } catch (e) {
      if (!controller.signal.aborted) { setBlobUrl(""); setError(e instanceof Error ? e.message : "Video yüklənmədi."); }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null; pending.current = false; setUploading(false);
      }
    }
  }
  function remove() {
    abortRef.current?.abort(); abortRef.current = null; pending.current = false; setUploading(false);
    if (input.current) input.current.value = "";
    setPreview(""); setBlobUrl(""); setRemoving(true); setInlineVideo(true); setError("");
  }
  const src = preview || (!removing ? defaultUrl : "");
  return <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3" aria-busy={uploading}>
    <input type="hidden" name="removeVideo" value={removing ? "1" : "0"} />
    <input type="hidden" name="videoBlobUrl" value={blobUrl} />
    <p className="text-sm font-bold text-sky-950">🎬 Məhsul videosu (istəyə bağlı)</p>
    <p className="text-xs text-sky-900">MP4 / WebM · maksimum 10 MB</p>
    <div className="flex flex-wrap gap-2">
      <label className="cursor-pointer rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white">
        🎥 Video əlavə et
        <input ref={input} name={inlineVideo ? "videoFile" : undefined} type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={choose} className="sr-only" aria-label="Video faylı seç" />
      </label>
      {(src || defaultUrl) && <button type="button" onClick={remove} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-800">Videonu sil</button>}
    </div>
    {src && <video src={src} controls playsInline preload="none" aria-label="Məhsul videosuna ön baxış" className="max-h-48 w-full rounded-lg bg-black object-contain" />}
    {uploading && <p role="status" className="text-xs font-semibold text-indigo-900">Video yüklənir...</p>}
    {blobUrl && !uploading && <p role="status" className="text-xs font-semibold text-emerald-900">Video hazırdır. Məhsulu yadda saxlayın.</p>}
    {error && <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-900">{error}</p>}
  </div>;
}
