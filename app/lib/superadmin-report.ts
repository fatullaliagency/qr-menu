import "server-only";

import { db } from "@/app/lib/db";

// Bakı vaxt qurşağı hazırda UTC+04:00-dır və yay vaxtına keçmir.
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_REPORT_DAYS = 90;

export type ReportRange = {
  from: string;
  to: string;
  startUtc: Date;
  endUtc: Date;
  dates: string[];
};

export type ReportRow = {
  day: string;
  orders: number;
  newOrders: number;
  paidOrders: number;
  paidCents: number;
};

function bakuDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return [part("year"), part("month"), part("day")].join("-");
}

function parseDateKey(raw: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  if (year < 2000 || year > 2100) return null;
  const utc = Date.UTC(year, month - 1, day);
  const normalized = new Date(utc).toISOString().slice(0, 10);
  return normalized === raw ? utc : null;
}

export function parseReportRange(
  fromValue: string | null,
  toValue: string | null,
  now: Date = new Date()
): ReportRange | null {
  let from = fromValue;
  let to = toValue;
  if (from === null && to === null) {
    to = bakuDateKey(now);
    const today = parseDateKey(to);
    if (today === null) return null;
    from = new Date(today - 6 * DAY_MS).toISOString().slice(0, 10);
  }
  if (from === null || to === null) return null;
  const fromDay = parseDateKey(from);
  const toDay = parseDateKey(to);
  if (fromDay === null || toDay === null || toDay < fromDay) return null;

  const dayCount = Math.round((toDay - fromDay) / DAY_MS) + 1;
  if (dayCount < 1 || dayCount > MAX_REPORT_DAYS) return null;

  const dates = Array.from({ length: dayCount }, (_, index) =>
    new Date(fromDay + index * DAY_MS).toISOString().slice(0, 10)
  );

  return {
    from,
    to,
    startUtc: new Date(fromDay - BAKU_OFFSET_MS),
    endUtc: new Date(toDay + DAY_MS - BAKU_OFFSET_MS),
    dates,
  };
}

export async function getDailyReport(restaurantId: string, range: ReportRange) {
  const rows: ReportRow[] = range.dates.map((day) => ({
    day,
    orders: 0,
    newOrders: 0,
    paidOrders: 0,
    paidCents: 0,
  }));
  const byDate = new Map(rows.map((row) => [row.day, row]));

  // Şəxsi müştəri məlumatları ümumiyyətlə sorğulanmır.
  const orders = await db.order.findMany({
    where: {
      restaurantId,
      createdAt: { gte: range.startUtc, lt: range.endUtc },
    },
    select: {
      createdAt: true,
      status: true,
      paymentStatus: true,
      total: true,
    },
  });

  for (const order of orders) {
    const row = byDate.get(bakuDateKey(order.createdAt));
    if (!row) continue;
    row.orders += 1;
    if (order.status === "NEW") row.newOrders += 1;
    if (order.paymentStatus === "PAID") {
      row.paidOrders += 1;
      row.paidCents += Math.round(order.total.toNumber() * 100);
    }
  }

  const totals = rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      newOrders: sum.newOrders + row.newOrders,
      paidOrders: sum.paidOrders + row.paidOrders,
      paidCents: sum.paidCents + row.paidCents,
    }),
    { orders: 0, newOrders: 0, paidOrders: 0, paidCents: 0 }
  );
  return { rows, totals };
}

export function displayAzn(cents: number): string {
  return (cents / 100).toFixed(2) + " ₼";
}
