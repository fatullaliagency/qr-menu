import type { OrderStatus, PrismaClient } from "@prisma/client";

/**
 * Database mutation boundary shared with the server actions.
 * Inputs are validated and authorized by the caller first.
 *
 * A conditional updateMany ensures that stale/duplicate or cross-restaurant
 * submissions never modify a row. The database WHERE checks are mandatory.
 */
export async function writeOrderStatus(
  database: Pick<PrismaClient, "order" | "$transaction">,
  input: {
    id: string;
    restaurantId: string;
    currentStatus: OrderStatus;
    nextStatus: OrderStatus;
    historyEnabled: boolean;
  }
): Promise<boolean> {
  const where = {
    id: input.id,
    restaurantId: input.restaurantId,
    status: input.currentStatus,
  };
  const data = { status: input.nextStatus };

  if (!input.historyEnabled) {
    const result = await database.order.updateMany({ where, data });
    return result.count === 1;
  }

  // Staging history requires verified migration and explicit feature flag.
  // Both writes share a transaction: failure to write an event rolls back
  // the status update. No event is written when status is already stale.
  return database.$transaction(async (tx) => {
    const result = await tx.order.updateMany({ where, data });
    if (result.count !== 1) return false;

    await tx.orderStatusEvent.create({
      data: {
        orderId: input.id,
        restaurantId: input.restaurantId,
        fromStatus: input.currentStatus,
        toStatus: input.nextStatus,
        actor: "RESTAURANT",
      },
    });
    return true;
  });
}

/**
 * Cash payments are NEVER automatically confirmed on delivery.
 * The owning restaurant must explicitly submit the payment action and
 * the order must still be delivered, cash and pending at update time.
 */
export async function writeCashReceipt(
  database: Pick<PrismaClient, "order">,
  input: { id: string; restaurantId: string }
): Promise<boolean> {
  const result = await database.order.updateMany({
    where: {
      id: input.id,
      restaurantId: input.restaurantId,
      status: "DELIVERED",
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
    },
    data: { paymentStatus: "PAID" },
  });
  return result.count === 1;
}
