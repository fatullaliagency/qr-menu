import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import {
  displayAzn,
  getDailyReport,
  MAX_REPORT_DAYS,
  parseReportRange,
} from "@/app/lib/superadmin-report";

export const metadata = {
  title: "Gündəlik sifariş hesabatı | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
};

export default function RestaurantAnalyticsPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantAnalyticsContent {...props} />
    </Suspense>
  );
}

async function RestaurantAnalyticsContent({ params, searchParams }: Props) {
  // Heç bir restoran və sifariş məlumatı oxunmadan Super Admin icazəsi yoxlanır.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) notFound();
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) notFound();

  const query = await searchParams;
  const fromValue = typeof query.from === "string" ? query.from : null;
  const toValue = typeof query.to === "string" ? query.to : null;
  const range = parseReportRange(fromValue, toValue);

  const basePath =
    "/superadmin/restaurants/" + encodeURIComponent(restaurant.slug) + "/analytics";
  const exportPath = range ? basePath + "/export" : null;

  const report = range ? await getDailyReport(restaurant.id, range) : null;
  const inputClass = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900";

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm font-medium text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {restaurant.name} — Gündəlik sifariş hesabatı
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Restoran: {restaurant.slug}. Tarixlər Bakı vaxtı ilədir.
            Bu hesabat yalnız baxış üçündür.
          </p>
          <Link
            href={"/superadmin/restaurants/" + encodeURIComponent(restaurant.slug) + "/orders"}
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
          >
            Sifarişlərin siyahısına bax
          </Link>
        </header>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Hesabat tarixlərini seç</h2>
          <p className="mt-1 text-sm text-zinc-600">
            1–{MAX_REPORT_DAYS} gün seçə bilərsiniz. Seçim edilmədikdə son 7 gün göstərilir.
          </p>
          <form method="get" action={basePath}
            className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[160px] flex-1 text-sm font-medium">
              Başlanğıc tarixi
              <input type="date" name="from" required
                defaultValue={range?.from ?? fromValue ?? ""}
                className={inputClass} />
            </label>
            <label className="min-w-[160px] flex-1 text-sm font-medium">
              Bitmə tarixi
              <input type="date" name="to" required
                defaultValue={range?.to ?? toValue ?? ""}
                className={inputClass} />
            </label>
            <button type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
              Hesabatı göstər
            </button>
            <Link href={basePath}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium">
              Son 7 gün
            </Link>
          </form>
          {!range && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              Tarix aralığı düzgün deyil. Başlanğıc tarix bitmə tarixindən sonra
              olmamalıdır və aralıq maksimum {MAX_REPORT_DAYS} gün ola bilər.
            </p>
          )}
          {range && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-zinc-700">
                Dövr: <strong>{range.from} — {range.to}</strong>
              </p>
              <form method="post" action={exportPath ?? undefined}>
                <input type="hidden" name="from" value={range.from} />
                <input type="hidden" name="to" value={range.to} />
                <button type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                  Excel faylını (.xlsx) yüklə
                </button>
              </form>
            </div>
          )}
        </section>

        {range && report && (
          <>
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-600">Seçilmiş dövrdə sifariş</p>
                <p className="mt-1 text-3xl font-bold">{report.totals.orders}</p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-600">Ödənişi təsdiqlənmiş məbləğ</p>
                <p className="mt-1 text-3xl font-bold">{displayAzn(report.totals.paidCents)}</p>
              </div>
            </section>

            <section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Günlər üzrə göstəricilər</h2>
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b text-zinc-600">
                    <th className="p-3">Tarix</th>
                    <th className="p-3">Sifariş sayı</th>
                    <th className="p-3">Hazırda yeni</th>
                    <th className="p-3">Ödənişi təsdiqlənən</th>
                    <th className="p-3">Təsdiqlənmiş məbləğ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.rows].reverse().map((row) => (
                    <tr key={row.day} className="border-b last:border-0">
                      <td className="whitespace-nowrap p-3 font-medium">
                        {row.day.split("-").reverse().join(".")}
                      </td>
                      <td className="p-3">{row.orders}</td>
                      <td className="p-3">{row.newOrders}</td>
                      <td className="p-3">{row.paidOrders}</td>
                      <td className="whitespace-nowrap p-3">{displayAzn(row.paidCents)}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50 font-semibold">
                    <td className="p-3">Cəmi</td>
                    <td className="p-3">{report.totals.orders}</td>
                    <td className="p-3">{report.totals.newOrders}</td>
                    <td className="p-3">{report.totals.paidOrders}</td>
                    <td className="whitespace-nowrap p-3">
                      {displayAzn(report.totals.paidCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {report.totals.orders === 0 && (
                <p className="mt-3 text-sm text-zinc-600">
                  Bu tarix aralığında sifariş yoxdur.
                </p>
              )}
            </section>

            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
              Məbləğlər həmin gün yaradılmış, hazırda PAID statuslu sifarişlərə əsaslanır.
              Bu, pulun banka daxilolma tarixi və ya bankla üzləşdirilmiş maliyyə hesabatı deyil.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
