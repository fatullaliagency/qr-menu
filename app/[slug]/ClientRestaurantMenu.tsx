"use client";

import { useState } from "react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  phone: string;
  subtitle?: string | null;
  slogan?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bgImageUrl?: string | null;
  heroFoodUrl?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  address?: string | null;
  workingHours?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  mapUrl?: string | null;
  categories: Category[];
}

export default function ClientRestaurantMenu({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const displayTitle = (restaurant.name || "FATULLALİ").toUpperCase();
  const subtitle =
    restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ";
  const slogan =
    restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!";
  const description =
    restaurant.description ||
    "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada.";
  const bgImage =
    restaurant.bgImageUrl ||
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";
  const heroFood =
    restaurant.heroFoodUrl ||
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80";
  const wifiName = restaurant.wifiName || "Fatullali 1";
  const wifiPassword = restaurant.wifiPassword || "Fatullali12345";
  const address = restaurant.address || "Fətəli Xan Xoyski 98";
  const workingHours = restaurant.workingHours || "8:00 / 23:30";
  const cleanPhone = (restaurant.phone || "").replace(/[^0-9]/g, "");

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const scrollToMenu = () => {
    const el = document.getElementById("menu-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce(
    (sum, i) => sum + i.item.price * i.quantity,
    0
  );

  const sendWhatsAppOrder = () => {
    if (cart.length === 0) return;

    const orderLines = cart.map(
      (i) =>
        `• ${i.quantity}x ${i.item.name} (${(i.item.price * i.quantity).toFixed(
          2
        )} ₼)`
    );

    const message = `Salam *${restaurant.name}*! 👋\nYeni sifarişim var:\n\n${orderLines.join(
      "\n"
    )}\n\n*Cəmi:* ${totalAmount.toFixed(2)} ₼`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const renderLogo = (size: "lg" | "sm" = "lg") => {
    if (restaurant.logoUrl) {
      return (
        <img
          src={restaurant.logoUrl}
          alt={restaurant.name}
          className={
            size === "lg"
              ? "w-24 h-24 object-contain mx-auto mb-3"
              : "w-14 h-14 object-contain mx-auto mb-2"
          }
        />
      );
    }
    return (
      <div
        className={`${
          size === "lg" ? "w-20 h-20" : "w-12 h-12"
        } mx-auto mb-3 rounded-full border-2 border-[#d4af37] bg-black/60 flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.35)]`}
      >
        <span
          className={`${
            size === "lg" ? "text-3xl" : "text-xl"
          } font-serif font-bold text-[#d4af37]`}
        >
          {displayTitle.charAt(0)}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white pb-28 selection:bg-[#d4af37] selection:text-black">
      {/* 1. ÜST VİTRİN (HERO ALANI) */}
      <div className="relative overflow-hidden border-b border-[#d4af37]/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35 scale-105"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/65 to-[#070707]" />

        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-10">
          {/* Sol Tərəf: Loqo, Ad və Şüar */}
          <div className="flex-1 text-center space-y-4">
            {renderLogo("lg")}
            <h1 className="text-4xl md:text-5xl font-serif tracking-[0.18em] text-[#e5c158] font-semibold">
              {displayTitle}
            </h1>
            <p className="text-xs md:text-sm tracking-[0.25em] text-zinc-300 uppercase">
              {subtitle}
            </p>

            <div className="pt-4 space-y-3">
              <h2 className="text-2xl md:text-3xl font-medium text-white leading-snug max-w-md mx-auto">
                {slogan}
              </h2>

              <div className="flex items-center justify-center gap-3 py-1">
                <div className="h-[1px] w-20 bg-gradient-to-r from-transparent to-[#d4af37]/70" />
                <div className="w-2 h-2 rotate-45 border border-[#d4af37]" />
                <div className="h-[1px] w-20 bg-gradient-to-l from-transparent to-[#d4af37]/70" />
              </div>

              <p className="text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Sağ Tərəf: 3D Telefon Maketi və "Menyuya baxın" Düyməsi */}
          <div className="w-64 sm:w-72 shrink-0">
            <div className="rounded-[2.5rem] border-[3px] border-[#d4af37]/60 bg-[#0c0c0c] p-3 shadow-[0_0_50px_rgba(0,0,0,0.9)]">
              <div className="rounded-[2rem] overflow-hidden bg-zinc-950 border border-[#d4af37]/20 flex flex-col">
                <div className="pt-5 pb-3 px-4 text-center bg-gradient-to-b from-black to-zinc-900">
                  {renderLogo("sm")}
                  <div className="text-lg font-serif tracking-[0.15em] text-[#e5c158]">
                    {displayTitle}
                  </div>
                  <div className="text-[10px] tracking-[0.25em] text-zinc-400 uppercase">
                    — RESTORAN —
                  </div>
                </div>

                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={heroFood}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>

                <div className="p-4 bg-black">
                  <button
                    onClick={scrollToMenu}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-full bg-zinc-900/90 hover:bg-[#d4af37] hover:text-black text-white border border-[#d4af37]/40 transition group text-sm font-medium"
                  >
                    <span>Menyuya baxın</span>
                    <span className="w-7 h-7 rounded-full border border-[#d4af37]/60 group-hover:border-black flex items-center justify-center text-xs">
                      →
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BİZİM ÜSTÜNLÜKLƏRİMİZ */}
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/40" />
          <span className="text-xs sm:text-sm tracking-[0.3em] text-[#e5c158] uppercase font-medium">
            BİZİM ÜSTÜNLÜKLƏRİMİZ
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/40" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { title: "Zəngin\nMenyu", icon: "🍴" },
            { title: "Peşəkar\nKulinariya", icon: "👨‍🍳" },
            { title: "Sürətli\nXidmət", icon: "🛎️" },
            { title: "Keyfiyyət\nZəmanəti", icon: "🛡️" },
            { title: "Rahat\nAtmosfer", icon: "✨" },
          ].map((feat, idx) => (
            <div
              key={idx}
              className="border border-[#d4af37]/30 rounded-2xl bg-[#0e0e0e] p-4 flex flex-col items-center justify-center text-center gap-3 hover:border-[#d4af37] transition"
            >
              <div className="w-12 h-12 rounded-full border border-[#d4af37]/50 flex items-center justify-center text-xl">
                {feat.icon}
              </div>
              <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-line leading-snug">
                {feat.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. WI-FI VƏ BİZİMLƏ ƏLAQƏ SAXLAYIN */}
      <div className="max-w-4xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Wi-Fi Qutusu */}
        <div className="border border-[#d4af37]/30 rounded-2xl bg-[#0e0e0e] p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
            <div className="text-3xl text-[#e5c158]">📶</div>
            <div>
              <h3 className="text-xl font-semibold text-white">Wi-Fi</h3>
              <p className="text-xs text-zinc-400">
                Sürətli və stabil internet
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Şəbəkə:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{wifiName}</span>
                <button
                  onClick={() => copyToClipboard(wifiName, "wifiName")}
                  className="text-[#e5c158] hover:text-white text-xs border border-[#d4af37]/40 px-2 py-1 rounded"
                >
                  {copiedField === "wifiName" ? "✓" : "📋"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Şifrə:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{wifiPassword}</span>
                <button
                  onClick={() => copyToClipboard(wifiPassword, "wifiPass")}
                  className="text-[#e5c158] hover:text-white text-xs border border-[#d4af37]/40 px-2 py-1 rounded"
                >
                  {copiedField === "wifiPass" ? "✓" : "📋"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bizimlə əlaqə saxlayın Qutusu */}
        <div className="border border-[#d4af37]/30 rounded-2xl bg-[#0e0e0e] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xl text-[#e5c158]">🔗</span>
            <h3 className="text-base font-semibold text-white">
              Bizimlə əlaqə saxlayın
            </h3>
          </div>

          {/* Sosial İkonlar */}
          <div className="flex items-center justify-center gap-3 pb-3 border-b border-zinc-800">
            <a
              href={restaurant.facebookUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full border border-[#d4af37]/50 flex items-center justify-center text-[#e5c158] hover:bg-[#d4af37] hover:text-black transition font-bold"
            >
              f
            </a>
            <a
              href={restaurant.instagramUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full border border-[#d4af37]/50 flex items-center justify-center text-[#e5c158] hover:bg-[#d4af37] hover:text-black transition text-sm"
            >
              📷
            </a>
            <a
              href={restaurant.mapUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full border border-[#d4af37]/50 flex items-center justify-center text-[#e5c158] hover:bg-[#d4af37] hover:text-black transition text-sm"
            >
              📍
            </a>
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noreferrer"
              className="w-10 h-10 rounded-full border border-[#d4af37]/50 flex items-center justify-center text-[#e5c158] hover:bg-[#d4af37] hover:text-black transition text-sm"
            >
              💬
            </a>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between py-1 border-b border-zinc-800/70">
              <span className="text-zinc-400">📞 Telefon:</span>
              <span className="text-white font-medium">{restaurant.phone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/70">
              <span className="text-zinc-400">💬 WhatsApp:</span>
              <span className="text-white font-medium">{restaurant.phone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-800/70">
              <span className="text-zinc-400">📍 Ünvan:</span>
              <span className="text-white font-medium">{address}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">🍴 {restaurant.name}:</span>
              <span className="text-white font-medium">{address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. İŞ SAATLARI QUTUSU */}
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="border border-[#d4af37]/30 rounded-2xl bg-[#0e0e0e] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#d4af37] flex items-center justify-center text-xl text-[#e5c158]">
              🕒
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">İş saatları</h3>
              <p className="text-xs text-zinc-400">Sizin rahatlığınız üçün</p>
            </div>
          </div>

          <div className="border border-[#d4af37]/40 rounded-xl px-6 py-2.5 text-center bg-black/50">
            <span className="text-[11px] text-zinc-400 block">Açıq saatlar:</span>
            <span className="text-lg font-bold text-white tracking-wider">
              {workingHours}
            </span>
          </div>
        </div>
      </div>

      {/* 5. RƏQƏMSAL MENYU BÖLMƏSİ */}
      <div id="menu-section" className="max-w-4xl mx-auto px-4 pt-12 space-y-8">
        <div className="flex items-center justify-center gap-4">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/40" />
          <span className="text-base sm:text-lg tracking-[0.25em] text-[#e5c158] uppercase font-serif font-semibold">
            MENYU
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/40" />
        </div>

        {restaurant.categories.length === 0 ? (
          <div className="border border-[#d4af37]/20 bg-[#0e0e0e] p-8 rounded-2xl text-center text-zinc-400">
            Bu restoranda hələ menyu əlavə edilməyib.
          </div>
        ) : (
          restaurant.categories.map((category) => (
            <div
              key={category.id}
              className="bg-[#0e0e0e] p-6 rounded-3xl border border-[#d4af37]/25 space-y-4"
            >
              <h2 className="text-xl font-bold pb-3 border-b border-[#d4af37]/20 text-[#e5c158]">
                {category.name}
              </h2>

              {category.menuItems.length === 0 ? (
                <p className="text-zinc-500 text-sm italic">
                  Bu kateqoriyada məhsul yoxdur.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-zinc-800 hover:border-[#d4af37]/50 rounded-2xl p-4 flex justify-between items-center gap-4 transition bg-[#141414]"
                    >
                      <div className="flex items-center gap-3.5">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[#d4af37]/30"
                          />
                        )}
                        <div>
                          <h3 className="font-bold text-white">{item.name}</h3>
                          {item.description && (
                            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <p className="text-[#e5c158] font-bold mt-2">
                            {item.price.toFixed(2)} ₼
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        className="w-10 h-10 rounded-full bg-[#d4af37] text-black font-bold text-xl flex items-center justify-center shrink-0 hover:bg-[#e5c158] transition shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 6. ALT BİLGİ (FOOTER) */}
      <div className="max-w-4xl mx-auto px-4 pt-14 pb-8 text-center space-y-2 border-t border-[#d4af37]/15 mt-12">
        {renderLogo("sm")}
        <div className="text-xl font-serif tracking-[0.2em] text-[#e5c158]">
          {displayTitle}
        </div>
        <div className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase pb-2">
          — RESTORAN —
        </div>
        <p className="text-xs text-zinc-400">
          © 2026 {restaurant.name} Restoran · Bütün hüquqlar qorunur.
        </p>
        <p className="text-xs text-zinc-500">Made with ❤️ in Azerbaijan</p>
      </div>

      {/* Alt Səbət və WhatsApp Sifariş Paneli */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-[#d4af37]/40 p-4 shadow-2xl z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto w-full sm:w-auto py-1">
              {cart.map((c) => (
                <div
                  key={c.item.id}
                  className="flex items-center gap-2 bg-zinc-900 border border-[#d4af37]/30 text-white px-3 py-1.5 rounded-xl text-xs shrink-0"
                >
                  <span className="font-bold text-[#e5c158]">{c.quantity}x</span>
                  <span>{c.item.name}</span>
                  <button
                    onClick={() => removeFromCart(c.item.id)}
                    className="text-red-400 font-bold ml-1 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0">
              <div className="text-left sm:text-right">
                <span className="text-xs text-zinc-400 block">Cəmi Məbləğ</span>
                <span className="text-lg font-bold text-[#e5c158]">
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>

              <button
                onClick={sendWhatsAppOrder}
                className="bg-[#d4af37] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#e5c158] transition shadow-md"
              >
                WhatsApp ilə Sifariş Ver →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
