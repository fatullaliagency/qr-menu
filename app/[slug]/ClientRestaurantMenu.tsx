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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const brandName = restaurant.name || "FATULLALİ";
  const subtitle =
    restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ";
  const slogan =
    restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!";
  const subDescription =
    restaurant.description ||
    "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada.";
  const wifiName = restaurant.wifiName || "Fatullali 1";
  const wifiPassword = restaurant.wifiPassword || "Fatullali12345";
  const address = restaurant.address || "Fətəli Xan Xoyski 98";
  const workingHours = restaurant.workingHours || "8:00 / 23:30";
  const bgImage =
    restaurant.bgImageUrl ||
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";
  const heroFoodImage =
    restaurant.heroFoodUrl ||
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
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

    const cleanPhone = restaurant.phone.replace(/[^0-9]/g, "");
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const cleanPhone = restaurant.phone.replace(/[^0-9]/g, "");

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#f5efe6] pb-32 font-sans selection:bg-amber-500 selection:text-black">
      {/* 1. ÜST VİTRİN (HERO) ALANI */}
      <section className="relative overflow-hidden border-b border-amber-500/20">
        {/* Arka Plan Görseli ve Karartma */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 scale-105"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0b0a09]/85 to-[#0b0a09]" />

        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          {/* Sol Taraf: Logo, İsim ve Sloganlar */}
          <div className="md:col-span-7 text-center flex flex-col items-center">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={brandName}
                className="w-24 h-24 md:w-28 md:h-28 object-contain mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-[#d4af37] flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(212,175,55,0.25)] bg-black/60">
                <span className="text-4xl md:text-5xl font-serif font-bold bg-gradient-to-b from-[#f3e5ab] via-[#d4af37] to-[#997a15] bg-clip-text text-transparent">
                  {brandName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <h1 className="text-4xl md:text-6xl font-serif tracking-[0.15em] uppercase font-bold bg-gradient-to-b from-[#fff6d6] via-[#d4af37] to-[#9a7b1c] bg-clip-text text-transparent">
              {brandName}
            </h1>

            <p className="text-xs md:text-sm tracking-[0.25em] text-amber-200/80 uppercase mt-2">
              {subtitle}
            </p>

            <h2 className="text-2xl md:text-4xl font-serif text-white mt-8 leading-snug max-w-lg">
              {slogan}
            </h2>

            {/* Altın Elmas Ayırıcı */}
            <div className="flex items-center gap-3 my-5 w-48 justify-center">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/70" />
              <span className="text-[#d4af37] text-sm">◇</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/70" />
            </div>

            <p className="text-sm md:text-base text-zinc-300 max-w-md">
              {subDescription}
            </p>
          </div>

          {/* Sağ Taraf: Telefon Maketi ve "Menyuya baxın" Butonu */}
          <div className="md:col-span-5 flex justify-center">
            <div className="w-64 sm:w-72 rounded-[2.5rem] border-[3px] border-[#d4af37]/60 bg-[#12100e] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(212,175,55,0.15)] transform md:-rotate-2 hover:rotate-0 transition duration-500">
              <div className="w-20 h-4 bg-black rounded-full mx-auto mb-3 border border-zinc-800" />
              <div className="rounded-[2rem] overflow-hidden bg-gradient-to-b from-[#1a1612] to-[#0d0b09] border border-amber-500/20 p-4 flex flex-col items-center text-center">
                {restaurant.logoUrl ? (
                  <img
                    src={restaurant.logoUrl}
                    alt={brandName}
                    className="w-12 h-12 object-contain mb-1"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full border border-[#d4af37] flex items-center justify-center mb-1">
                    <span className="text-lg font-serif font-bold text-[#d4af37]">
                      {brandName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-serif text-lg tracking-widest uppercase text-[#e6c665] font-semibold">
                  {brandName}
                </span>
                <span className="text-[9px] tracking-[0.3em] text-zinc-400 uppercase mb-3">
                  — RESTORAN —
                </span>

                <div className="w-full h-44 rounded-2xl overflow-hidden mb-4 border border-amber-500/20 shadow-inner">
                  <img
                    src={heroFoodImage}
                    alt="Special Dish"
                    className="w-full h-full object-cover hover:scale-105 transition duration-500"
                  />
                </div>

                <button
                  onClick={scrollToMenu}
                  className="w-full py-2.5 px-4 rounded-xl bg-black/80 border border-[#d4af37]/60 text-white hover:bg-[#d4af37] hover:text-black transition flex items-center justify-between text-sm font-medium group"
                >
                  <span>Menyuya baxın</span>
                  <span className="w-7 h-7 rounded-full border border-[#d4af37] flex items-center justify-center group-hover:border-black transition">
                    →
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANA İÇERİK KAPSAYICISI */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10 mt-10">
        {/* 2. BİZİM ÜSTÜNLÜKLƏRİMİZ */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <h3 className="text-xs sm:text-sm tracking-[0.3em] uppercase text-[#e5c158] font-medium text-center">
              BİZİM ÜSTÜNLÜKLƏRİMİZ
            </h3>
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
                className="bg-[#121110] border border-[#d4af37]/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-[#d4af37] transition"
              >
                <div className="w-12 h-12 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-xl mb-3 bg-black/40">
                  {feat.icon}
                </div>
                <p className="text-xs sm:text-sm text-zinc-200 whitespace-pre-line font-medium leading-tight">
                  {feat.title}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. WI-FI VE İLETİŞİM KARTLARI */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sol Kutu: Wi-Fi */}
          <div className="bg-[#121110] border border-[#d4af37]/35 rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center gap-4 pb-4 border-b border-amber-500/20">
              <div className="w-12 h-12 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-2xl text-[#d4af37]">
                📶
              </div>
              <div>
                <h4 className="text-xl font-bold text-white">Wi-Fi</h4>
                <p className="text-xs text-zinc-400">
                  Sürətli və stabil internet
                </p>
              </div>
            </div>

            <div className="space-y-4 mt-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Şəbəkə:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{wifiName}</span>
                  <button
                    onClick={() => copyToClipboard(wifiName, "wifiName")}
                    className="p-1.5 rounded-lg border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition text-xs"
                    title="Kopyala"
                  >
                    {copiedText === "wifiName" ? "✓" : "📋"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Şifrə:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {wifiPassword}
                  </span>
                  <button
                    onClick={() => copyToClipboard(wifiPassword, "wifiPass")}
                    className="p-1.5 rounded-lg border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition text-xs"
                    title="Şifrəni Kopyala"
                  >
                    {copiedText === "wifiPass" ? "✓" : "📋"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sağ Kutu: Bizimlə əlaqə saxlayın */}
          <div className="bg-[#121110] border border-[#d4af37]/35 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[#d4af37] text-xl">🔗</span>
              <h4 className="text-lg font-bold text-white">
                Bizimlə əlaqə saxlayın
              </h4>
            </div>

            {/* Sosyal İkonlar */}
            <div className="flex items-center gap-3 pb-4 border-b border-amber-500/20">
              {restaurant.facebookUrl && (
                <a
                  href={restaurant.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition font-bold"
                >
                  f
                </a>
              )}
              {restaurant.instagramUrl && (
                <a
                  href={restaurant.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition"
                >
                  📸
                </a>
              )}
              {restaurant.mapUrl && (
                <a
                  href={restaurant.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition"
                >
                  📍
                </a>
              )}
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition"
              >
                💬
              </a>
            </div>

            <div className="space-y-2.5 mt-4 text-xs sm:text-sm">
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-400">📞 Telefon:</span>
                <a
                  href={`tel:+${cleanPhone}`}
                  className="text-white font-medium hover:text-[#d4af37]"
                >
                  {restaurant.phone}
                </a>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-400">💬 WhatsApp:</span>
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white font-medium hover:text-[#d4af37]"
                >
                  {restaurant.phone}
                </a>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-800/80">
                <span className="text-zinc-400">📍 Ünvan:</span>
                <span className="text-white font-medium text-right">
                  {address}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">🍴 {brandName}:</span>
                <span className="text-white font-medium text-right">
                  {address}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. İŞ SAATLARI KUTUSU */}
        <section className="bg-[#121110] border border-[#d4af37]/35 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#d4af37] flex items-center justify-center text-xl text-[#d4af37]">
              🕒
            </div>
            <div>
              <h4 className="text-xl font-bold text-white">İş saatları</h4>
              <p className="text-xs text-zinc-400">Sizin rahatlığınız üçün</p>
            </div>
          </div>

          <div className="border border-[#d4af37]/50 rounded-xl px-6 py-2.5 text-center bg-black/50">
            <span className="text-xs text-zinc-400 block">Açıq saatlar:</span>
            <span className="text-xl sm:text-2xl font-bold text-white tracking-wider">
              {workingHours}
            </span>
          </div>
        </section>

        {/* 5. RƏQƏMSAL MENYU BÖLÜMÜ */}
        <section id="menu-section" className="pt-6 space-y-8">
          <div className="flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/60" />
            <h2 className="text-xl sm:text-2xl font-serif tracking-[0.2em] uppercase text-[#e5c158] font-bold text-center">
              MENYUMUZ
            </h2>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/60" />
          </div>

          {restaurant.categories.length === 0 ? (
            <div className="bg-[#121110] border border-[#d4af37]/30 p-8 rounded-2xl text-center text-zinc-400">
              Bu restoranda hələ menyu əlavə edilməyib.
            </div>
          ) : (
            restaurant.categories.map((category) => (
              <div
                key={category.id}
                className="bg-[#121110] p-6 rounded-3xl border border-[#d4af37]/30 shadow-lg"
              >
                <h3 className="text-xl sm:text-2xl font-serif font-bold mb-5 pb-3 border-b border-[#d4af37]/25 text-[#f3e5ab]">
                  {category.name}
                </h3>

                {category.menuItems.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic">
                    Bu kateqoriyada məhsul yoxdur.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {category.menuItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-[#d4af37]/25 rounded-2xl p-4 flex justify-between items-center gap-4 hover:border-[#d4af37] transition bg-[#181614]"
                      >
                        <div className="flex items-center gap-3.5">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[#d4af37]/40"
                            />
                          )}
                          <div>
                            <h4 className="font-bold text-white text-base">
                              {item.name}
                            </h4>
                            {item.description && (
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            <p className="text-[#d4af37] font-bold mt-2 text-base">
                              {item.price.toFixed(2)} ₼
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => addToCart(item)}
                          className="w-10 h-10 rounded-full bg-gradient-to-b from-[#e6c665] to-[#b58e24] text-black font-bold text-xl flex items-center justify-center shrink-0 hover:scale-105 transition shadow-md"
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
        </section>

        {/* 6. ALT BİLGİ (FOOTER) */}
        <footer className="pt-12 pb-6 text-center border-t border-[#d4af37]/20 space-y-2">
          <div className="flex items-center justify-center gap-3">
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt={brandName}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-[#d4af37] flex items-center justify-center">
                <span className="font-serif font-bold text-[#d4af37]">
                  {brandName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-serif text-xl tracking-[0.2em] uppercase text-[#e6c665] font-bold">
              {brandName}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            © 2026 {brandName} Restoran · Bütün hüquqlar qorunur.
          </p>
          <p className="text-xs text-zinc-400">Made with ❤️ in Azerbaijan</p>
        </footer>
      </div>

      {/* ALT SƏBƏT VƏ WHATSAPP SİFARİŞ PANELİ */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121110]/95 backdrop-blur-md border-t border-[#d4af37]/50 p-4 shadow-2xl z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-x-auto w-full sm:w-auto py-1">
              {cart.map((c) => (
                <div
                  key={c.item.id}
                  className="flex items-center gap-2 bg-black border border-[#d4af37]/40 px-3 py-1.5 rounded-xl text-xs shrink-0 text-white"
                >
                  <span className="font-bold text-[#d4af37]">
                    {c.quantity}x
                  </span>
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
                <span className="text-lg font-bold text-[#d4af37]">
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>

              <button
                onClick={sendWhatsAppOrder}
                className="bg-gradient-to-r from-[#d4af37] to-[#b58e24] text-black px-6 py-3 rounded-xl font-bold hover:brightness-110 transition shadow-md"
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
