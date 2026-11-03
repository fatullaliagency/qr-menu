import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  // Hər sorğuda imzalı sessiya yoxlanır; restoran identifikatoru URL-dən alınmır.
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: "Giriş tələb olunur." },
      { status: 401, headers: NO_STORE }
    );
  }

  const overdueCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const [newCount, overdueCount, newestOrder] = await Promise.all([
    db.order.count({
      where: { restaurantId: session.restaurantId, status: "NEW" },
    }),
    db.order.count({
      where: {
        restaurantId: session.restaurantId,
        status: "NEW",
        createdAt: { lt: overdueCutoff },
      },
    }),
    db.order.findFirst({
      // Yalnız NEW statuslu sifarişlər xəbərdarlıq üçün əsas götürülür.
      // Köhnə/tamamlanmış sifarişlərin seçilməsi yanlış bildiriş yaratmasın.
      where: { restaurantId: session.restaurantId, status: "NEW" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, createdAt: true },
    }),
  ]);

  // Müştəri adı, telefon, ünvan və səbət məlumatları bu API-də yoxdur.
  return NextResponse.json(
    {
      newCount,
      overdueCount,
      latestOrder: newestOrder
        ? { id: newestOrder.id, createdAt: newestOrder.createdAt.toISOString() }
        : null,
    },
    { headers: NO_STORE }
  );
}
