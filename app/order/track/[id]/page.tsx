import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { orderDestinationLabel } from "@/app/lib/fulfillment";
import { validTrackingToken } from "@/app/lib/order-tracking";
import LiveOrderStatus from "./LiveOrderStatus";

export const metadata = {
  title: "Sifarişi izlə | QR Menü",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

export default function TrackOrderPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Sifariş yüklənir...</main>}>
      <TrackOrderContent {...props} />
    </Suspense>
  );
}

async function TrackOrderContent({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.t === "string" ? query.t : "";
  if (!validTrackingToken(id, token)) notFound();

  const order = await db.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      tableNumber: true,
      paymentMethod: true,
      paymentStatus: true,
      updatedAt: true,
    },
  });
  if (!order) notFound();

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Sifarişimi izlə</h1>
        <p className="text-sm text-zinc-600">
          Bu səhifənin bağlantısını saxlayın. Sifariş vəziyyəti avtomatik yenilənəcək.
        </p>
        <p className="rounded-lg bg-indigo-50 p-3 text-base font-bold text-indigo-950">
          {orderDestinationLabel(order.fulfillmentType, order.tableNumber)}
        </p>
        <LiveOrderStatus
          orderId={order.id}
          token={token}
          initial={{
            status: order.status,
            paymentMethod: order.paymentMethod,
            fulfillmentType: order.fulfillmentType,
            tableNumber: order.tableNumber,
            paymentStatus: order.paymentStatus,
            updatedAt: order.updatedAt.toISOString(),
          }}
        />
      </div>
    </main>
  );
}
