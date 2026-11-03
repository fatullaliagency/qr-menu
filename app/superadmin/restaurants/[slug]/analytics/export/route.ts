import { NextRequest } from "next/server";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import {
  getDailyReport,
  parseReportRange,
} from "@/app/lib/superadmin-report";

type Context = { params: Promise<{ slug: string }> };

function csvAmount(cents: number): string {
  // Azərbaycanca Excel üçün vergül onluq ayırıcıdır.
  return (cents / 100).toFixed(2).replace(".", ",");
}

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
  // CSV faylında müştərinin adı, telefonu, ünvanı və sifariş identifikatoru yoxdur.
  const rows = [
    "sep=;",
    "Tarix;Sifariş sayı;Hazırda yeni;Ödənişi təsdiqlənən;Təsdiqlənmiş məbləğ (AZN)",
    ...report.rows.map((row) =>
      [
        row.day,
        row.orders,
        row.newOrders,
        row.paidOrders,
        csvAmount(row.paidCents),
      ].join(";")
    ),
    [
      "Cəmi",
      report.totals.orders,
      report.totals.newOrders,
      report.totals.paidOrders,
      csvAmount(report.totals.paidCents),
    ].join(";"),
  ];

  const filename = "qr-menu-" + slug + "-" + range.from + "-" + range.to + ".csv";
  return new Response("\uFEFF" + rows.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
