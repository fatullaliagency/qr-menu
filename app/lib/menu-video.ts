/** Short, compressed product videos are stored in a separate binary relation.
 * The Vercel function request cap is 4.5 MB: keep uploads well below it.
 * For larger clips use direct object storage rather than increasing this cap.
 */
export const MAX_MENU_VIDEO_BYTES = 2_621_440; // 2.5 MiB
export type MenuVideoUpload = {
  mimeType: "video/mp4" | "video/webm";
  sizeBytes: number;
  payload: Uint8Array;
};

export function inspectMenuVideo(mimeType: string, bytes: Uint8Array): string | null {
  if (bytes.length < 12 || bytes.length > MAX_MENU_VIDEO_BYTES) {
    return "Video 2.5 MB-dan böyük olmamalıdır.";
  }
  if (mimeType === "video/mp4") {
    if (String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") {
      return "MP4 video faylının quruluşu düzgün deyil.";
    }
  } else if (mimeType === "video/webm") {
    if (bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      return "WebM video faylının quruluşu düzgün deyil.";
    }
  } else {
    return "Yalnız MP4 və WebM video formatları dəstəklənir.";
  }
  return null;
}

export async function parseMenuVideoFile(
  input: FormDataEntryValue | null
): Promise<MenuVideoUpload | null> {
  if (input === null) return null;
  if (typeof input === "string" || !("arrayBuffer" in input)) {
    throw new Error("Video faylı düzgün seçilməyib.");
  }
  if (input.size === 0 && !input.name) return null;
  if (input.size > MAX_MENU_VIDEO_BYTES || input.size < 12) {
    throw new Error("Video faylının maksimum ölçüsü 2.5 MB-dır.");
  }
  const bytes = new Uint8Array(await input.arrayBuffer());
  const error = inspectMenuVideo(input.type, bytes);
  if (error) throw new Error(error);
  return {
    mimeType: input.type as MenuVideoUpload["mimeType"],
    sizeBytes: bytes.length,
    payload: bytes,
  };
}
