
import { Suspense } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import { parseReportRange, MAX_REPORT_DAYS } from "@/app/lib/superadmin-report";
import OrdersAutoRefresh from "./OrdersAutoRefresh";
import OrderSubmitButton from "./OrderSubmitButton";
import CopyKitchenOrderButton from "./CopyKitchenOrderButton";
import { orderHistoryEnabled } from "@/app/lib/order-status-history";
import {
  NEXT_STATUSES,
  isOrderStatus,
  canTransitionOrder,
  CASH_PENDING_CONDITIONS,
  canConfirmCashPayment,
} from "@/app/lib/order-policy";

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
    notice?: string | string[];
    cashDue?: string | string[];
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

const STATUS_BUTTON_LABELS: Record<OrderStatus, string> = {
  NEW: "Yeni",
  CONFIRMED: "✓ Sifarişi təsdiqlə",
  PREPARING: "Hazırlanmağa başladı",
  ON_THE_WAY: "Çatdırılmaya göndər",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Sifarişi ləğv et",
};

// Tel-URL yalnız rəqəmlərdən (və başlanğıc + işarəsindən) ibarətdir.
function safeTelHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return "tel:" + (phone.trim().startsWith("+") ? "+" : "") + digits;
}

type NoticeCode =
  | "confirmed" | "preparing" | "on-the-way" | "delivered" | "cancelled"
  | "cash-paid" | "stale" | "invalid";

const NOTICE_LABELS: Record<NoticeCode, string> = {
  confirmed: "Sifariş təsdiqləndi.",
  preparing: "Sifarişin hazırlanmasına başlandı.",
  "on-the-way": "Sifariş çatdırılmaya göndərildi.",
  delivered: "Sifariş çatdırıldı.",
  cancelled: "Sifariş ləğv edildi.",
  "cash-paid": "Nağd ödənişin alındığı təsdiqləndi.",
  stale: "Sifariş artıq dəyişdirilib, tapılmayıb və ya giriş icazəniz yoxdur. Səhifəni yeniləyin.",
  invalid: "Sorğu yanlışdır. Səhifəni yeniləyib təkrar yoxlayın.",
};

const STATUS_NOTICE: Record<OrderStatus, NoticeCode> = {
  NEW: "invalid",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  ON_THE_WAY: "on-the-way",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

// Yönləndirməni yalnız /admin/orders ilə məhdudlaşdırırıq. Gizli input
// etibarlı sayılmır; URL parametrləri serverdə yenidən validasiya olunur.
function actionNoticeUrl(formData: FormData, notice: NoticeCode): string {
  const raw = formData.get("returnTo");
  const params = new URLSearchParams();
  if (typeof raw === "string" && raw.length <= 1024) {
    try {
      const parsed = new URL(raw, "https://qr-menu-actions.invalid");
      if (parsed.origin === "https://qr-menu-actions.invalid" &&
          parsed.pathname === "/admin/orders") {
        const source = parsed.searchParams;
        const status = source.get("status");
        const method = source.get("method");
        const payment = source.get("payment");
        const q = source.get("q");
        const page = source.get("page");
        const from = source.get("from");
        const to = source.get("to");
        if (isOrderStatus(status)) params.set("status", status);
        if (method && Object.prototype.hasOwnProperty.call(METHOD_LABELS, method))
          params.set("method", method);
        if (payment && Object.prototype.hasOwnProperty.call(PAYMENT_LABELS, payment))
          params.set("payment", payment);
        if (q && /^[a-z0-9]{4,30}$/.test(q)) params.set("q", q);
        if (source.get("urgent") === "1") {
          params.set("urgent", "1");
          params.set("status", "NEW");
        }
        // Nağd ödənişin təsdiqindən sonra istifadəçi eyni xüsusi filtrdə
        // qalmalıdır. Ziddiyyətli sorğu parametrlərini normallaşdırırıq.
        if (source.get("cashDue") === "1") {
          params.delete("urgent");
          params.set("cashDue", "1");
          params.set("status", "DELIVERED");
          params.set("method", "CASH");
          params.set("payment", "PENDING");
        }
        if (from !== null && to !== null && parseReportRange(from, to)) {
          params.set("from", from);
          params.set("to", to);
        }
        if (page && /^[1-9][0-9]{0,3}$/.test(page)) params.set("page", page);
      }
    } catch {
      // Yanlış returnTo yox sayılır.
    }
  }
  params.set("notice", notice);
  return "/admin/orders?" + params.toString();
}

async function updateOrderStatus(formData: FormData) {
  "use server";

  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const orderId = formData.get("orderId");
  const currentStatus = formData.get("currentStatus");
  const nextStatus = formData.get("nextStatus");

  if (
    typeof orderId !== "string" ||
    orderId.length < 1 ||
    orderId.length > 150 ||
    !isOrderStatus(currentStatus) ||
    !isOrderStatus(nextStatus) ||
    !canTransitionOrder(currentStatus, nextStatus)
  ) {
    redirect(actionNoticeUrl(formData, "invalid"));
  }

  // Tarixçə açıqdırsa status dəyişikliyi və audit yazısı eyni tranzaksiyadadır.
  // Tarixçə cədvəli yoxdursa tranzaksiya geri qaytarılır, yarımçıq status
  // yenilənməsi baş vermir. Migration tamamlanmayıbsa köhnə etibarlı axın qalır.
  const changed = orderHistoryEnabled()
    ? await db.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            restaurantId: session.restaurantId,
            status: currentStatus,
          },
          data: { status: nextStatus },
        });
        if (result.count !== 1) return false;
        await tx.orderStatusEvent.create({
          data: {
            orderId,
            restaurantId: session.restaurantId,
            fromStatus: currentStatus,
            toStatus: nextStatus,
            actor: "RESTAURANT",
          },
        });
        return true;
      })
    : (await db.order.updateMany({
        where: {
          id: orderId,
          restaurantId: session.restaurantId,
          status: currentStatus,
        },
        data: { status: nextStatus },
      })).count === 1;

  if (!changed) {
    redirect(actionNoticeUrl(formData, "stale"));
  }

  revalidatePath("/admin/orders");
  redirect(actionNoticeUrl(formData, STATUS_NOTICE[nextStatus]));
}

// Nağd pul həqiqətən təhvil alındıqdan sonra restoran admini təsdiqləyir.
// Bu əməliyyat sifarişin çatdırılması ilə avtomatik işləmir.
async function confirmCashPayment(formData: FormData) {
  "use server";

  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const orderId = formData.get("orderId");
  if (typeof orderId !== "string" || orderId.length < 1 || orderId.length > 150) {
    redirect(actionNoticeUrl(formData, "invalid"));
  }

  const result = await db.order.updateMany({
    where: {
      id: orderId,
      restaurantId: session.restaurantId,
      ...CASH_PENDING_CONDITIONS,
    },
    data: { paymentStatus: "PAID" },
  });

  if (result.count !== 1) {
    redirect(actionNoticeUrl(formData, "stale"));
  }

  revalidatePath("/admin/orders");
  redirect(actionNoticeUrl(formData, "cash-paid"));
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
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const notice = Object.prototype.hasOwnProperty.call(NOTICE_LABELS, noticeKey)
    ? NOTICE_LABELS[noticeKey as NoticeCode]
    : null;
  const noticeIsError = noticeKey === "stale" || noticeKey === "invalid";
  // Cash Due qısa keçidi yalnız çatdırılmış, nağd və təsdiqlənməmiş
  // sifarişləri göstərir. Bu rejim urgent rejimindən üstündür.
  const cashDueOnly = query.cashDue === "1";
  const overdueOnly = !cashDueOnly && query.urgent === "1";
  const requestedStatus =
    typeof query.status === "string" ? query.status : null;
  // Gecikən sifarişlər həmişə NEW olmalıdır, URL-dəki başqa status nəzərə alınmır.
  const selectedStatus: OrderStatus | null = cashDueOnly
    ? "DELIVERED"
    : overdueOnly
      ? "NEW"
      : isOrderStatus(requestedStatus)
        ? requestedStatus
        : null;
  const selectedMethod: PaymentMethod | null = cashDueOnly
    ? "CASH"
    : typeof query.method === "string" &&
        Object.prototype.hasOwnProperty.call(METHOD_LABELS, query.method)
      ? (query.method as PaymentMethod)
      : null;
  const selectedPayment: PaymentStatus | null = cashDueOnly
    ? "PENDING"
    : typeof query.payment === "string" &&
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
  const warningCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const overdueCutoff = overdueOnly ? warningCutoff : null;
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
  const [filteredCount, statusGroups, paidTotals, cashDueTotals] = await Promise.all([
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
    // Bu məbləğ gəlir deyil; yalnız hələ təsdiqlənməmiş nağd ödənişdir.
    db.order.aggregate({
      where: {
        restaurantId: session.restaurantId,
        ...CASH_PENDING_CONDITIONS,
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  // Gecikən yeni sifarişlər və hələ nağd ödənişi alınmayan çatdırılmış
  // sifarişlərdə ən uzun müddət gözləyən ilk sıraya çıxır.
  const orderBy: Prisma.OrderOrderByWithRelationInput[] =
    overdueOnly || cashDueOnly
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];
  const orders = await db.order.findMany({
    where: filteredWhere,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { items: true },
  });

  // Tarixçə yalnız migration yoxlanıb ENABLE_ORDER_STATUS_HISTORY=true
  // edildikdən sonra oxunur. Hər sorğu təsdiqlənmiş restoranla məhdudlaşır.
  const historyEnabled = orderHistoryEnabled();
  const statusHistory = historyEnabled && orders.length > 0
    ? await db.orderStatusEvent.findMany({
        where: {
          restaurantId: session.restaurantId,
          orderId: { in: orders.map((order) => order.id) },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          orderId: true,
          fromStatus: true,
          toStatus: true,
          actor: true,
          createdAt: true,
        },
      })
    : [];
  const statusHistoryByOrder = new Map<string, typeof statusHistory>();
  for (const event of statusHistory) {
    const events = statusHistoryByOrder.get(event.orderId) ?? [];
    events.push(event);
    statusHistoryByOrder.set(event.orderId, events);
  }

  // Səhifələr arasında hər üç aktiv filtr saxlanılır.
  const pageLink = (nextPage: number): string => {
    const params = new URLSearchParams();
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedMethod) params.set("method", selectedMethod);
    if (selectedPayment) params.set("payment", selectedPayment);
    if (orderSearch) params.set("q", orderSearch);
    if (overdueOnly) params.set("urgent", "1");
    if (cashDueOnly) params.set("cashDue", "1");
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

        {notice && (
          <div
            role={noticeIsError ? "alert" : "status"}
            aria-live={noticeIsError ? "assertive" : "polite"}
            className={noticeIsError
              ? "rounded-xl border border-red-300 bg-red-50 px-5 py-4 font-semibold text-red-900"
              : "rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 font-semibold text-emerald-900"}
          >
            {notice}
            <Link href={pageLink(page)} className="ml-3 text-sm underline">
              Bildirişi bağla
            </Link>
          </div>
        )}

        <OrdersAutoRefresh />

        <Link
          href="/admin/orders/kitchen"
          className="inline-flex w-fit rounded-xl bg-indigo-800 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          🍳 Mətbəx ekranını aç
        </Link>

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
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Çatdırılıb, nağd ödənişi gözlənilir
              </p>
              <p className="mt-1 text-2xl font-bold">{cashDueTotals._count._all}</p>
              <p className="mt-1 text-sm font-semibold">
                {cashDueTotals._sum.total?.toFixed(2) ?? "0.00"} ₼
              </p>
              <Link href="/admin/orders?cashDue=1"
                className="mt-3 inline-block rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white">
                Təsdiq gözləyən nağd sifarişlər
              </Link>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Bu göstəricilər filtrdən asılı deyil və restoranın bütün sifarişlərini
            əhatə edir. Təsdiqlənmiş ödəniş məbləği sistemdə PAID statuslu
            sifarişlərin cəmidir; bank hesablaşması barədə təsdiq deyil.
            Gözlənilən nağd məbləğ isə hələ alınmamış və ya təsdiqlənməmiş
            nağd ödənişləri ifadə edir.
          </p>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Sifarişləri filtrlə</h2>
          <form key={`${selectedStatus ?? "ALL"}:${selectedMethod ?? "ALL"}:${selectedPayment ?? "ALL"}:${orderSearch ?? ""}:${overdueOnly}:${cashDueOnly}:${dateRange?.from ?? ""}:${dateRange?.to ?? ""}`}
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
            {cashDueOnly ? " · Nağd ödənişi gözləyənlər — ən köhnədən" : ""}
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
            className={
              order.status === "NEW" && order.createdAt.getTime() < warningCutoff.getTime()
                ? "space-y-3 rounded-xl border-2 border-rose-400 bg-rose-50 p-5 shadow-sm"
                : "space-y-3 rounded-xl bg-white p-5 shadow-sm"
            }
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

            {order.status === "NEW" && order.createdAt.getTime() < warningCutoff.getTime() && (
              <p
                className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-bold text-rose-900"
                role="status"
              >
                ⚠️ Təcili: Yeni sifariş 10 dəqiqədən çoxdur təsdiq gözləyir.
              </p>
            )}

            <p>
              <strong>Müştəri:</strong> {order.customerName}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p>
                <strong>Telefon:</strong> {order.customerPhone}
              </p>
              {safeTelHref(order.customerPhone) && (
                <a
                  href={safeTelHref(order.customerPhone) ?? undefined}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                >
                  Müştəriyə zəng et
                </a>
              )}
            </div>
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
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <CopyKitchenOrderButton
                  orderId={order.id}
                  items={order.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                  }))}
                />
                <Link
                  href={`/admin/orders/${encodeURIComponent(order.id)}/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
                >
                  🖨️ Mətbəx qəbzini çap et
                </Link>
              </div>
            </div>

            <p className="font-bold">
              Ümumi məbləğ: {order.total.toString()} ₼
            </p>

            {historyEnabled && (
              <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <summary className="cursor-pointer font-semibold">
                  Sifarişin status tarixçəsi
                </summary>
                {(statusHistoryByOrder.get(order.id)?.length ?? 0) > 0 ? (
                  <ol className="mt-3 space-y-2 text-sm">
                    {statusHistoryByOrder.get(order.id)?.map((event) => (
                      <li key={event.id} className="border-l-2 border-emerald-600 pl-3">
                        <p className="font-medium">
                          {event.fromStatus
                            ? STATUS_LABELS[event.fromStatus] + " → "
                            : "Sifariş yaradıldı → "}
                          {STATUS_LABELS[event.toStatus]}
                        </p>
                        <p className="text-zinc-600">
                          {event.createdAt.toLocaleString("az-AZ", { timeZone: "Asia/Baku" })}
                          {" · "}
                          {event.actor === "CUSTOMER" ? "Müştəri" : "Restoran"}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600">
                    Bu sifariş üçün əvvəlki status dəyişiklikləri qeydə alınmayıb.
                    Tarixçə yalnız aktivləşdirildikdən sonrakı əməliyyatları göstərir.
                  </p>
                )}
              </details>
            )}

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

              {canConfirmCashPayment(order) && (
                  <form action={confirmCashPayment} className="mt-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="returnTo" value={pageLink(page)} />
                    <OrderSubmitButton
                      variant="success"
                      confirmMessage={`Sifariş #${order.id.slice(-8)} üçün ${order.total.toFixed(2)} ₼ nağd pulu həqiqətən aldınız? Bu əməliyyatı yalnız pul qəbul edildikdən sonra təsdiqləyin.`}
                    >
                      ✓ Nağd ödəniş alındı — təsdiqlə
                    </OrderSubmitButton>
                    <p className="mt-2 text-xs text-gray-600">
                      Bu düyməni yalnız pulu həqiqətən aldıqdan sonra basın.
                    </p>
                  </form>
                )}

              {NEXT_STATUSES[order.status].length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {NEXT_STATUSES[order.status].map((nextStatus) => (
                    <form key={nextStatus} action={updateOrderStatus}>
                      <input type="hidden" name="returnTo" value={pageLink(page)} />
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
                      <OrderSubmitButton
                        variant={nextStatus === "CANCELLED" ? "danger" : "success"}
                        confirmMessage={nextStatus === "CANCELLED"
                          ? `Sifariş #${order.id.slice(-8)} ləğv edilsin? Bu statusu geri qaytarmaq mümkün deyil.`
                          : undefined}
                      >
                        {STATUS_BUTTON_LABELS[nextStatus]}
                      </OrderSubmitButton>
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
