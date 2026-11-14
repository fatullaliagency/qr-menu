import { NextRequest, NextResponse } from "next/server";
import { hotelRuntimeSecureCookie } from "@/app/lib/hotel-cookie-policy";

// Browser POST-redirect-GET logout. ResponseCookies writes Set-Cookie directly
// to the outgoing HTTP response, avoiding revalidation/streaming races.
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const requestOrigin = req.nextUrl.origin;
  const site = req.headers.get("sec-fetch-site");
  // Browsers can omit Origin on navigation POSTs (and proxies can rewrite
  // the internal origin). Sec-Fetch-Site is a browser-controlled forbidden
  // request header and is authoritative when present.
  const sameOriginBrowser = site === "same-origin" || site === "none";
  const sameOriginLegacy = site === null && origin === requestOrigin;
  if (!sameOriginBrowser && !sameOriginLegacy) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const response = NextResponse.redirect(new URL("/superadmin", req.url), { status: 303 });
  response.cookies.set("qr_superadmin_session", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: hotelRuntimeSecureCookie(),
    path: "/superadmin",
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
