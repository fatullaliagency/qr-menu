import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";

export const instant = false;

interface AdminProps {
  searchParams: Promise<{ slug?: string }>;
}

export default async function AdminPage({ searchParams }: AdminProps) {
  const params = await searchParams;
  const activeSlug = params.slug || "ornek-restoran";

  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
    include: {
      categories: {
        include: {
          menuItems: true,
        },
      },
    },
  });

  if (!restaurant) {
    return (
      <div className="p-10 text-center space-y-4">
        <div className="text-red-600 font-bold text-xl">
          "{activeSlug}" adlı restoran tapılmadı!
        </div>
        <Link
          href="/"
          className="inline-block bg-zinc-900 text-white px-5 py-2.5 rounded-xl"
        >
          ← Ana Səhifəyə Qayıt
        </Link>
      </div>
    );
  }

  const restData = restaurant as any;

  // Sunucu Eylemi 0: Restoran Vitrin & Məlumatlarını Yeniləmə
  async function updateRestaurantInfo(formData: FormData) {
    "use server";
    if (!restaurant) return;

    const name = (formData.get("name") as string) || restaurant.name;
    const phone = (formData.get("phone") as string) || restaurant.phone;
    const subtitle = (formData.get("subtitle") as string) || "";
    const slogan = (formData.get("slogan") as string) || "";
    const description = (formData.get("description") as string) || "";
    const logoUrl = (formData.get("logoUrl") as string) || "";
    const bgImageUrl = (formData.get("bgImageUrl") as string) || "";
    const heroFoodUrl = (formData.get("heroFoodUrl") as string) || "";
    const wifiName = (formData.get("wifiName") as string) || "";
    const wifiPassword = (formData.get("wifiPassword") as string) || "";
    const address = (formData.get("address") as string) || "";
    const workingHours = (formData.get("workingHours") as string) || "";
    const instagramUrl = (formData.get("instagramUrl") as string) || "";
    const facebookUrl = (formData.get("facebookUrl") as string) || "";
    const mapUrl = (formData.get("mapUrl") as string) || "";

    await (db.restaurant as any).update({
      where: { id: restaurant.id },
      data: {
        name,
        phone,
        subtitle,
        slogan,
        description,
        logoUrl,
        bgImageUrl,
        heroFoodUrl,
        wifiName,
        wifiPassword,
        address,
        workingHours,
        instagramUrl,
        facebookUrl,
        mapUrl,
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  // Sunucu Eylemi 1: Yeni Kategori Ekleme
  async function addCategory(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name || !restaurant) return;

    await db.category.create({
      data: {
        name,
        restaurantId: restaurant.id,
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  // Sunucu Eylemi 2: Yeni Ürün Ekleme
  async function addMenuItem(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const price = parseFloat(formData.get("price") as string);
    const description = formData.get("description") as string;
    const imageUrl = formData.get("imageUrl") as string;
    const categoryId = formData.get("categoryId") as string;

    if (!name || isNaN(price) || !categoryId || !restaurant) return;

    await db.menuItem.create({
      data: {
        name,
        price,
        description: description || null,
        imageUrl: imageUrl || null,
        categoryId,
        restaurantId: restaurant.id,
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  // Sunucu Eylemi 3: Ürün Silme
  async function deleteMenuItem(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id || !restaurant) return;

    await db.menuItem.delete({
      where: { id },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  return (
    <AdminPinGuard>
      <div className="min-h-screen bg-gray-100 p-6 md:p-10 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Üst Başlık */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm gap-4">
            <div>
              <Link
                href="/"
                className="text-xs font-semibold text-emerald-600 hover:underline mb-1 inline-block"
              >
                ← Bütün Restoranlar (Ana Səhifə)
              </Link>
              <h1 className="text-2xl font-bold text-zinc-900">
                {restaurant.name} — İdarəetmə Paneli
              </h1>
              <p className="text-gray-500 text-sm">
                Menyu kateqoriyalarını, məhsulları və QR kodunuzu buradan idarə edin
              </p>
            </div>
            <Link
              href={`/${restaurant.slug}`}
              target="_blank"
              className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-zinc-800 transition"
            >
              Menyuya Bax ↗
            </Link>
          </div>

          {/* QR Kod Kutusu */}
          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          {/* YENİ: Restoran Vitrin, Logo, Arxa Plan, Wi-Fi və Əlaqə Ayarları */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200">
            <h2 className="text-lg font-bold mb-1 text-zinc-900">
              ✨ Restoran Vitrin və Məlumat Ayarları (Ana Səhifə Dizaynı)
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Loqo, arxa plan şəkli, sloqanlar, Wi-Fi şifrəsi, ünvan və iş saatlarını buradan yeniləyə bilərsiniz.
            </p>
            <form action={updateRestaurantInfo} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Restoranın Adı
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={restaurant.name}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mətbəx / Alt Başlıq
                  </label>
                  <input
                    type="text"
                    name="subtitle"
                    defaultValue={restData.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Əsas Sloqan
                  </label>
                  <input
                    type="text"
                    name="slogan"
                    defaultValue={restData.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alt Açıqlama Mətni
                  </label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={restData.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loqo Şəkil Linki (URL - İstəyə bağlı)
                  </label>
                  <input
                    type="url"
                    name="logoUrl"
                    defaultValue={restData.logoUrl || ""}
                    placeholder="https://... (Boş qalsa qızılı Fatullali loqosu görünür)"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arxa Plan (Fon) Şəkil Linki (URL)
                  </label>
                  <input
                    type="url"
                    name="bgImageUrl"
                    defaultValue={restData.bgImageUrl || ""}
                    placeholder="https://... (Üst hissənin arxa plan şəkli)"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon Ekranındakı Yemək Şəkli Linki (URL)
                  </label>
                  <input
                    type="url"
                    name="heroFoodUrl"
                    defaultValue={restData.heroFoodUrl || ""}
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon / WhatsApp Nömrəsi
                  </label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={restaurant.phone}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wi-Fi Şəbəkə Adı
                  </label>
                  <input
                    type="text"
                    name="wifiName"
                    defaultValue={restData.wifiName || "Fatullali 1"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wi-Fi Şifrəsi
                  </label>
                  <input
                    type="text"
                    name="wifiPassword"
                    defaultValue={restData.wifiPassword || "Fatullali12345"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ünvan
                  </label>
                  <input
                    type="text"
                    name="address"
                    defaultValue={restData.address || "Fətəli Xan Xoyski 98"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    İş Saatları (Açıq saatlar)
                  </label>
                  <input
                    type="text"
                    name="workingHours"
                    defaultValue={restData.workingHours || "8:00 / 23:30"}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram Linki (İstəyə bağlı)
                  </label>
                  <input
                    type="url"
                    name="instagramUrl"
                    defaultValue={restData.instagramUrl || ""}
                    placeholder="https://instagram.com/..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Xəritə / Konum Linki (İstəyə bağlı)
                  </label>
                  <input
                    type="url"
                    name="mapUrl"
                    defaultValue={restData.mapUrl || ""}
                    placeholder="https://maps.google.com/..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 text-white font-semibold py-2.5 rounded-xl hover:bg-amber-700 transition"
              >
                💾 Vitrin və Restoran Məlumatlarını Yadda Saxla
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Kutu: Kategori Ekleme Formu */}
            <div className="bg-white p-6 rounded-2xl shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4">➕ Yeni Kateqoriya Əlavə Et</h2>
              <form action={addCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kateqoriya Adı
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Məs: İsti İçkilər, Kabablar..."
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 transition"
                >
                  Kateqoriya Yarat
                </button>
              </form>
            </div>

            {/* 2. Kutu: Ürün Ekleme Formu */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h2 className="text-lg font-bold mb-4">🍔 Yeni Məhsul Əlavə Et</h2>
              <form action={addMenuItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kateqoriya Seçin
                  </label>
                  <select
                    name="categoryId"
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">-- Seçin --</option>
                    {restaurant.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Məhsulun Adı
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Məs: Çay dəstgahı, Adana Kabab..."
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qiymət (₼)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    placeholder="Məs: 8.50"
                    required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Şəkil Linki / URL (İstəyə bağlı)
                  </label>
                  <input
                    type="url"
                    name="imageUrl"
                    placeholder="https://..."
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tərkibi / Açıqlama (İstəyə bağlı)
                  </label>
                  <input
                    type="text"
                    name="description"
                    placeholder="Məs: Quzu əti, pomidor, acı bibər"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-zinc-900 text-white font-semibold py-2.5 rounded-xl hover:bg-zinc-800 transition"
                >
                  Məhsulu Menyuya Əlavə Et
                </button>
              </form>
            </div>
          </div>

          {/* 3. Kutu: Mevcut Menü Listesi */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-6">📋 Mövcud Menyu Siyahısı</h2>
            <div className="space-y-6">
              {restaurant.categories.map((category) => (
                <div
                  key={category.id}
                  className="border border-gray-200 rounded-xl p-4"
                >
                  <h3 className="font-bold text-lg text-zinc-900 border-b pb-2 mb-3">
                    {category.name}
                  </h3>
                  {category.menuItems.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">
                      Bu kateqoriyada hələ məhsul yoxdur.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {category.menuItems.map((item) => (
                        <li
                          key={item.id}
                          className="py-2.5 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-12 h-12 rounded-lg object-cover border"
                              />
                            )}
                            <div>
                              <span className="font-medium">{item.name}</span>
                              {item.description && (
                                <p className="text-xs text-gray-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-emerald-600">
                              {item.price.toFixed(2)} ₼
                            </span>
                            <form action={deleteMenuItem}>
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                              >
                                Sil
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminPinGuard>
  );
}
