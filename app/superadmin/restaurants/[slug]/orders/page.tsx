import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { orderDestinationLabel } from "@/app/lib/fulfillment";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

export const metadata = {
  title: "Restoran sifarişləri | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

const ORDER_LABELS: Record<OrderStatus, string> = {
  NEW: "Yeni sifariş",
  CONFIRMED: "Təsdiqləndi",
  PREPARING: "Hazırlanır",
  ON_THE_WAY: "Çatdırılma yolundadır",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Ləğv edildi",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ödəniş gözlənilir",
  AWAITING_VERIFICATION: "Təsdiq gözlənilir",
  PAID: "Ödənilib",
  FAILED: "Uğursuz",
  REFUNDED: "Geri qaytarılıb",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Nağd",
  ONLINE_CARD: "Onlayn kart",
  MANUAL_TRANSFER: "Köçürmə",
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    status?: string | string[];
    payment?: string | string[];
  }>;
};

function getStatusFilter(value: string | string[] | undefined): OrderStatus | undefined {
  if (typeof value !== "string") return undefined;
  return Object.prototype.hasOwnProperty.call(ORDER_LABELS, value)
    ? (value as OrderStatus)
    : undefined;
}

function getPaymentMethodFilter(value: string | string[] | undefined): PaymentMethod | undefined {
  if (typeof value !== "string") return undefined;
  return Object.prototype.hasOwnProperty.call(METHOD_LABELS, value)
    ? (value as PaymentMethod)
    : undefined;
}

export default function SuperAdminRestaurantOrders(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantOrdersContent {...props} />
    </Suspense>
  );
}

async function RestaurantOrdersContent({ params, searchParams }: Props) {
  // Giriş yoxlanmadan heç bir restoran və sifariş sorğusu aparılmır.
  if (!(await hasSuperAdminSession())) {
    redirect("/superadmin");
  }

  const { slug } = await params;
  if (!slug || slug.length > 160) notFound();

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) notFound();

  const filters = await searchParams;
  const statusFilter = getStatusFilter(filters.status);
  const paymentFilter = getPaymentMethodFilter(filters.payment);

  const orderWhere = {
    restaurantId: restaurant.id,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(paymentFilter ? { paymentMethod: paymentFilter } : {}),
  };

  // Yalnız seçilmiş restorana aid və filtrə uyğun son 50 sifariş.
  // Müştərinin adı, telefonu, ünvanı, qeydi və izləmə tokeni alınmır.
  const [orders, statusGroups, paidTotals] = await Promise.all([
  db.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      status: true,
      fulfillmentType: true,
      tableNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      total: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          lineTotal: true,
        },
      },
    },
  }),
  db.order.groupBy({
    by: ["status"],
    where: { restaurantId: restaurant.id },
    _count: { _all: true },
  }),
  db.order.aggregate({
    where: { restaurantId: restaurant.id, paymentStatus: "PAID" },
    _sum: { total: true },
    _count: { _all: true },
  }),
  ]);
  const counts = Object.fromEntries(
    statusGroups.map((item) => [item.status, item._count._all])
  ) as Partial<Record<OrderStatus, number>>;
  const allOrders = statusGroups.reduce((sum, item) => sum + item._count._all, 0);

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {restaurant.name} — Sifarişlər
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Bu bölmə yalnız oxumaq üçündür və müştəri məlumatlarını göstərmir.
          </p>
        </div>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Sifariş statistikası</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-zinc-100 p-3">
              <p className="text-sm text-zinc-600">Cəmi sifariş</p>
              <p className="text-2xl font-bold">{allOrders}</p>
            </div>
            {(["NEW", "CONFIRMED", "PREPARING", "ON_THE_WAY", "DELIVERED", "CANCELLED"] as const).map((status) => (
              <div key={status} className="rounded-lg bg-zinc-100 p-3">
                <p className="text-sm text-zinc-600">{ORDER_LABELS[status]}</p>
                <p className="text-2xl font-bold">{counts[status] ?? 0}</p>
              </div>
            ))}
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-sm text-emerald-800">Ödənişi təsdiqlənən</p>
              <p className="text-2xl font-bold">{paidTotals._count._all}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-sm text-emerald-800">Təsdiqli ödəniş məbləği</p>
              <p className="text-2xl font-bold">
                {paidTotals._sum.total?.toString() ?? "0.00"} ₼
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Məbləğ yalnız PAID statuslu sifarişlərin sistemdə qeydə alınmış cəmidir;
            bank köçürməsi və ya hesablaşma təsdiqi deyil.
          </p>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Sifarişləri filtrlə</h2>
          <form
            key={`${statusFilter ?? "ALL"}:${paymentFilter ?? "ALL"}`}
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <label htmlFor="order-status" className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
              Sifariş statusu
              <select
                id="order-status"
                name="status"
                defaultValue={statusFilter ?? "ALL"}
                className="rounded-lg border border-zinc-300 bg-white p-2"
              >
                <option value="ALL">Bütün statuslar</option>
                {(Object.keys(ORDER_LABELS) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>{ORDER_LABELS[status]}</option>
                ))}
              </select>
            </label>
            <label htmlFor="payment-method" className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
              Ödəniş üsulu
              <select
                id="payment-method"
                name="payment"
                defaultValue={paymentFilter ?? "ALL"}
                className="rounded-lg border border-zinc-300 bg-white p-2"
              >
                <option value="ALL">Bütün üsullar</option>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <option key={method} value={method}>{METHOD_LABELS[method]}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Filtrlə
            </button>
            <Link
              href={`/superadmin/restaurants/${encodeURIComponent(restaurant.slug)}/orders`}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold"
            >
              Sıfırla
            </Link>
          </form>
          <p className="mt-3 text-xs text-zinc-600">
            Filtrə uyğun {orders.length} sifariş göstərilir (maksimum son 50).
            Yuxarıdakı statistika isə restoranın bütün sifarişlərini əhatə edir.
          </p>
        </section>
        {orders.length === 0 && (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            Seçilmiş filtrlərə uyğun sifariş tapılmadı.
          </div>
        )}

        {orders.map((order) => (
          <article key={order.id} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Sifariş #{order.id.slice(-8)}</h2>
              <span className="text-sm text-zinc-600">
                {order.createdAt.toLocaleString("az-AZ", {
                  timeZone: "Asia/Baku",
                })}
              </span>
            </div>
            <div className="grid gap-2 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-2">
              <p><strong>Yer və xidmət:</strong> {orderDestinationLabel(order.fulfillmentType, order.tableNumber)}</p>
              <p><strong>Sifariş:</strong> {ORDER_LABELS[order.status]}</p>
              <p><strong>Ödəniş:</strong> {PAYMENT_LABELS[order.paymentStatus]}</p>
              <p><strong>Ödəniş üsulu:</strong> {METHOD_LABELS[order.paymentMethod]}</p>
              <p><strong>Ümumi məbləğ:</strong> {order.total.toString()} ₼</p>
            </div>
            <div className="border-t pt-3">
              <h3 className="mb-2 text-sm font-semibold">Məhsullar</h3>
              {order.items.length === 0 ? (
                <p className="text-sm text-zinc-500">Məhsul qeydi yoxdur.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.name} — {item.lineTotal.toString()} ₼
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
