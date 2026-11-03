import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import {
  getDailyReport,
  parseReportRange,
} from "@/app/lib/superadmin-report";
import { buildDailyReportXlsx } from "@/app/lib/excel-report";

type Context = { params: Promise<{ slug: string }> };

export async function GET() {
  // Əvvəlki birbaşa GET yükləməsi təhlükəsizlik məqsədilə deaktivdir.
  return new Response("Excel ixracı yalnız admin panelindəki düymə ilə mümkündür.", {
    status: 405,
    headers: {
      "Allow": "POST",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest, { params }: Context) {
  // İxrac üçün də server səviyyəsində Super Admin icazəsi tələb olunur.
  if (!(await hasSuperAdminSession())) {
    return new Response("Giriş tələb olunur.", {
      status: 401,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    });
  }

  // Sadə link və kənar saytdan sorğular yox, yalnız eyni saytdakı form.
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin || requestOrigin !== request.nextUrl.origin) {
    return new Response("Bu mənbədən ixraca icazə verilmir.", {
      status: 403,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return new Response("Forma formatı yanlışdır.", {
      status: 415,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    });
  }

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) {
    return new Response("Restoran tapılmadı.", { status: 404 });
  }

  const form = await request.formData();
  const from = form.get("from");
  const to = form.get("to");
  const range = parseReportRange(typeof from === "string" ? from : null, typeof to === "string" ? to : null);
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
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
