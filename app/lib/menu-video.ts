/** New menu videos upload directly to Blob; legacy inline videos stay playable. */
export const MAX_MENU_VIDEO_BYTES = 10 * 1024 * 1024;
const LEGACY_INLINE_BYTES = 2_621_440;
const PREFIX = "MENU_VIDEO_BLOB_V1:";
export type MenuVideoUpload = {
  mimeType: "video/mp4" | "video/webm";
  sizeBytes: number;
  payload: Uint8Array<ArrayBuffer>;
};
export function isVideoBlobUrl(value: string, restaurantId?: string): boolean {
  if (value.length < 30 || value.length > 1024) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.port || u.username || u.password || u.search || u.hash) return false;
    if (!/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname)) return false;
    const match = u.pathname.match(/^\/menu-videos\/([a-z0-9-]{10,150})\/[a-zA-Z0-9_-]{1,160}\.(mp4|webm)$/);
    return !!match && (!restaurantId || match[1] === restaurantId);
  } catch { return false; }
}
export function encodeVideoBlob(url: string, mimeType: "video/mp4" | "video/webm", sizeBytes: number): MenuVideoUpload {
  if (!isVideoBlobUrl(url) || !Number.isInteger(sizeBytes) || sizeBytes < 12 ||
      sizeBytes > MAX_MENU_VIDEO_BYTES || !["video/mp4","video/webm"].includes(mimeType)) {
    throw new Error("Video məlumatları düzgün deyil.");
  }
  const raw = new TextEncoder().encode(PREFIX + url);
  const payload = new Uint8Array(new ArrayBuffer(raw.length));
  payload.set(raw);
  return { mimeType, sizeBytes, payload };
}
export function decodeVideoBlob(bytes: Uint8Array): string | null {
  if (bytes.length < PREFIX.length || bytes.length > 1100) return null;
  try {
    const str = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!str.startsWith(PREFIX)) return null;
    const url = str.slice(PREFIX.length);
    return isVideoBlobUrl(url) ? url : null;
  } catch { return null; }
}
export function inspectMenuVideo(mimeType: string, bytes: Uint8Array): string | null {
  if (bytes.length < 12 || bytes.length > MAX_MENU_VIDEO_BYTES) return "Video maksimum 10 MB olmalıdır.";
  if (mimeType === "video/mp4") {
    if (String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") return "MP4 video faylının quruluşu düzgün deyil.";
  } else if (mimeType === "video/webm") {
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) return "WebM video faylının quruluşu düzgün deyil.";
  } else return "Yalnız MP4 və WebM video formatları dəstəklənir.";
  return null;
}
export async function parseMenuVideoFile(input: FormDataEntryValue | null): Promise<MenuVideoUpload | null> {
  if (input === null || input === "") return null;
  if (typeof input === "string" || !("arrayBuffer" in input)) throw new Error("Video faylı düzgün seçilməyib.");
  if (input.size === 0) return null;
  if (input.size < 12 || input.size > LEGACY_INLINE_BYTES) throw new Error("Video birbaşa forma ilə deyil, ayrıca yüklənməlidir.");
  const bytes = new Uint8Array(await input.arrayBuffer());
  const error = inspectMenuVideo(input.type, bytes);
  if (error) throw new Error(error);
  const payload = new Uint8Array(new ArrayBuffer(bytes.length));
  payload.set(bytes);
  return { mimeType: input.type as MenuVideoUpload["mimeType"], sizeBytes: payload.length, payload };
}
