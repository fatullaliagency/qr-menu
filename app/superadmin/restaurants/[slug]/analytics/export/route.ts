import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import {
  getDailyReport,
  parseReportRange,
} from "@/app/lib/superadmin-report";
import { buildDailyReportXlsx } from "@/app/lib/excel-report";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  // İxrac üçün də server səviyyəsində Super Admin icazəsi tələb olunur.
  if (!(await hasSuperAdminSession())) {
    return new Response("Giriş tələb olunur.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) {
    return new Response("Restoran tapılmadı.", { status: 404 });
  }

  const url = request.nextUrl.searchParams;
  const range = parseReportRange(url.get("from"), url.get("to"));
  if (!range) {
    return new Response("Tarix aralığı yanlışdır (maksimum 90 gün).", { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!restaurant) return new Response("Restoran tapılmadı.", { status: 404 });

  const report = await getDailyReport(restaurant.id, range);
  // Azərbaycanca başlıqlar və tarixlər Excel-də düzgün göstərilir.
  // Şəxsi müştəri məlumatları bu fayla daxil edilmir.
  const bytes = buildDailyReportXlsx(report.rows, report.totals);
  const filename = "qr-menu-" + slug + "-" + range.from + "-" + range.to + ".xlsx";
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
