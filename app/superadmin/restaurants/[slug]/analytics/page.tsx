import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";

export const metadata = {
  title: "Gündəlik sifariş hesabatı | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string }> };

type DailyRow = {
  day: string;
  orders: number;
  newOrders: number;
  paidOrders: number;
  paidCents: number;
};

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

function bakuDateKey(date: Date): string {
  // Asia/Baku yerli tarixi: gün/ay/il hissələri locale formatından asılı deyil.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const val = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return val("year") + "-" + val("month") + "-" + val("day");
}

export default function RestaurantAnalyticsPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantAnalyticsContent {...props} />
    </Suspense>
  );
}

async function RestaurantAnalyticsContent({ params }: Props) {
  // Heç bir restoran və sifariş məlumatı oxunmadan Super Admin icazəsi yoxlanır.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) notFound();

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) notFound();

  // Son 7 Bakı təqvim günü (bugün daxil). Heç bir şəxsi müştəri məlumatı oxunmur.
  const [year, month, day] = bakuDateKey(new Date()).split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day - 6) - BAKU_OFFSET_MS);
  const rows: DailyRow[] = Array.from({ length: 7 }, (_, index) => ({
    day: new Date(Date.UTC(year, month - 1, day - 6 + index)).toISOString().slice(0, 10),
    orders: 0,
    newOrders: 0,
    paidOrders: 0,
    paidCents: 0,
  }));
  const byDate = new Map(rows.map((row) => [row.day, row]));

  const orders = await db.order.findMany({
    where: {
      restaurantId: restaurant.id,
      createdAt: { gte: startUtc },
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
  const azn = (cents: number) => (cents / 100).toFixed(2) + " ₼";

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm font-medium text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {restaurant.name} — 7 günlük sifariş hesabatı
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Restoran: {restaurant.slug}. Tarixlər Bakı vaxtı ilədir. Hesabat yalnız baxış üçündür.
          </p>
          <Link
            href={"/superadmin/restaurants/" + encodeURIComponent(restaurant.slug) + "/orders"}
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
          >
            Sifarişlərin siyahısına bax
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Son 7 gündə sifariş</p>
            <p className="mt-1 text-3xl font-bold">{totals.orders}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Ödənişi təsdiqlənmiş məbləğ</p>
            <p className="mt-1 text-3xl font-bold">{azn(totals.paidCents)}</p>
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
              {[...rows].reverse().map((row) => (
                <tr key={row.day} className="border-b last:border-0">
                  <td className="whitespace-nowrap p-3 font-medium">
                    {row.day.split("-").reverse().join(".")}
                  </td>
                  <td className="p-3">{row.orders}</td>
                  <td className="p-3">{row.newOrders}</td>
                  <td className="p-3">{row.paidOrders}</td>
                  <td className="whitespace-nowrap p-3">{azn(row.paidCents)}</td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold">
                <td className="p-3">Cəmi</td>
                <td className="p-3">{totals.orders}</td>
                <td className="p-3">{totals.newOrders}</td>
                <td className="p-3">{totals.paidOrders}</td>
                <td className="whitespace-nowrap p-3">{azn(totals.paidCents)}</td>
              </tr>
            </tbody>
          </table>
          {totals.orders === 0 && (
            <p className="mt-3 text-sm text-zinc-600">
              Bu tarix aralığında sifariş yoxdur.
            </p>
          )}
        </section>

        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          Məbləğlər həmin gün yaradılmış, hazırda PAID statuslu sifarişlərə əsaslanır.
          Bu, pulun banka daxilolma tarixi və ya bankla üzləşdirilmiş maliyyə hesabatı deyil.
        </p>
      </div>
    </main>
  );
}
