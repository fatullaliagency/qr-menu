
import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import { parseReportRange, MAX_REPORT_DAYS } from "@/app/lib/superadmin-report";
import OrdersAutoRefresh from "./OrdersAutoRefresh";

type OrdersPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    method?: string | string[];
    payment?: string | string[];
    page?: string | string[];
    q?: string | string[];
    urgent?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Yeni sifariş",
  CONFIRMED: "Təsdiqləndi",
  PREPARING: "Hazırlanır",
  ON_THE_WAY: "Çatdırılma yolundadır",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Ləğv edildi",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Nağd",
  ONLINE_CARD: "Onlayn kart",
  MANUAL_TRANSFER: "Köçürmə",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ödəniş gözlənilir",
  AWAITING_VERIFICATION: "Təsdiq gözlənilir",
  PAID: "Ödənilib",
  FAILED: "Uğursuz",
  REFUNDED: "Geri qaytarılıb",
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
  const overdueOnly = query.urgent === "1";
  const requestedStatus =
    typeof query.status === "string" ? query.status : null;
  // Gecikən sifarişlər həmişə NEW olmalıdır, URL-dəki başqa status nəzərə alınmır.
  const selectedStatus: OrderStatus | null = overdueOnly
    ? "NEW"
    : isOrderStatus(requestedStatus)
      ? requestedStatus
      : null;
  const selectedMethod: PaymentMethod | null =
    typeof query.method === "string" &&
    Object.prototype.hasOwnProperty.call(METHOD_LABELS, query.method)
      ? (query.method as PaymentMethod)
      : null;
  const selectedPayment: PaymentStatus | null =
    typeof query.payment === "string" &&
    Object.prototype.hasOwnProperty.call(PAYMENT_LABELS, query.payment)
      ? (query.payment as PaymentStatus)
      : null;

  // Yalnız sifariş ID-sinin son simvolları üzrə axtarış; telefon/ünvan
  // kimi şəxsi məlumatlar sorğu parametrinə daxil edilmir.
  const searchText = typeof query.q === "string"
    ? query.q.trim().toLowerCase()
    : "";
  const orderSearch = /^[a-z0-9]{4,30}$/.test(searchText)
    ? searchText
    : null;

  // Tarixlər Asia/Baku (UTC+04:00) gün sərhədlərinə çevrilir.
  // Yalnız hər iki tarix düzgün veriləndə filtr işləyir (maksimum 90 gün).
  const fromValue = typeof query.from === "string" ? query.from.trim() : null;
  const toValue = typeof query.to === "string" ? query.to.trim() : null;
  // Boş tarix inputları GET formasında from=&to= kimi göndərilir:
  // ikisi də boşdursa, tarix filtri tətbiq edilmir.
  const requestedDateFilter =
    (query.from !== undefined || query.to !== undefined) &&
    !(fromValue === "" && toValue === "");
  const dateRange = requestedDateFilter
    ? parseReportRange(fromValue, toValue)
    : null;
  const invalidDateFilter = requestedDateFilter && !dateRange;
  // Bakı saat qurşağı ilə bu günün tarixini ortaq tarix köməkçisindən alırıq.
  // Giriş sessiyası artıq yoxlandığı üçün bu hesab sorğu vaxtında aparılır.
  const todayKey = parseReportRange(null, null)?.to ?? "";

  const PAGE_SIZE = 50;
  const requestedPage =
    typeof query.page === "string" && /^[1-9][0-9]{0,3}$/.test(query.page)
      ? Number(query.page)
      : 1;
  const overdueCutoff = overdueOnly ? new Date(Date.now() - 10 * 60 * 1000) : null;
  const filteredWhere: Prisma.OrderWhereInput = {
    restaurantId: session.restaurantId,
    ...(selectedStatus ? { status: selectedStatus } : {}),
    ...(selectedMethod ? { paymentMethod: selectedMethod } : {}),
    ...(selectedPayment ? { paymentStatus: selectedPayment } : {}),
    ...(orderSearch ? { id: { endsWith: orderSearch } } : {}),
    ...(dateRange
      ? {
          createdAt: {
            gte: dateRange.startUtc,
            lt: overdueCutoff && overdueCutoff < dateRange.endUtc
              ? overdueCutoff
              : dateRange.endUtc,
          },
        }
      : overdueCutoff
        ? { createdAt: { lt: overdueCutoff } }
        : {}),
    // Yanlış tarix sorğusunu səssizcə "bütün sifarişlər" kimi işlətmirik.
    ...(invalidDateFilter ? { id: { in: [] } } : {}),
  };

  // Səhifələmə filtrdən sonrakı real say üzrə edilir. Ümumi statistika
  // isə həmişə restoranın bütün sifarişlərini əhatə edir.
  const [filteredCount, statusGroups, paidTotals] = await Promise.all([
    db.order.count({ where: filteredWhere }),
    db.order.groupBy({
      by: ["status"],
      where: { restaurantId: session.restaurantId },
      _count: { _all: true },
    }),
    db.order.aggregate({
      where: {
        restaurantId: session.restaurantId,
        paymentStatus: "PAID",
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const orderBy: Prisma.OrderOrderByWithRelationInput[] = overdueOnly
    ? [{ createdAt: "asc" }, { id: "asc" }]
    : [{ createdAt: "desc" }, { id: "desc" }];
  const orders = await db.order.findMany({
    where: filteredWhere,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { items: true },
  });

  // Səhifələr arasında hər üç aktiv filtr saxlanılır.
  const pageLink = (nextPage: number): string => {
    const params = new URLSearchParams();
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedMethod) params.set("method", selectedMethod);
    if (selectedPayment) params.set("payment", selectedPayment);
    if (orderSearch) params.set("q", orderSearch);
    if (overdueOnly) params.set("urgent", "1");
    if (dateRange) {
      params.set("from", dateRange.from);
      params.set("to", dateRange.to);
    }
    params.set("page", String(nextPage));
    return "/admin/orders?" + params.toString();
  };

  const counts = Object.fromEntries(
    statusGroups.map((item) => [item.status, item._count._all])
  ) as Partial<Record<OrderStatus, number>>;
  const totalOrders = statusGroups.reduce(
    (sum, item) => sum + item._count._all,
    0
  );
  const activeOrders =
    (counts.NEW ?? 0) +
    (counts.CONFIRMED ?? 0) +
    (counts.PREPARING ?? 0) +
    (counts.ON_THE_WAY ?? 0);

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
          <h2 className="mb-3 text-lg font-semibold">Restoranın sifariş statistikası</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-zinc-100 p-4">
              <p className="text-sm text-zinc-600">Cəmi sifariş</p>
              <p className="mt-1 text-2xl font-bold">{totalOrders}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Yeni sifarişlər</p>
              <p className="mt-1 text-2xl font-bold">{counts.NEW ?? 0}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-900">İcrada olan sifarişlər</p>
              <p className="mt-1 text-2xl font-bold">{activeOrders}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">Çatdırılan sifarişlər</p>
              <p className="mt-1 text-2xl font-bold">{counts.DELIVERED ?? 0}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-4">
              <p className="text-sm text-rose-900">Ləğv edilən sifarişlər</p>
              <p className="mt-1 text-2xl font-bold">{counts.CANCELLED ?? 0}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">Ödənişi təsdiqlənən</p>
              <p className="mt-1 text-2xl font-bold">{paidTotals._count._all}</p>
              <p className="mt-1 text-sm font-semibold">
                {paidTotals._sum.total?.toString() ?? "0.00"} ₼
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Bu göstəricilər filtrdən asılı deyil və restoranın bütün sifarişlərini
            əhatə edir. Təsdiqlənmiş ödəniş məbləği sistemdə PAID statuslu
            sifarişlərin cəmidir; bank hesablaşması barədə təsdiq deyil.
          </p>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Sifarişləri filtrlə</h2>
          <form key={`${selectedStatus ?? "ALL"}:${selectedMethod ?? "ALL"}:${selectedPayment ?? "ALL"}:${orderSearch ?? ""}:${overdueOnly}:${dateRange?.from ?? ""}:${dateRange?.to ?? ""}`}
            method="get" action="/admin/orders" className="flex flex-wrap items-end gap-3">
            <label className="min-w-[190px] flex-1 text-sm font-medium">
              Sifariş nömrəsi
              <input
                name="q"
                type="search"
                maxLength={30}
                pattern="[A-Za-z0-9]{4,30}"
                defaultValue={orderSearch ?? ""}
                placeholder="Sifarişin son 8 simvolu"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              />
            </label>
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
            <label className="min-w-[190px] flex-1 text-sm font-medium">
              Ödəniş üsulu
              <select
                name="method"
                defaultValue={selectedMethod ?? "ALL"}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              >
                <option value="ALL">Bütün üsullar</option>
                {Object.entries(METHOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="min-w-[190px] flex-1 text-sm font-medium">
              Ödəniş statusu
              <select
                name="payment"
                defaultValue={selectedPayment ?? "ALL"}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              >
                <option value="ALL">Bütün ödəniş statusları</option>
                {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="min-w-[150px] text-sm font-medium">
              Başlanğıc tarixi (Bakı)
              <input
                type="date"
                name="from"
                defaultValue={dateRange?.from ?? fromValue ?? ""}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              />
            </label>
            <label className="min-w-[150px] text-sm font-medium">
              Son tarix (Bakı)
              <input
                type="date"
                name="to"
                defaultValue={dateRange?.to ?? toValue ?? ""}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-zinc-900"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-950">
              <input type="checkbox" name="urgent" value="1" defaultChecked={overdueOnly}
                className="h-4 w-4 accent-amber-700" />
              10 dəqiqədən çox təsdiqsiz
            </label>
            <button type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
              Filtrlə
            </button>
            {todayKey && (
              <Link
                href={`/admin/orders?from=${todayKey}&to=${todayKey}`}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Bugünkü sifarişlər
              </Link>
            )}
            <Link href="/admin/orders"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-zinc-900">
              Filtri sıfırla
            </Link>
          </form>
          {invalidDateFilter && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
              Tarix aralığı yanlışdır. Hər iki tarixi seçin; başlanğıc son tarixdən
              gec olmasın və müddət maksimum {MAX_REPORT_DAYS} gün olsun.
              Səhv tarixlə sifariş siyahısı göstərilmir.
            </p>
          )}
          <p className="mt-3 text-sm text-zinc-600">
            Göstərilən sifariş: <strong>{orders.length}</strong> / {filteredCount}
            {" · "}{selectedStatus ? STATUS_LABELS[selectedStatus] : "Bütün statuslar"}
            {" · "}{selectedMethod ? METHOD_LABELS[selectedMethod] : "Bütün üsullar"}
            {" · "}{selectedPayment ? PAYMENT_LABELS[selectedPayment] : "Bütün ödəniş statusları"}
            {orderSearch ? " · Nömrə: " + orderSearch : ""}
            {overdueOnly ? " · Əvvəlcə ən köhnə gecikən sifarişlər" : ""}
            {dateRange ? " · Tarix: " + dateRange.from + " — " + dateRange.to : ""}
            {" · "}Səhifə {page} / {pageCount}
          </p>
        </section>

        {orders.length === 0 && (
          <div className="rounded-xl bg-white p-5">
            {selectedStatus || selectedMethod || selectedPayment || orderSearch || overdueOnly || requestedDateFilter
              ? "Axtarış və filtrlərə uyğun sifariş tapılmadı."
              : "Hələ sifariş yoxdur."}
          </div>
        )}

        {filteredCount > PAGE_SIZE && (
          <nav aria-label="Sifariş siyahısının səhifələri"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            {page > 1 ? (
              <Link href={pageLink(page - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">
                ← Əvvəlki səhifə
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm text-zinc-500">İlk səhifə</span>
            )}
            <span className="text-sm font-semibold">
              Səhifə {page} / {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={pageLink(page + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">
                Növbəti səhifə →
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm text-zinc-500">Son səhifə</span>
            )}
          </nav>
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
                {METHOD_LABELS[order.paymentMethod]}
              </p>
              <p>
                <strong>Ödəniş statusu:</strong>{" "}
                {PAYMENT_LABELS[order.paymentStatus]}
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
