import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import { getDailyReport, parseReportRange } from "@/app/lib/superadmin-report";
import { buildDailyReportXlsx } from "@/app/lib/excel-report";

export async function GET(request: NextRequest) {
  // Serverdə yoxlanmış restoran sessiyası olmadan Excel ixracına icazə verilmir.
  const session = await getAdminSession();
  if (!session) {
    return new Response("Giriş tələb olunur.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const query = request.nextUrl.searchParams;
  const range = parseReportRange(query.get("from"), query.get("to"));
  if (!range) {
    return new Response("Tarix aralığı yanlışdır (maksimum 90 gün).", {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // URL-dən restoran/slug identifikatoru qəbul edilmir.
  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) {
    return new Response("Restoran tapılmadı.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const report = await getDailyReport(restaurant.id, range);
  // Şəxsi müştəri məlumatları, sifariş identifikatorları ixrac olunmur.
  const bytes = buildDailyReportXlsx(report.rows, report.totals);
  const filename =
    "qr-menu-" + restaurant.slug + "-" + range.from + "-" + range.to + ".xlsx";
  return new Response(Uint8Array.from(bytes).buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
