
import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import OrdersAutoRefresh from "./OrdersAutoRefresh";

type OrdersPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Yeni sifariş",
  CONFIRMED: "Təsdiqləndi",
  PREPARING: "Hazırlanır",
  ON_THE_WAY: "Çatdırılma yolundadır",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Ləğv edildi",
};

const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_BUTTON_LABELS: Record<OrderStatus, string> = {
  NEW: "Yeni",
  CONFIRMED: "✓ Sifarişi təsdiqlə",
  PREPARING: "Hazırlanmağa başladı",
  ON_THE_WAY: "Çatdırılmaya göndər",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Sifarişi ləğv et",
};

function isOrderStatus(
  value: FormDataEntryValue | null
): value is OrderStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(NEXT_STATUSES, value)
  );
}

async function updateOrderStatus(formData: FormData) {
  "use server";

  const session = await getAdminSession();
  if (!session) {
    throw new Error("Giriş tələb olunur.");
  }

  const orderId = formData.get("orderId");
  const currentStatus = formData.get("currentStatus");
  const nextStatus = formData.get("nextStatus");

  if (
    typeof orderId !== "string" ||
    orderId.length < 1 ||
    orderId.length > 150 ||
    !isOrderStatus(currentStatus) ||
    !isOrderStatus(nextStatus) ||
    !NEXT_STATUSES[currentStatus].includes(nextStatus)
  ) {
    throw new Error("Sifariş statusu üçün yanlış sorğu.");
  }

  const result = await db.order.updateMany({
    where: {
      id: orderId,
      restaurantId: session.restaurantId,
      status: currentStatus,
    },
    data: { status: nextStatus },
  });

  if (result.count !== 1) {
    throw new Error(
      "Sifariş tapılmadı və ya status artıq dəyişdirilib. Səhifəni yeniləyin."
    );
  }

  revalidatePath("/admin/orders");
}

// Nağd pul həqiqətən təhvil alındıqdan sonra restoran admini təsdiqləyir.
// Bu əməliyyat sifarişin çatdırılması ilə avtomatik işləmir.
async function confirmCashPayment(formData: FormData) {
  "use server";

  const session = await getAdminSession();
  if (!session) {
    throw new Error("Giriş tələb olunur.");
  }

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || orderId.length < 1 || orderId.length > 150) {
    throw new Error("Yanlış sifariş.");
  }

  const result = await db.order.updateMany({
    where: {
      id: orderId,
      restaurantId: session.restaurantId,
      status: "DELIVERED",
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
    },
    data: { paymentStatus: "PAID" },
  });

  if (result.count !== 1) {
    throw new Error("Ödəniş yenilənmədi. Sifarişi yeniləyib yoxlayın.");
  }

  revalidatePath("/admin/orders");
}

export default function OrdersPage(props: OrdersPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <OrdersContent {...props} />
    </Suspense>
  );
}

async function OrdersContent({ searchParams }: OrdersPageProps) {
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-bold">Giriş tələb olunur</h1>
        <Link href="/admin" className="text-blue-600 underline">
          Admin giriş səhifəsinə keç
        </Link>
      </main>
    );
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { name: true, slug: true },
  });

  if (!restaurant) {
    return <main className="p-8">Restoran tapılmadı.</main>;
  }

  // Status yalnız əvvəlcədən icazə verilmiş OrderStatus dəyərlərindən biridir.
  // Restoran ID-si isə heç vaxt URL-dən deyil, yalnız admin sessiyasından gəlir.
  const query = await searchParams;
  const requestedStatus =
    typeof query.status === "string" ? query.status : null;
  const selectedStatus: OrderStatus | null = isOrderStatus(requestedStatus)
    ? requestedStatus
    : null;

  const orders = await db.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      ...(selectedStatus ? { status: selectedStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return (
    <main className="min-h-screen bg-gray-100 p-5 text-gray-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {restaurant.name} — Sifarişlər
          </h1>
          <Link
            href={`/admin?slug=${encodeURIComponent(restaurant.slug)}`}
            className="text-sm text-blue-700 underline"
          >
            Admin panelinə qayıt
          </Link>
        </div>

        <OrdersAutoRefresh />

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Sifarişləri statusa görə süz</h2>
          <form key={selectedStatus ?? "ALL"} method="get" action="/admin/orders" className="flex flex-wrap items-end gap-3">
            <label className="min-w-[190px] flex-1 text-sm font-medium">
              Sifariş statusu
              <select
                name="status"
                defaultValue={selectedStatus ?? "ALL"}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              >
                <option value="ALL">Bütün statuslar</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <button type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
              Filtrlə
            </button>
            <Link href="/admin/orders"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-zinc-900">
              Filtri sıfırla
            </Link>
          </form>
          <p className="mt-3 text-sm text-zinc-600">
            Göstərilən sifariş: <strong>{orders.length}</strong>
            {" · "}{selectedStatus ? STATUS_LABELS[selectedStatus] : "Bütün statuslar"}
            {" · "}Ən son 50 sifariş
          </p>
        </section>

        {orders.length === 0 && (
          <div className="rounded-xl bg-white p-5">
            {selectedStatus
              ? "Bu statusda sifariş tapılmadı."
              : "Hələ sifariş yoxdur."}
          </div>
        )}

        {orders.map((order) => (
          <article
            key={order.id}
            className="space-y-3 rounded-xl bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">
                Sifariş #{order.id.slice(-8)}
              </h2>
              <span className="text-sm text-gray-600">
                {order.createdAt.toLocaleString("az-AZ", {
                  timeZone: "Asia/Baku",
                })}
              </span>
            </div>

            <p>
              <strong>Müştəri:</strong> {order.customerName}
            </p>
            <p>
              <strong>Telefon:</strong> {order.customerPhone}
            </p>
            <p>
              <strong>Ünvan:</strong>{" "}
              {order.addressText || "Xəritə mövqeyi"}
            </p>

            {order.customerNote && (
              <p>
                <strong>Qeyd:</strong> {order.customerNote}
              </p>
            )}

            <div className="space-y-1 border-t pt-3">
              {order.items.map((item) => (
                <p key={item.id}>
                  {item.quantity} × {item.name} —{" "}
                  {item.lineTotal.toString()} ₼
                </p>
              ))}
            </div>

            <p className="font-bold">
              Ümumi məbləğ: {order.total.toString()} ₼
            </p>

            <div className="rounded-lg bg-gray-50 p-4">
              <p>
                <strong>Sifariş statusu:</strong>{" "}
                {STATUS_LABELS[order.status]}
              </p>
              <p>
                <strong>Ödəniş üsulu:</strong>{" "}
                {order.paymentMethod}
              </p>
              <p>
                <strong>Ödəniş statusu:</strong>{" "}
                {order.paymentStatus === "PAID"
                  ? "Ödənilib"
                  : order.paymentStatus === "PENDING"
                    ? "Ödəniş gözlənilir"
                    : order.paymentStatus}
              </p>

              {order.paymentMethod === "CASH" &&
                order.status === "DELIVERED" &&
                order.paymentStatus === "PENDING" && (
                  <form action={confirmCashPayment} className="mt-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      ✓ Nağd ödəniş alındı — təsdiqlə
                    </button>
                    <p className="mt-2 text-xs text-gray-600">
                      Bu düyməni yalnız pulu həqiqətən aldıqdan sonra basın.
                    </p>
                  </form>
                )}

              {NEXT_STATUSES[order.status].length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {NEXT_STATUSES[order.status].map((nextStatus) => (
                    <form key={nextStatus} action={updateOrderStatus}>
                      <input
                        type="hidden"
                        name="orderId"
                        value={order.id}
                      />
                      <input
                        type="hidden"
                        name="currentStatus"
                        value={order.status}
                      />
                      <input
                        type="hidden"
                        name="nextStatus"
                        value={nextStatus}
                      />
                      <button
                        type="submit"
                        className={
                          nextStatus === "CANCELLED"
                            ? "rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            : "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                        }
                      >
                        {STATUS_BUTTON_LABELS[nextStatus]}
                      </button>
                    </form>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  Bu sifariş tamamlanıb və statusu
                  dəyişdirilə bilməz.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
