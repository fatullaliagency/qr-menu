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
  categories: Category[];
}

export default function ClientRestaurantMenu({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);

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

  return (
    <div className="min-h-screen bg-gray-50 pb-28 text-zinc-900">
      {/* Üst Başlıq */}
      <div className="bg-zinc-900 text-white py-10 px-6 text-center rounded-b-3xl shadow-md">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {restaurant.name}
        </h1>
        <p className="text-zinc-400 text-sm">Rəqəmsal QR Menyumuza Xoş Gəldiniz</p>
      </div>

      {/* Kateqoriyalar və Məhsullar */}
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {restaurant.categories.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-gray-500 shadow-sm">
            Bu restoranda hələ menyu əlavə edilməyib.
          </div>
        ) : (
          restaurant.categories.map((category) => (
            <div
              key={category.id}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
            >
              <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200">
                {category.name}
              </h2>

              {category.menuItems.length === 0 ? (
                <p className="text-gray-400 text-sm italic">
                  Bu kateqoriyada məhsul yoxdur.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-100 rounded-2xl p-4 flex justify-between items-center gap-4 hover:shadow-md transition bg-white"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Məhsul Şəkli Varsa Göstəririk */}
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-20 h-20 rounded-xl object-cover shrink-0 border border-gray-200"
                          />
                        )}
                        <div>
                          <h3 className="font-bold text-zinc-900">
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <p className="text-emerald-600 font-bold mt-2">
                            {item.price.toFixed(2)} ₼
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        className="w-10 h-10 rounded-full bg-zinc-900 text-white font-bold text-xl flex items-center justify-center shrink-0 hover:bg-emerald-600 transition shadow-sm"
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

      {/* Alt Səbət və WhatsApp Sifariş Paneli */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-x-auto w-full sm:w-auto py-1">
              {cart.map((c) => (
                <div
                  key={c.item.id}
                  className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl text-xs shrink-0"
                >
                  <span className="font-bold">{c.quantity}x</span>
                  <span>{c.item.name}</span>
                  <button
                    onClick={() => removeFromCart(c.item.id)}
                    className="text-red-500 font-bold ml-1 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0">
              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-500 block">Cəmi Məbləğ</span>
                <span className="text-lg font-bold text-zinc-900">
                  {totalAmount.toFixed(2)} ₼
                </span>
              </div>

              <button
                onClick={sendWhatsAppOrder}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-md"
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