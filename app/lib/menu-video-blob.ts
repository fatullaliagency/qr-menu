import { head } from "@vercel/blob";
import { encodeVideoBlob, inspectMenuVideo, isVideoBlobUrl, MAX_MENU_VIDEO_BYTES } from "./menu-video";

export async function verifyUploadedVideo(input: FormDataEntryValue | null, restaurantId: string) {
  if (input === null || input === "") return null;
  if (typeof input !== "string" || !isVideoBlobUrl(input, restaurantId)) throw new Error("Video keçidi düzgün deyil.");
  const blob = await head(input);
  if (blob.pathname !== new URL(input).pathname.slice(1) || blob.size < 12 ||
      blob.size > MAX_MENU_VIDEO_BYTES || !["video/mp4", "video/webm"].includes(blob.contentType)) {
    throw new Error("Videonun ölçüsü və formatı düzgün deyil.");
  }
  // Fetch only a small header range; do not proxy the video through a function.
  const response = await fetch(input, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
  if (response.status !== 206) throw new Error("Video quruluşunu yoxlamaq olmadı.");
  const problem = inspectMenuVideo(blob.contentType, new Uint8Array(await response.arrayBuffer()));
  if (problem) throw new Error(problem);
  return encodeVideoBlob(input, blob.contentType as "video/mp4" | "video/webm", blob.size);
}
