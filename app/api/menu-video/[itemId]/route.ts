import type { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { parseVideoRange } from "@/app/lib/video-range";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ itemId: string }> };

function notFoundVideo() {
  return new Response("Video tapılmadı.", {
    status: 404, headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Product clips are public media, but bytes are not loaded in menu listings. */
export async function GET(request: NextRequest, { params }: Props): Promise<Response> {
  const { itemId } = await params;
  if (!/^[a-z0-9-]{10,150}$/.test(itemId)) return notFoundVideo();
  const video = await db.menuItemVideo.findUnique({
    where: { menuItemId: itemId },
    select: { mimeType: true, payload: true, sizeBytes: true },
  });
  if (!video || !["video/mp4", "video/webm"].includes(video.mimeType) ||
    video.payload.byteLength !== video.sizeBytes) return notFoundVideo();

  const total = video.payload.byteLength;
  const parsed = parseVideoRange(request.headers.get("range"), total);
  const headers = new Headers({
    "Content-Type": video.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
  if (parsed === "invalid") {
    headers.set("Content-Range", "bytes */" + total);
    return new Response(null, { status: 416, headers });
  }
  const start = parsed?.start ?? 0;
  const end = parsed?.end ?? total - 1;
  const data = Uint8Array.from(video.payload.subarray(start, end + 1));
  headers.set("Content-Length", String(data.byteLength));
  if (parsed) headers.set("Content-Range", "bytes " + start + "-" + end + "/" + total);
  // The bytes are intentionally limited to 2.5MiB, safely below Vercel's response cap.
  return new Response(data.buffer as ArrayBuffer, { status: parsed ? 206 : 200, headers });
}

export async function HEAD(request: NextRequest, context: Props): Promise<Response> {
  const result = await GET(request, context);
  return new Response(null, { status: result.status, headers: result.headers });
}
