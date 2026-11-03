"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";
import { makeTrackingToken } from "@/app/lib/order-tracking";
import { orderHistoryEnabled } from "@/app/lib/order-status-history";

type CartLine = { itemId: string; quantity: number };
type CashOrderInput = {
  slug: string;
  customerName: string;
  customerPhone: string;
  addressText: string;
  customerNote: string;
  items: CartLine[];
};
type Result =
  | { success: true; url: string }
  | { success: false; message: string };

function failure(message: string): Result {
  return { success: false, message };
}

export async function createCashOrder(input: CashOrderInput): Promise<Result> {
  // Bu xüsusiyyət əvvəlcə yalnız ayrıca staging layihəsində açılmalıdır.
  if (process.env.ENABLE_WEB_ORDERS !== "true") {
    return failure("Onlayn sifariş hələ aktiv deyil.");
  }

  if (!input || typeof input !== "object") {
    return failure("Sifariş məlumatları düzgün deyil.");
  }

  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  const name =
    typeof input.customerName === "string" ? input.customerName.trim() : "";
  const phone =
    typeof input.customerPhone === "string" ? input.customerPhone.trim() : "";
  const address =
    typeof input.addressText === "string" ? input.addressText.trim() : "";
  const note =
    typeof input.customerNote === "string" ? input.customerNote.trim() : "";

  if (
    !/^[a-z0-9-]{2,120}$/.test(slug) ||
    name.length < 2 || name.length > 100 ||
    !/^[+0-9()\s-]{7,25}$/.test(phone) ||
    phone.replace(/\D/g, "").length < 7 ||
    phone.replace(/\D/g, "").length > 15 ||
    address.length < 6 || address.length > 300 ||
    note.length > 500 ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 30
  ) {
    return failure("Ad, telefon, ünvan və səbət məlumatlarını yoxlayın.");
  }

  const ids = new Set<string>();
  for (const line of input.items) {
    if (
      !line ||
      typeof line.itemId !== "string" ||
      line.itemId.length < 10 ||
      line.itemId.length > 150 ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 30 ||
      ids.has(line.itemId)
    ) {
      return failure("Səbətdəki məhsullar düzgün deyil.");
    }
    ids.add(line.itemId);
  }

  // Server konfiqurasiyası yoxdursa, bazada yarımçıq sifariş yaratmırıq.
  if ((process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) {
    return failure("Sifariş xidməti müvəqqəti əlçatan deyil.");
  }

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return failure("Restoran tapılmadı.");

    const products = await db.menuItem.findMany({
      where: { restaurantId: restaurant.id, id: { in: [...ids] } },
      select: { id: true, name: true, price: true },
    });
    if (products.length !== ids.size) {
      return failure("Bəzi məhsullar artıq menyuda yoxdur. Səbəti yeniləyin.");
    }

    const indexed = new Map(products.map((item) => [item.id, item]));
    let subtotalCents = 0;
    const lines = [];

    for (const line of input.items) {
      const product = indexed.get(line.itemId);
      if (!product) return failure("Məhsul tapılmadı.");
      const cents = Math.round(product.price * 100);
      if (
        !Number.isSafeInteger(cents) ||
        cents < 0 ||
        cents > 99999999
      ) {
        return failure("Məhsulun qiyməti düzgün deyil.");
      }

      const lineCents = cents * line.quantity;
      subtotalCents += lineCents;
      if (
        !Number.isSafeInteger(subtotalCents) ||
        subtotalCents > 99999999
      ) {
        return failure("Sifariş məbləği həddindən artıq böyükdür.");
      }

      lines.push({
        menuItemId: product.id,
        name: product.name,
        quantity: line.quantity,
        unitPrice: new Prisma.Decimal(cents).div(100),
        lineTotal: new Prisma.Decimal(lineCents).div(100),
      });
    }

    const subtotal = new Prisma.Decimal(subtotalCents).div(100);

    const order = await db.order.create({
      data: {
        restaurantId: restaurant.id,
        customerName: name,
        customerPhone: phone,
        addressText: address,
        customerNote: note || null,
        subtotal,
        deliveryFee: new Prisma.Decimal(0),
        total: subtotal,
        status: "NEW",
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        items: { create: lines },
        // Yeni sifarişin ilk NEW hadisəsi sifarişlə eyni Prisma tranzaksiyasında
        // yaradılır. Tarixçə hazır olmayan bazalarda bu sahə ümumiyyətlə getmir.
        ...(orderHistoryEnabled()
          ? {
              statusEvents: {
                create: {
                  restaurantId: restaurant.id,
                  fromStatus: null,
                  toStatus: "NEW" as const,
                  actor: "CUSTOMER",
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });

    const token = makeTrackingToken(order.id);
    return {
      success: true,
      url:
        "/order/track/" +
        encodeURIComponent(order.id) +
        "?t=" +
        encodeURIComponent(token),
    };
  } catch {
    return failure("Sifariş yaradılmadı. Bir az sonra yenidən cəhd edin.");
  }
}
