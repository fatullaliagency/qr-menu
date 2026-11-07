"use client";

import { courierWhatsAppShareUrl, type CourierShareDetails } from "@/app/lib/courier-whatsapp";

export default function CourierWhatsAppButton({ details }: { details: CourierShareDetails }) {
  function share() {
    // Explicit click only: never auto-send a customer's personal information.
    // WhatsApp shows the recipients and requires the operator to send the message.
    window.open(courierWhatsAppShareUrl(details), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800"
        aria-label="Kuryerlə WhatsApp-da paylaş"
      >
        <span aria-hidden="true">📲</span>
        Kuryerlə WhatsApp-da paylaş
      </button>
      <p className="text-xs text-gray-600">
        WhatsApp-da kuryeri seçin və göndərməni təsdiqləyin. Xəritə nöqtəsi canlı izləmə deyil.
      </p>
    </div>
  );
}
