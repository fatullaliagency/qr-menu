import { deliveryMapUrl } from "./delivery-location.ts";

/** Only the signed-in restaurant owner/staff can see and explicitly share this data. */
export type CourierShareDetails = {
  restaurantName: string;
  orderReference: string;
  orderedAt: string;
  customerName: string;
  customerPhone: string | null;
  addressText: string | null;
  latitude: number | null;
  longitude: number | null;
  customerNote: string | null;
  items: { name: string; quantity: number; lineTotal: string }[];
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
};

export function courierWhatsAppMessage(details: CourierShareDetails): string {
  const location = deliveryMapUrl(details.latitude, details.longitude);
  const products = details.items.map((item) =>
    "• " + item.quantity + " × " + item.name + " — " + item.lineTotal + " ₼"
  );
  return [
    "🚚 *Çatdırılma sifarişi — kuryer üçün*",
    "🏪 *Restoran:* " + details.restaurantName,
    "🧾 *Sifariş:* #" + details.orderReference,
    "🕒 *Vaxt:* " + details.orderedAt,
    "",
    "👤 *Ad və soyad:* " + details.customerName,
    "📞 *Telefon:* " + (details.customerPhone || "Qeyd edilməyib"),
    "🏠 *Çatdırılma ünvanı:* " + (details.addressText || "Qeyd edilməyib"),
    "📍 *Xəritədə sabit məkan:* " + (location ?? "Müştəri xəritədə məkan seçməyib"),
    "📝 *Müştəri qeydi:* " + (details.customerNote || "Yoxdur"),
    "",
    "🍽 *Sifarişin tərkibi:*",
    ...(products.length ? products : ["Qeyd edilməyib"]),
    "",
    "🧮 *Məhsullar:* " + details.subtotal + " ₼",
    "🚚 *Çatdırılma haqqı:* " + details.deliveryFee + " ₼",
    "💰 *Cəmi:* " + details.total + " ₼",
    "💳 *Ödəniş üsulu:* " + details.paymentMethod,
    "✅ *Ödəniş statusu:* " + details.paymentStatus,
  ].join("\n");
}

/** Without a courier number, WhatsApp itself opens the recipient chooser. */
export function courierWhatsAppShareUrl(details: CourierShareDetails): string {
  return "https://wa.me/?text=" + encodeURIComponent(courierWhatsAppMessage(details));
}
