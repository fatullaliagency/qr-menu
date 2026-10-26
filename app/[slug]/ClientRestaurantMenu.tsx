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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

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

  const cleanPhone = restaurant.phone.replace(/[^0-9]/g, "");
  const mapLink =
    restaurant.mapUrl && restaurant.mapUrl.trim() !== ""
      ? restaurant.mapUrl
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address
        )}`;
  const instagramLink =
    restaurant.instagramUrl && restaurant.instagramUrl.trim() !== ""
      ? restaurant.instagramUrl
      : "https://instagram.com";
  const facebookLink =
    restaurant.facebookUrl && restaurant.facebookUrl.trim() !== ""
      ? restaurant.facebookUrl
      : "https://facebook.com";

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

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  // Axtarış və kateqoriyaya görə menyunu süzürük
  const filteredCategories = restaurant.categories
    .filter((cat) => selectedCategory === "ALL" || cat.id === selectedCategory)
    .map((cat) => ({
      ...cat,
      menuItems: cat.menuItems.filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }),
    }))
    .filter((cat) =>
      searchQuery.trim() ? cat.menuItems.length > 0 : true
    );

  return (
    <div className="min-h-screen bg-[#0b0a09] text-[#f5efe6] pb-32 font-sans selection:bg-amber-500 selection:text-black">
      {/* 1. ÜST VİTRİN (HERO) ALANI */}
      <section className="relative overflow-hidden border-b border-amber-500/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 scale-105"
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0b0a09]/85 to-[#0b0a09]" />

        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          {/* Sol Tərəf: Loqo, Ad və Şüarlar */}
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

            <div className="flex items-center gap-3 my-5 w-48 justify-center">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/70" />
              <span className="text-[#d4af37] text-sm">◇</span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/70" />
            </div>

            <p className="text-sm md:text-base text-zinc-300 max-w-md">
              {subDescription}
            </p>
          </div>

          {/* Sağ Tərəf: Telefon Maketi və "Menyuya baxın" Düyməsi */}
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
