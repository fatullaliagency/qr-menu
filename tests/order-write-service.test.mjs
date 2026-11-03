import test from "node:test";
import assert from "node:assert/strict";
import { writeOrderStatus, writeCashReceipt } from "../app/lib/order-write-service.ts";
import { canTransitionOrder } from "../app/lib/order-policy.ts";

/** In-memory adapter simulates Prisma updateMany's conditional atomic WHERE.
 *  $transaction snapshots rows and rolls back event failures.
 *  This verifies real application mutation functions, but is NOT a live
 *  PostgreSQL integration test.
 */
function fakeDatabase(initialOrders) {
  const orders = new Map(initialOrders.map((order) => [order.id, { ...order }]));
  const events = [];
  let failEventWrites = false;
  const order = {
    async updateMany({ where, data }) {
      const found = orders.get(where.id);
      if (!found || Object.entries(where).some(([key, value]) => found[key] !== value)) {
        return { count: 0 };
      }
      Object.assign(found, data);
      return { count: 1 };
    },
  };
  const orderStatusEvent = {
    async create({ data }) {
      if (failEventWrites) throw new Error("simulated failed event insert");
      events.push({ ...data });
      return { id: `event_${events.length}` };
    },
  };
  return {
    orders, events, order, orderStatusEvent,
    setFailEventWrites(value) { failEventWrites = value; },
    async $transaction(callback) {
      const before = [...orders].map(([id, value]) => [id, { ...value }]);
      const eventCount = events.length;
      try {
        return await callback({ order, orderStatusEvent });
      } catch (error) {
        orders.clear();
        for (const [id, value] of before) orders.set(id, value);
        events.splice(eventCount);
        throw error;
      }
    },
  };
}

const makeOrder = (id, tenant, changes = {}) => ({
  id, restaurantId: tenant, status: "NEW",
  paymentMethod: "CASH", paymentStatus: "PENDING", ...changes,
});

const statusInput = (overrides = {}) => ({
  id: "o1", restaurantId: "restaurantA",
  currentStatus: "NEW", nextStatus: "CONFIRMED", historyEnabled: false,
  ...overrides,
});

test("Real status write service changes only an owned order matching the old status", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA"), makeOrder("o2", "restaurantB")]);
  assert.equal(await writeOrderStatus(db, statusInput()), true);
  assert.equal(db.orders.get("o1").status, "CONFIRMED");
  assert.equal(db.orders.get("o2").status, "NEW");
  assert.deepEqual(db.events, []);
});

test("Cross-tenant and stale status writes modify no order", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA")]);
  assert.equal(await writeOrderStatus(db, statusInput({ restaurantId: "restaurantB" })), false);
  assert.equal(await writeOrderStatus(db, statusInput({ currentStatus: "PREPARING" })), false);
  assert.equal(db.orders.get("o1").status, "NEW");
});

test("Duplicate and concurrent status submissions succeed exactly once", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA")]);
  const results = await Promise.all([
    writeOrderStatus(db, statusInput()),
    writeOrderStatus(db, statusInput()),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await writeOrderStatus(db, statusInput()), false);
  assert.equal(db.orders.get("o1").status, "CONFIRMED");
});

test("Application policy denies invalid transitions before invoking the write service", () => {
  for (const current of ["DELIVERED", "CANCELLED"]) {
    for (const next of ["NEW", "CONFIRMED", "PREPARING", "DELIVERED"]) {
      assert.equal(canTransitionOrder(current, next), false);
    }
  }
});

test("History-enabled status write atomically creates one scoped audit event", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA")]);
  assert.equal(await writeOrderStatus(db, statusInput({ historyEnabled: true })), true);
  assert.deepEqual(db.events, [{
    orderId: "o1", restaurantId: "restaurantA",
    fromStatus: "NEW", toStatus: "CONFIRMED", actor: "RESTAURANT",
  }]);
  assert.equal(await writeOrderStatus(db, statusInput({ historyEnabled: true })), false);
  assert.equal(db.events.length, 1);
});

test("Failed audit insertion rolls back the order status update in a transaction", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA")]);
  db.setFailEventWrites(true);
  await assert.rejects(
    writeOrderStatus(db, statusInput({ historyEnabled: true })),
    /simulated failed event insert/
  );
  assert.equal(db.orders.get("o1").status, "NEW");
  assert.equal(db.events.length, 0);
});

test("History-enabled cross-tenant write does not create an audit event", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA")]);
  assert.equal(await writeOrderStatus(
    db, statusInput({ historyEnabled: true, restaurantId: "restaurantB" })
  ), false);
  assert.equal(db.events.length, 0);
  assert.equal(db.orders.get("o1").status, "NEW");
});

test("Cash receipt requires DELIVERED + CASH + PENDING and is tenant-scoped", async () => {
  const db = fakeDatabase([
    makeOrder("o1", "restaurantA", { status: "DELIVERED" }),
    makeOrder("o2", "restaurantB", { status: "DELIVERED" }),
    makeOrder("o3", "restaurantA", { status: "PREPARING" }),
    makeOrder("o4", "restaurantA", { status: "DELIVERED", paymentMethod: "ONLINE_CARD" }),
    makeOrder("o5", "restaurantA", { status: "DELIVERED", paymentStatus: "PAID" }),
  ]);
  const receipt = (id, restaurantId = "restaurantA") => writeCashReceipt(db, { id, restaurantId });
  assert.equal(await receipt("o2"), false);
  assert.equal(await receipt("o3"), false);
  assert.equal(await receipt("o4"), false);
  assert.equal(await receipt("o5"), false);
  assert.equal(await receipt("o1"), true);
  assert.equal(db.orders.get("o1").paymentStatus, "PAID");
  assert.equal(db.orders.get("o2").paymentStatus, "PENDING");
});

test("Duplicate or parallel cash confirmations cannot mark the same order twice", async () => {
  const db = fakeDatabase([makeOrder("o1", "restaurantA", { status: "DELIVERED" })]);
  const args = { id: "o1", restaurantId: "restaurantA" };
  const results = await Promise.all([
    writeCashReceipt(db, args),
    writeCashReceipt(db, args),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(await writeCashReceipt(db, args), false);
  assert.equal(db.orders.get("o1").paymentStatus, "PAID");
});
