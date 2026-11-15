import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import { parseEnterpriseFilters, matchesEnterpriseSearch } from "@/app/lib/enterprise-filters";
import {
  hasSuperAdminSession,
  isSuperAdminEnabled,
} from "@/app/lib/superadmin-auth";
import { loginSuperAdmin } from "./actions";

export const metadata = {
  title: "Super Admin | QR Menü",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ error?: string | string[]; q?: string | string[]; type?: string | string[] }>;
};

export default function SuperAdminPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <SuperAdminContent {...props} />
    </Suspense>
  );
}

async function SuperAdminContent({ searchParams }: Props) {
  if (!isSuperAdminEnabled()) {
    return (
      <main className="min-h-screen bg-zinc-100 p-8 text-zinc-900">
        <div className="mx-auto max-w-lg rounded-xl bg-white p-6">
          <h1 className="text-xl font-bold">Super Admin deaktivdir</h1>
          <p className="mt-3 text-sm">
            Bu panel yalnız ayrıca icazə verilmiş test mühitində aktivləşdirilir.
          </p>
        </div>
      </main>
    );
  }

  if (!(await hasSuperAdminSession())) {
    const query = await searchParams;
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-amber-600/40 bg-zinc-900 p-6">
          <h1 className="mb-2 text-2xl font-bold text-amber-400">
            QR Menü — Super Admin
          </h1>
          <p className="mb-5 text-sm text-zinc-300">
            Restoran və otellərin idarəetməsi üçün ayrıca giriş açarı tələb olunur.
          </p>
          <form action={loginSuperAdmin} className="space-y-4">
            <label className="block text-sm">
              Super Admin giriş açarı
              <input
                type="password"
                name="accessKey"
                required
                minLength={32}
                maxLength={256}
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-950 p-3 text-white"
              />
            </label>
            {query.error === "1" && (
              <p role="alert" className="text-sm text-red-300">
                Giriş açarı yanlışdır.
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-amber-400 p-3 font-bold text-zinc-950"
            >
              Super Admin kimi daxil ol
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Sifarişləri yalnız say və ödəniş vəziyyəti üzrə toplayırıq:
  // müştəri adı, telefon və ünvanı ilkin icmalda göstərilmir.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [restaurants, orderGroups, paymentGroups, recentGroups, paidAmounts, categoryGroups, menuItemGroups] = await Promise.all([
    db.restaurant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.order.groupBy({
      by: ["restaurantId", "status"],
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["restaurantId", "paymentStatus"],
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["restaurantId"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["restaurantId"],
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    db.category.groupBy({
      by: ["restaurantId"],
      _count: { _all: true },
    }),
    db.menuItem.groupBy({
      by: ["restaurantId"],
      _count: { _all: true },
    }),
  ]);

  const overview = restaurants.map((restaurant) => {
    const statuses = orderGroups.filter(
      (group) => group.restaurantId === restaurant.id
    );
    const payments = paymentGroups.filter(
      (group) => group.restaurantId === restaurant.id
    );
    return {
      ...restaurant,
      total: statuses.reduce((sum, group) => sum + group._count._all, 0),
      newOrders:
        statuses.find((group) => group.status === "NEW")?._count._all ?? 0,
      paid:
        payments.find((group) => group.paymentStatus === "PAID")?._count._all ??
        0,
      lastSevenDays:
        recentGroups.find((group) => group.restaurantId === restaurant.id)?._count._all ?? 0,
      paidTotal:
        paidAmounts.find((group) => group.restaurantId === restaurant.id)?._sum.total?.toString() ?? "0.00",
      categoryCount:
        categoryGroups.find((group) => group.restaurantId === restaurant.id)?._count._all ?? 0,
      menuItemCount:
        menuItemGroups.find((group) => group.restaurantId === restaurant.id)?._count._all ?? 0,
    };
  });

  const totalOrders = overview.reduce((sum, restaurant) => sum + restaurant.total, 0);
  const totalPaid = overview.reduce((sum, restaurant) => sum + restaurant.paid, 0);
  const recentOrders = overview.reduce((sum, restaurant) => sum + restaurant.lastSevenDays, 0);

  // The search and type filter affect visible businesses, not summary totals.
  const query = await searchParams;
  const hotelEnabled = hotelModuleEnabled();
  const { search, normalized, type } = parseEnterpriseFilters(query, hotelEnabled);
  const hotels = hotelEnabled
    ? await db.hotel.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, branchName: true, roomCount: true },
      })
    : [];
  const hotelGroups = hotelEnabled
    ? await db.hotelOrder.groupBy({ by: ["hotelId"], _count: { _all: true } })
    : [];
  const hotelCharges = hotelEnabled
    ? await db.hotelRoomCharge.groupBy({
        by: ["hotelId", "status"], _count: { _all: true }, _sum: { amount: true }
      })
    : [];
  const approvedHotelChargeAmount = hotelCharges
    .filter(x => x.status === "APPROVED")
    .reduce((sum, x) => sum.add(x._sum.amount ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));

  const visibleHotels = type === "restaurant"
    ? []
    : hotels.filter((hotel) => matchesEnterpriseSearch(hotel, normalized));
  const visibleRestaurants = type === "hotel"
    ? []
    : overview.filter((restaurant) => matchesEnterpriseSearch(restaurant, normalized));

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">QR Menü — Super Admin</h1>
            <p className="text-sm text-zinc-600">
              Restoran və otellərin vahid idarəetmə icmalı
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/superadmin/new"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              + Yeni müəssisə
            </Link>
            <form action="/superadmin/logout" method="post">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Çıxış
              </button>
            </form>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {hotelModuleEnabled()&&<div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-zinc-600">Otel sayı</p><p className="text-3xl font-bold">{hotels.length}</p></div>}
          {hotelEnabled&&<div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Otel sifarişlərinin sayı</p>
            <p className="text-3xl font-bold">{hotelGroups.reduce((n,x)=>n+x._count._all,0)}</p>
          </div>}
          {hotelEnabled&&<div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Otel: təsdiqli daxili otaq hesabı (bank gəliri deyil)</p>
            <p className="text-3xl font-bold">{approvedHotelChargeAmount.toFixed(2)} ₼</p>
          </div>}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Restoran sayı</p>
            <p className="text-3xl font-bold">{restaurants.length}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Ümumi sifariş sayı</p>
            <p className="text-3xl font-bold">{totalOrders}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Son 7 gündə sifarişlər</p>
            <p className="text-3xl font-bold">{recentOrders}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-zinc-600">Ödənişi təsdiqlənmiş sifarişlər</p>
            <p className="text-3xl font-bold">{totalPaid}</p>
          </div>
        </div>
        <section className="overflow-x-auto rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Restoranların sifariş icmalı</h2>
          <p className="mb-3 text-xs text-zinc-600">
            Məbləğlər yalnız ödəniş statusu PAID olan sifarişlər üzrə hesablanır.
            Bu göstəricilər bank hesabı ilə üzləşdirilmiş maliyyə hesabatı deyil.
          </p>
          <form action="/superadmin" method="get" role="search"
            className="mb-3 flex flex-wrap items-end gap-3">
            <label htmlFor="restaurant-search" className="flex-1 text-sm font-medium">
              Müəssisə adı və ya URL adına görə axtar
              <input id="restaurant-search" type="search" name="q"
                maxLength={80} defaultValue={search}
                placeholder="Məsələn: testrestoran"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900" />
            </label>
            {hotelEnabled && (
              <label htmlFor="enterprise-type" className="text-sm font-medium">
                Müəssisə tipi
                <select
                  id="enterprise-type"
                  name="type"
                  defaultValue={type}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900"
                >
                  <option value="all">Hamısı</option>
                  <option value="restaurant">Restoran</option>
                  <option value="hotel">Otel</option>
                </select>
              </label>
            )}
            <button type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
              Axtar
            </button>
            <Link href="/superadmin"
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium">
              Sıfırla
            </Link>
          </form>
          {(search||type!=="all") && (
            <p role="status" className="mb-3 text-sm text-zinc-600">
              Axtarış nəticəsi: {visibleRestaurants.length+visibleHotels.length} müəssisə
            </p>
          )}
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-600">
                <th className="p-3">Restoran</th>
                <th className="p-3">Tip</th>
                <th className="p-3">Kateqoriya</th>
                <th className="p-3">Məhsul</th>
                <th className="p-3">Cəmi sifariş</th>
                <th className="p-3">Yeni sifariş</th>
                <th className="p-3">Son 7 gün</th>
                <th className="p-3">Ödənişi təsdiqlənən</th>
                <th className="p-3">Təsdiqli ödənişlərin cəmi</th>
              </tr>
            </thead>
            <tbody>
              {visibleRestaurants.map((restaurant) => (
                <tr key={restaurant.id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">
                    {restaurant.name}
                    <span className="block text-xs font-normal text-zinc-500">
                      {restaurant.slug}
                    </span>
                    <Link
                      href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/orders`}
                      className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      Sifarişlərə bax
                    </Link>
                    <Link
                      href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/analytics`}
                      className="mt-2 ml-4 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      7 günlük hesabat
                    </Link>
                    <Link
                      href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/menu`}
                      className="mt-2 ml-4 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      Menyuya bax
                    </Link>
                    <Link
                      href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/payment-settings`}
                      className="mt-2 ml-4 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      VÖEN və ödəniş ayarları
                    </Link>
                    <Link
                      href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/edit`}
                      className="mt-2 ml-4 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      Restoranı düzəlt
                    </Link>
                  </td>
                  <td className="p-3">Restoran</td>
                  <td className="p-3">{restaurant.categoryCount}</td>
                  <td className="p-3">{restaurant.menuItemCount}</td>
                  <td className="p-3">{restaurant.total}</td>
                  <td className="p-3">{restaurant.newOrders}</td>
                  <td className="p-3">{restaurant.lastSevenDays}</td>
                  <td className="p-3">{restaurant.paid}</td>
                  <td className="p-3 whitespace-nowrap">{restaurant.paidTotal} ₼</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRestaurants.length === 0 && (
            <p className="p-3 text-zinc-600">
              {search ? "Axtarışa uyğun restoran tapılmadı." : "Restoran qeydi yoxdur."}
            </p>
          )}
        </section>
        {hotelModuleEnabled()&&<section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Otellər</h2>
            <Link href="/superadmin/hotels/new" className="text-sm text-blue-700 underline">Yeni otel yarat</Link>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-3">Müəssisə</th><th className="p-3">Tip</th><th className="p-3">Otaqlar</th><th className="p-3">Sifarişlər</th><th className="p-3">Daxili təsdiq (₼)</th><th className="p-3">Admin</th></tr></thead>
            <tbody>{visibleHotels.map(h=><tr key={h.id} className="border-b">
              <td className="p-3"><strong>{h.name}</strong><span className="block text-xs text-zinc-500">{h.branchName} · {h.slug}</span></td>
              <td className="p-3">Otel</td><td className="p-3">{h.roomCount}</td>
              <td className="p-3">{hotelGroups.find(g=>g.hotelId===h.id)?._count._all??0}</td>
              <td className="p-3">{hotelCharges.filter(g=>g.hotelId===h.id&&g.status==="APPROVED")
                .reduce((sum,g)=>sum.add(g._sum.amount??new Prisma.Decimal(0)),new Prisma.Decimal(0)).toFixed(2)}</td>
              <td className="p-3"><Link className="text-blue-700 underline" href="/hotel-admin">Otel paneli</Link></td>
            </tr>)}</tbody>
          </table>
          {visibleHotels.length===0&&<p className="mt-3 text-sm text-zinc-500">Bu seçim üzrə otel tapılmadı.</p>}
        </section>}
      </div>
    </main>
  );
}
