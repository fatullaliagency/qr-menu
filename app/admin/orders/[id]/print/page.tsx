import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import PrintKitchenButton from "./PrintKitchenButton";
import "./receipt.css";

type PrintPageProps = {
  params: Promise<{ id: string }>;
};

const ORDER_STATUS: Record<string, string> = {
  NEW: "Yeni sifariş",
  CONFIRMED: "Təsdiqləndi",
  PREPARING: "Hazırlanır",
  ON_THE_WAY: "Çatdırılma yolundadır",
  DELIVERED: "Çatdırıldı",
  CANCELLED: "Ləğv edildi",
};

export default function KitchenPrintPage(props: PrintPageProps) {
  return (
    <Suspense fallback={<main className="p-8">Çap qəbzi hazırlanır...</main>}>
      <KitchenPrintContent {...props} />
    </Suspense>
  );
}

async function KitchenPrintContent({ params }: PrintPageProps) {
  // Qəbz yalnız imzalı restoran sessiyası ilə açılır.
  // İcazə yoxlaması browser query parametrinə deyil, sessiyaya əsaslanır.
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const { id } = await params;
  if (!id || id.length > 150) notFound();

  const order = await db.order.findFirst({
    where: {
      id,
      restaurantId: session.restaurantId,
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      restaurant: { select: { name: true } },
      items: {
        select: { id: true, name: true, quantity: true },
        orderBy: { id: "asc" },
      },
    },
  });

  // Digər restoranın sifarişi 404 göstərilir. Müştəri məlumatları nə sorğuda,
  // nə çap səhifəsində işlədilir.
  if (!order) notFound();

  const createdAt = order.createdAt.toLocaleString("az-AZ", {
    timeZone: "Asia/Baku",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="kitchen-print-page min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900">
      <div className="kitchen-print-controls mx-auto mb-5 flex max-w-sm flex-wrap items-center justify-between gap-3">
        <Link href="/admin/orders"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold">
          ← Sifarişlər
        </Link>
        <PrintKitchenButton />
      </div>

      <article className="kitchen-receipt mx-auto max-w-sm rounded-xl bg-white p-6 shadow">
        <header className="border-b-2 border-dashed border-zinc-700 pb-4 text-center">
          <h1 className="text-xl font-bold">{order.restaurant.name}</h1>
          <p className="mt-1 text-sm font-semibold">MƏTBƏX SİFARİŞ QƏBZİ</p>
          <p className="mt-3 text-lg font-bold">#{order.id.slice(-8)}</p>
          <p className="text-sm">{createdAt} (Bakı vaxtı)</p>
          <p className="mt-1 text-sm">{ORDER_STATUS[order.status]}</p>
        </header>

        <section aria-label="Sifariş məhsulları" className="py-4">
          <h2 className="mb-3 text-sm font-bold uppercase">Məhsullar</h2>
          <ol className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 border-b border-dashed border-zinc-200 pb-2">
                <span className="break-words text-sm font-medium">{item.name}</span>
                <strong className="shrink-0 text-base">{item.quantity} ×</strong>
              </li>
            ))}
          </ol>
        </section>
        <p className="border-t-2 border-dashed border-zinc-700 pt-3 text-center text-xs">
          Mətbəx nüsxəsi · Qiymət və müştəri əlaqə məlumatı daxil deyil
        </p>
      </article>
    </main>
  );
}
