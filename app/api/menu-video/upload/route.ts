import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/app/lib/admin-auth";
import { MAX_MENU_VIDEO_BYTES } from "@/app/lib/menu-video";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getAdminSession();
        if (!session || clientPayload !== session.restaurantId ||
            !new RegExp("^menu-videos/" + session.restaurantId + "/[a-zA-Z0-9_-]{1,160}\\.(mp4|webm)$").test(pathname)) {
          throw new Error("Video yükləmək üçün giriş icazəsi yoxdur.");
        }
        return {
          allowedContentTypes: ["video/mp4", "video/webm"],
          maximumSizeInBytes: MAX_MENU_VIDEO_BYTES,
          addRandomSuffix: true,
          tokenPayload: session.restaurantId,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!blob.pathname.startsWith("menu-videos/" + tokenPayload + "/")) throw new Error("Video yolu uyğun deyil.");
      },
    });
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Video yüklənmədi." }, { status: 400 });
  }
}
