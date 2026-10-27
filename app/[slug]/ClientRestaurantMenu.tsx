"use client";

import { useState } from "react";

export default function ClientRestaurantMenu({ restaurant }: { restaurant: any }) {
  const [cart, setCart] = useState<{ item: any; quantity: number }[]>([]);
  const [copied, setCopied] = useState<string>("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const brandName = restaurant.name ? restaurant.name : "RESTORAN";
  const subtitle = restaurant.subtitle ? restaurant.subtitle : "MİLLİ VƏ AVROPA MƏTBƏXİ";
  const slogan = restaurant.slogan ? restaurant.slogan : "Zövqünüzə uyğun təamlarla xidmətinizdəyik!";
  const desc = restaurant.description ? restaurant.description : "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada.";
  const wifiName = restaurant.wifiName ? restaurant.wifiName : `${brandName} WiFi`;
  const wifiPass = restaurant.wifiPassword ? restaurant.wifiPassword : "12345678";
  const address = restaurant.address ? restaurant.address : "Bakı şəhəri";
  const hours = restaurant.workingHours ? restaurant.workingHours : "09:00 / 23:30";
  const bgImg = restaurant.bgImageUrl
    ? restaurant.bgImageUrl
    : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80";
  const foodImg = restaurant.heroFoodUrl
    ? restaurant.heroFoodUrl
    : "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80";
  const cleanPhone = String(restaurant.phone ?? "").replace(/[^0-9]/g, "");

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.item.id === item.id);
      if (ex) {
        return prev.map((i) => (i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) =>
      prev
        .map((i) => (i.item.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const totalAmount = cart.reduce((sum, i) => sum + i.item.price * i.quantity, 0);

  const sendWhatsAppOrder = () => {
    if (cart.length === 0) return;
    const lines = cart.map((i) => `• ${i.quantity}x ${i.item.name} (${(i.item.price * i.quantity).toFixed(2)} ₼)`);
    const msg = `Salam *${brandName}*! 👋\nYeni sifarişim var:\n\n${lines.join("\n")}\n\n*Cəmi:* ${totalAmount.toFixed(2)} ₼`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const LogoBadge = ({ small = false }: { small?: boolean }) =>
    restaurant.logoUrl ? (
      <img
        src={restaurant.logoUrl}
        alt={brandName}
        className={`${small ? "w-12 h-12" : "w-20 h-20"} object-cover mx-auto mb-2 rounded-full border-2 border-[#d4af37]`}
      />
    ) : (
      <div
        className={`${
          small ? "w-12 h-12 text-lg" : "w-20 h-20 text-3xl"
        } mx-auto mb-2 rounded-full border-2 border-[#d4af37] bg-[#1a150e] flex items-center justify-center font-serif font-bold text-[#e5c158]`}
      >
        {brandName.charAt(0).toUpperCase()}
      </div>
    );

  const allCategories = Array.isArray(restaurant.categories) ? restaurant.categories : [];
  const visibleCategories = activeCat === "all" ? allCategories : allCategories.filter((c: any) => c.id === activeCat);

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#f5f0e6] pb-28">
      {/* 1. ÜST VİTRİN */}
      <div className="relative overflow-hidden border-b border-[#d4af37]/25">
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url('${bgImg}')` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0b0a09]/85 to-[#0b0a09]" />

        <div className="relative max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7 text-center space-y-3">
            <LogoBadge />
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-widest uppercase text-[#e5c158]">{brandName}</h1>
            <p className="text-xs tracking-[0.25em] uppercase text-[#d4af37]">{subtitle}</p>
            <h2 className="text-2xl md:text-3xl font-serif text-white pt-2">{slogan}</h2>
            <p className="text-sm text-zinc-300 max-w-md mx-auto">{desc}</p>
          </div>

          <div className="md:col-span-5 flex justify-center">
            <div className="w-64 rounded-[2.2rem] p-3 bg-[#17130d] border-2 border-[#d4af37]/60 shadow-2xl">
              <div className="bg-[#0e0c0a] rounded-[1.8rem] p-4 text-center border border-[#d4af37]/20">
                <div className="w-16 h-3 bg-black rounded-full mx-auto mb-3 border border-zinc-800" />
                <LogoBadge small />
                <div className="text-lg font-serif font-bold tracking-widest uppercase text-[#e5c158]">{brandName}</div>
                <div className="text-[9px] tracking-[0.3em] text-[#d4af37]/80 uppercase mb-3">— RESTORAN —</div>
                <img src={foodImg} alt={brandName} className="w-full h-40 object-cover rounded-xl mb-4 border border-[#d4af37]/30" />
                <a
                  href="#menu-section"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1c1710] border border-[#d4af37]/60 flex items-center justify-between text-xs font-medium text-white hover:bg-[#d4af37] hover:text-black transition"
                >
                  <span>Menyuya baxın</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MƏLUMAT KARTLARI */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#12100e] border border-[#d4af37]/30 rounded-2xl p-5 space-y-3 text-sm">
            <div className="font-bold text-base text-[#e5c158]">📶 Wi-Fi Məlumatı</div>
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">Şəbəkə:</span>
              <button onClick={() => copyText(wifiName, "n")} className="text-white font-semibold">
                {wifiName} {copied === "n" ? "✓" : "📋"}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Şifrə:</span>
              <button onClick={() => copyText(wifiPass, "p")} className="text-white font-semibold">
                {wifiPass} {copied === "p" ? "✓" : "📋"}
              </button>
            </div>
          </div>

          <div className="bg-[#12100e] border border-[#d4af37]/30 rounded-2xl p-5 space-y-2 text-sm">
            <div className="font-bold text-base text-[#e5c158]">📍 Əlaqə və Ünvan</div>
            <div className="flex justify-between border-b border-zinc-800 pb-1.5">
              <span className="text-zinc-400">Telefon:</span>
              <span>{restaurant.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Ünvan:</span>
              <span className="text-right">{address}</span>
            </div>
          </div>

          <div className="bg-[#12100e] border border-[#d4af37]/30 rounded-2xl p-5 flex flex-col justify-between text-sm">
            <div className="font-bold text-base text-[#e5c158]">🕒 İş Saatları</div>
            <div className="text-xl font-bold text-white mt-2">{hours}</div>
            <div className="text-xs text-zinc-400">Hər gün xidmətinizdəyik</div>
          </div>
        </div>
      </div>

      {/* 3. MENYU BÖLMƏSİ */}
      <div id="menu-section" className="max-w-5xl mx-auto px-6 py-4 space-y-6">
        <h2 className="text-center text-2xl font-serif font-bold tracking-widest text-[#e5c158]">— MENYU —</h2>

        {allCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveCat("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
                activeCat === "all" ? "bg-[#d4af37] text-black border-[#d4af37]" : "border-[#d4af37]/40 text-zinc-300"
              }`}
            >
              Hamısı
            </button>
            {allCategories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border shrink-0 ${
                  activeCat === c.id ? "bg-[#d4af37] text-black border-[#d4af37]" : "border-[#d4af37]/40 text-zinc-300"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {visibleCategories.map((cat: any) => (
          <div key={cat.id} className="bg-[#12100e] p-6 rounded-3xl border border-[#d4af37]/30 space-y-4">
            <h3 className="text-xl font-serif font-bold text-[#e5c158] border-b border-[#d4af37]/20 pb-2">{cat.name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cat.menuItems.map((item: any) => (
                <div key={item.id} className="border border-[#d4af37]/20 rounded-2xl p-4 flex justify-between items-center gap-3 bg-[#181512]">
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-[#d4af37]/30 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-white">{item.name}</h4>
                      {item.description && <p className="text-xs text-zinc-400 mt-0.5">{item.description}</p>}
                      <p className="text-[#e5c158] font-bold mt-1">{Number(item.price).toFixed(2)} ₼</p>
                    </div>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-9 h-9 rounded-full bg-[#d4af37] text-black font-bold text-lg flex items-center justify-center shrink-0"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 4. SƏBƏT */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#12100e] border-t border-[#d4af37]/50 p-4 z-50">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {cart.map((c) => (
                <div key={c.item.id} className="flex items-center gap-1.5 bg-[#1c1814] border border-[#d4af37]/30 px-3 py-1 rounded-xl text-xs shrink-0">
                  <span className="font-bold text-[#e5c158]">{c.quantity}x</span>
                  <span>{c.item.name}</span>
                  <button onClick={() => removeFromCart(c.item.id)} className="text-red-400 font-bold ml-1">✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
              <span className="text-lg font-bold text-[#e5c158]">{totalAmount.toFixed(2)} ₼</span>
              <button onClick={sendWhatsAppOrder} className="bg-[#d4af37] text-black px-5 py-2.5 rounded-xl font-bold text-sm">
                WhatsApp ilə Sifariş Ver →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
