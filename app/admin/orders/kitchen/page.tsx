import { Suspense } from "react";
import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import KitchenScreenRefresh from "./KitchenScreenRefresh";
import {
  getKitchenPage,
  parseKitchenStatus,
  KITCHEN_STATUSES,
  kitchenPageUrl,
} from "@/app/lib/kitchen-pagination";

const ACTIVE_STATUSES: OrderStatus[] = [...KITCHEN_STATUSES];
const STATUS_LABELS: Record<string, string> = {
  NEW: "Yeni sifariş",
  CONFIRMED: "Təsdiqləndi",
  PREPARING: "Hazırlanır",
};

type KitchenScreenProps = {
  searchParams: Promise<{ page?: string | string[]; status?: string | string[] }>;
};

export default function KitchenScreenPage(props: KitchenScreenProps) {
  return (
    <Suspense fallback={<main className="p-8">Mətbəx sifarişləri yüklənir...</main>}>
      <KitchenScreenContent {...props} />
    </Suspense>
  );
}

async function KitchenScreenContent({ searchParams }: KitchenScreenProps) {
  const session = await getAdminSession();
  if (!session) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold">Giriş tələb olunur</h1>
        <Link className="text-blue-700 underline" href="/admin">Admin giriş səhifəsinə keç</Link>
      </main>
    );
  }

  // URL statusu yalnız məlum mətbəx statuslarından qəbul edilir.
  // Restoran ID-si həmişə serverdə təsdiqlənmiş sessiyadan götürülür.
  const query = await searchParams;
  const selectedStatus = parseKitchenStatus(query.status);
  const where: Prisma.OrderWhereInput = {
    restaurantId: session.restaurantId,
    status: selectedStatus ?? { in: ACTIVE_STATUSES },
  };
  const [restaurant, statusGroups] = await Promise.all([
    db.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: { name: true },
    }),
    db.order.groupBy({
      by: ["status"],
      where: { restaurantId: session.restaurantId, status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    }),
  ]);
  const counts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all])
  ) as Partial<Record<OrderStatus, number>>;
  const total = ACTIVE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const filteredCount = selectedStatus ? counts[selectedStatus] ?? 0 : total;
  const { page, pageCount, skip, take } = getKitchenPage(query.page, filteredCount);
  const orders = await db.order.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip,
    take,
    select: {
      id: true,
      createdAt: true,
      status: true,
      items: {
        select: { id: true, name: true, quantity: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!restaurant) {
    return <main className="p-8">Restoran tapılmadı.</main>;
  }

  const lateCutoff = Date.now() - 10 * 60 * 1000;
  return (
    <main className="min-h-screen space-y-6 bg-zinc-100 px-4 py-8 text-zinc-900 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-700">QR Menü · Mətbəx ekranı</p>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Hazırlanmalı sifarişlər: {total} · Seçim üzrə: {filteredCount} · Ən köhnələr əvvəl
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-semibold">
            ← Sifariş paneli
          </Link>
          <KitchenScreenRefresh />
        </div>
      </header>

      <nav aria-label="Mətbəx status filtrləri"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4">
        <Link href="/admin/orders/kitchen" aria-current={selectedStatus === null ? "page" : undefined}
          className={selectedStatus === null
            ? "rounded-lg bg-indigo-800 px-4 py-2 text-sm font-semibold text-white"
            : "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900"}>
          Hamısı ({total})
        </Link>
        {KITCHEN_STATUSES.map((status) => (
          <Link key={status} href={kitchenPageUrl(status, 1)}
            aria-current={selectedStatus === status ? "page" : undefined}
            className={selectedStatus === status
              ? "rounded-lg bg-indigo-800 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900"}>
            {STATUS_LABELS[status]} ({counts[status] ?? 0})
          </Link>
        ))}
      </nav>

      {filteredCount > 30 && (
        <p role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
          {skip + 1}–{skip + orders.length} / {filteredCount} sifariş · Səhifə {page} / {pageCount}.
          Əvvəlki və növbəti səhifə keçidlərindən istifadə edin.
        </p>
      )}
      {orders.length === 0 ? (
        <section className="rounded-xl bg-white p-8 text-center font-semibold">
          {selectedStatus
            ? "Bu statusda mətbəx sifarişi yoxdur."
            : "Hazırda mətbəxdə gözləyən sifariş yoxdur."}
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const isLate = order.status === "NEW" &&
              order.createdAt.getTime() < lateCutoff;
            return (
              <article key={order.id}
                className={isLate
                  ? "space-y-4 rounded-xl border-2 border-rose-500 bg-rose-50 p-5 shadow-sm"
                  : "space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-bold">#{order.id.slice(-8)}</h2>
                  <span className="rounded-lg bg-indigo-100 px-3 py-2 text-sm font-bold text-indigo-900">
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-sm text-zinc-600">
                  {order.createdAt.toLocaleString("az-AZ", { timeZone: "Asia/Baku" })}
                </p>
                {isLate && (
                  <p className="rounded-lg bg-rose-200 p-2 text-sm font-bold text-rose-950">
                    ⚠️ 10 dəqiqədən çoxdur təsdiq gözləyir
                  </p>
                )}
                <ul className="space-y-3 border-t border-zinc-200 pt-4">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-4 text-lg font-semibold">
                      <span className="break-words">{item.name}</span>
                      <strong className="shrink-0">{item.quantity} ×</strong>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
                  <Link
                    href={`/admin/orders?q=${encodeURIComponent(order.id.slice(-8))}`}
                    className="rounded-lg bg-indigo-800 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Sifarişi idarə et
                  </Link>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(order.id)}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900"
                  >
                    🖨️ Qəbzi çap et
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {filteredCount > 30 && (
        <nav aria-label="Mətbəx sifarişlərinin səhifələri"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          {page > 1 ? (
            <Link href={kitchenPageUrl(selectedStatus, page - 1)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold">
              ← Əvvəlki səhifə
            </Link>
          ) : (
            <span className="px-4 py-2 text-sm text-zinc-500">İlk səhifə</span>
          )}
          <span className="text-sm font-semibold">Səhifə {page} / {pageCount}</span>
          {page < pageCount ? (
            <Link href={kitchenPageUrl(selectedStatus, page + 1)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold">
              Növbəti səhifə →
            </Link>
          ) : (
            <span className="px-4 py-2 text-sm text-zinc-500">Son səhifə</span>
          )}
        </nav>
      )}
      <p className="text-xs text-zinc-600">
        Bu ekran yalnız oxumaq üçündür; status dəyişikliklərini əsas admin panelində edin.
        Müştəri telefonları, ünvanları və ödəniş məlumatları burada göstərilmir.
      </p>
    </main>
  );
}
