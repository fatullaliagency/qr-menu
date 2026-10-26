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

  const brandName = restaurant.name || "FATULLALİ";
  const subtitle = restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ";
  const slogan = restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!";
  const description =
    restaurant.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada.";
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
  const cleanPhone = restaurant.phone.replace(/[^0-9]/g, "");

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const scrollToMenu = () => {
    document.getElementById("menyu-bolmesi")?.scrollIntoView({ behavior: "smooth" });
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
        .map((i) => (i.item.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((sum, i) => sum + i.item.price * i.quantity, 0);

  const sendWhatsAppOrder = () => {
    if (cart.length === 0) return;
    const orderLines = cart.map(
      (i) => `• ${i.quantity}x ${i.item.name} (${(i.item.price * i.quantity).toFixed(2)} ₼)`
    );
    const message = `Salam *${brandName}*! 👋\nYeni sifarişim var:\n\n${orderLines.join(
      "\n"
    )}\n\n*Cəmi:* ${totalAmount.toFixed(2)} ₼`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const renderLogo = (small = false) => {
    if (restaurant.logoUrl) {
      return (
        <img
          src={restaurant.logoUrl}
          alt={brandName}
          className={`${small ? "w-12 h-12" : "w-24 h-24"} object-contain mx-auto mb-2`}
        />
      );
    }
    return (
      <div
        className={`${
          small ? "w-11 h-11 text-base" : "w-20 h-20 text-2xl"
        } mx-auto mb-3 rounded-full border-2 border-[#d4af37] bg-[#1a140b] flex items-center justify-center font-serif font-bold text-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.3)]`}
      >
        {brandName.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0908] text-[#f5f0e6] pb-32">
      {/* 1. ÜST VİTRİN */}
      <div className="relative overflow-hidden border-b border-[#d4af37]/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0a0908]/85 to-[#0a0908]" />

        <div className="relative max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7 text-center space-y-4">
            {renderLogo(false)}
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-wider uppercase text-[#e5c158]">
              {brandName}
            </h1>
            <p className="text-xs md:text-sm tracking-[0.25em] uppercase text-[#d8ccb8]">
              {subtitle}
            </p>
            <h2 className="text-2xl md:text-3xl font-serif text-white pt-2">{slogan}</h2>
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="h-[1px] w-20 bg-[#d4af37]/60" />
              <span className="text-[#d4af37]">◇</span>
              <div className="h-[1px] w-20 bg-[#d4af37]/60" />
            </div>
            <p className="text-sm text-[#b8ae9c] max-w-md mx-auto">{description}</p>
          </div>

          <div className="md:col-span-5 flex justify-center">
            <div className="w-64 rounded-[38px] border-[3px] border-[#d4af37]/60 bg-[#0e0c0a] p-3 shadow-2xl">
              <div className="w-16 h-3 bg-black rounded-full mx-auto mb-2 border border-[#d4af37]/20" />
              <div className="text-center">
                {renderLogo(true)}
                <div className="font-serif font-bold text-lg tracking-widest uppercase text-[#e5c158]">
                  {brandName}
                </div>
                <div className="text-[10px] tracking-[0.2em] text-[#a39783]">— RESTORAN —</div>
              </div>
              <div className="my-3 rounded-2xl overflow-hidden border border-[#d4af37]/30 h-40">
                <img src={heroFoodImage} alt={brandName} className="w-full h-full object-cover" />
              </div>
              <button
                onClick={scrollToMenu}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#18140f] border border-[#d4af37]/50 flex items-center justify-between text-sm font-medium text-white hover:border-[#d4af37]"
              >
                <span>Menyuya baxın</span>
                <span className="w-7 h-7 rounded-full border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
                  →
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ÜSTÜNLÜKLƏR VƏ MƏLUMAT KARTLARI */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-center gap-4">
          <div className="h-[1px] flex-1 bg-[#d4af37]/30" />
          <span className="text-xs tracking-[0.3em] uppercase text-[#dfd3be]">
            BİZİM ÜSTÜNLÜKLƏRİMİZ
          </span>
          <div className="h-[1px] flex-1 bg-[#d4af37]/30" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { t: "Zəngin\nMenyu", i: "🍴" },
            { t: "Peşəkar\nKulinariya", i: "👨‍🍳" },
            { t: "Sürətli\nXidmət", i: "🛎️" },
            { t: "Keyfiyyət\nZəmanəti", i: "🛡️" },
            { t: "Rahat\nAtmosfer", i: "✨" },
          ].map((f, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#d4af37]/35 bg-[#12100e] p-4 flex flex-col items-center text-center gap-2"
            >
              <div className="w-12 h-12 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-xl">
                {f.i}
              </div>
              <p className="text-xs sm:text-sm font-medium whitespace-pre-line">{f.t}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wi-Fi Kartı */}
          <div className="rounded-2xl border border-[#d4af37]/35 bg-[#12100e] p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-[#d4af37]/20 pb-4">
              <span className="text-2xl">📶</span>
              <div>
                <h3 className="text-lg font-bold text-white">Wi-Fi</h3>
                <p className="text-xs text-[#b8ae9c]">Sürətli və stabil internet</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[#b8ae9c]">Şəbəkə:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{wifiName}</span>
                  <button
                    onClick={() => copyText(wifiName, "w1")}
                    className="text-xs px-2 py-0.5 rounded border border-[#d4af37]/50 text-[#d4af37]"
                  >
                    {copiedField === "w1" ? "✓" : "📋"}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#b8ae9c]">Şifrə:</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{wifiPassword}</span>
                  <button
                    onClick={() => copyText(wifiPassword, "w2")}
                    className="text-xs px-2 py-0.5 rounded border border-[#d4af37]/50 text-[#d4af37]"
                  >
                    {copiedField === "w2" ? "✓" : "📋"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Əlaqə Kartı */}
          <div className="rounded-2xl border border-[#d4af37]/35 bg-[#12100e] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <h3 className="text-lg font-bold text-white">🔗 Bizimlə əlaqə saxlayın</h3>
              <div className="flex gap-2">
                {restaurant.instagramUrl && (
                  <a
                    href={restaurant.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-xs"
                  >
                    📸
                  </a>
                )}
                {restaurant.mapUrl && (
                  <a
                    href={restaurant.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-xs"
                  >
                    📍
                  </a>
                )}
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#d4af37]/60 flex items-center justify-center text-xs"
                >
                  💬
                </a>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-[#b8ae9c]">📞 Telefon:</span>
                <span className="text-white">{restaurant.phone}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-[#b8ae9c]">💬 WhatsApp:</span>
                <span className="text-white">{restaurant.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b8ae9c]">📍 Ünvan:</span>
                <span className="text-white text-right">{address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* İş Saatları */}
        <div className="rounded-2xl border border-[#d4af37]/35 bg-[#12100e] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕒</span>
            <div>
              <h3 className="text-lg font-bold text-white">İş saatları</h3>
              <p className="text-xs text-[#b8ae9c]">Sizin rahatlığınız üçün</p>
            </div>
          </div>
          <div className="border border-[#d4af37]/50 rounded-xl px-5 py-2 text-center bg-[#181511]">
            <span className="block text-xs text-[#b8ae9c]">Açıq saatlar:</span>
            <span className="text-lg font-bold text-white">{workingHours}</span>
          </div>
        </div>
      </div>

      {/* 3. RƏQƏMSAL MENYU */}
      <div id="menyu-bolmesi" className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <h2 className="text-center font-serif text-2xl font-bold text-[#e5c158] tracking-widest uppercase">
          — MENYU —
        </h2>

        {restaurant.categories.map((category) => (
          <div
            key={category.id}
            className="rounded-3xl border border-[#d4af37]/30 bg-[#12100e] p-6"
          >
            <h3 className="text-xl font-serif font-bold mb-4 pb-2 border-b border-[#d4af37]/25 text-[#f3d478]">
              {category.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {category.menuItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#d4af37]/20 rounded-2xl p-4 flex justify-between items-center gap-3 bg-[#181512]"
                >
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#d4af37]/30"
                      />
                    )}
                    <div>
                      <h4 className="font-bold text-white">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-[#b8ae9c] mt-0.5">{item.description}</p>
                      )}
                      <p className="text-[#e5c158] font-bold mt-1">
                        {item.price.toFixed(2)} ₼
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-9 h-9 rounded-full bg-[#e5c158] text-black font-bold text-lg flex items-center justify-center shrink-0"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 4. FOOTER */}
      <footer className="text-center py-8 border-t border-[#d4af37]/20 mt-8 text-xs text-[#8c8273] space-y-1">
        <div className="font-serif font-bold text-base text-[#e5c158] uppercase">
          {brandName} RESTORAN
        </div>
        <p>© 2026 {brandName} Restoran · Bütün hüquqlar qorunur.</p>
      </footer>

      {/* 5. ALT SƏBƏT PANELİ */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#12100e] border-t border-[#d4af37]/50 p-4 shadow-2xl z-50">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {cart.map((c) => (
                <div
                  key={c.item.id}
                  className="flex items-center gap-2 bg-[#1d1915] border border-[#d4af37]/30 px-3 py-1 rounded-xl text-xs text-white shrink-0"
                >
                  <span className="font-bold text-[#e5c158]">{c.quantity}x</span>
                  <span>{c.item.name}</span>
                  <button
                    onClick={() => removeFromCart(c.item.id)}
                    className="text-red-400 font-bold ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
              <div>
                <span className="text-xs text-[#b8ae9c] block">Cəmi:</span>
                <span className="text-lg font-bold text-[#e5c158]">
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>
              <button
                onClick={sendWhatsAppOrder}
                className="bg-[#e5c158] text-black px-5 py-2.5 rounded-xl font-bold"
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
