import test from "node:test";
import assert from "node:assert/strict";
import { courierWhatsAppMessage, courierWhatsAppShareUrl } from "../app/lib/courier-whatsapp.ts";

function details() {
  return {
    restaurantName: "Test Restaurant",
    orderReference: "a1b2c3d4",
    orderedAt: "07.11.2026 16:42",
    customerName: "Elvin Məmmədov",
    customerPhone: "+994501112233",
    addressText: "Bakı, Nizami küçəsi 15, bina 2, blok A",
    latitude: 40.409264,
    longitude: 49.867092,
    customerNote: "Zəngi vurun, qapı 3",
    items: [
      { name: "Toyuq dönəri", quantity: 2, lineTotal: "14.90" },
      { name: "Ayran", quantity: 1, lineTotal: "2.50" },
    ],
    subtotal: "17.40",
    deliveryFee: "2.00",
    total: "19.40",
    paymentMethod: "Nağd",
    paymentStatus: "Ödəniş gözlənilir",
  };
}

test("Courier message includes customer, delivery pin, items, notes and payment, not tracking tokens", () => {
  const message = courierWhatsAppMessage(details());
  for (const value of [
    "Test Restaurant", "#a1b2c3d4", "07.11.2026 16:42", "Elvin Məmmədov",
    "+994501112233", "Nizami küçəsi 15", "49.867092", "40.409264",
    "Zəngi vurun, qapı 3", "2 × Toyuq dönəri", "1 × Ayran",
    "19.40 ₼", "Nağd", "Ödəniş gözlənilir", "Çatdırılma haqqı:"
  ]) assert.ok(message.includes(value), "missing: " + value);
  assert.match(message, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=40\.409264%2C49\.867092/);
  assert.doesNotMatch(message, /\/order\/track\/|\?t=|ADMIN_SESSION_SECRET|session=/);
});

test("WhatsApp share URL opens a recipient chooser, not a fixed customer number", () => {
  const url = new URL(courierWhatsAppShareUrl(details()));
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, "/");
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
  assert.equal(url.searchParams.get("text"), courierWhatsAppMessage(details()));
  assert.ok(url.searchParams.get("text").includes("Elvin Məmmədov"));
});

test("Older delivery orders without a map pin and optional notes remain shareable", () => {
  const message = courierWhatsAppMessage({
    ...details(), latitude: null, longitude: null, customerNote: null,
  });
  assert.match(message, /Müştəri xəritədə məkan seçməyib/);
  assert.match(message, /Müştəri qeydi:\* Yoxdur/);
  assert.doesNotMatch(message, /https:\/\/www\.google\.com\/maps\/search/);
});
