import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";
import ImagePickerInput from "./ImagePickerInput";

export const instant = false;

interface AdminProps {
  searchParams: Promise<{ slug?: string }>;
}

export default async function AdminPage({ searchParams }: AdminProps) {
  const params = await searchParams;
  const activeSlug = params.slug || "fatullali";

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
        <Link href="/" className="inline-block bg-zinc-900 text-white px-5 py-2.5 rounded-xl">
          ← Ana Səhifəyə Qayıt
        </Link>
      </div>
    );
  }

  async function updateRestaurantSettings(formData: FormData) {
    "use server";
    if (!restaurant) return;

    await db.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: (formData.get("name") as string) || restaurant.name,
        phone: (formData.get("phone") as string) || restaurant.phone,
        subtitle: (formData.get("subtitle") as string) || "",
        slogan: (formData.get("slogan") as string) || "",
        description: (formData.get("description") as string) || "",
        logoUrl: (formData.get("logoUrl") as string) || "",
        bgImageUrl: (formData.get("bgImageUrl") as string) || "",
        heroFoodUrl: (formData.get("heroFoodUrl") as string) || "",
        wifiName: (formData.get("wifiName") as string) || "",
        wifiPassword: (formData.get("wifiPassword") as string) || "",
        address: (formData.get("address") as string) || "",
        workingHours: (formData.get("workingHours") as string) || "",
        instagramUrl: (formData.get("instagramUrl") as string) || "",
        facebookUrl: (formData.get("facebookUrl") as string) || "",
        mapUrl: (formData.get("mapUrl") as string) || "",
      },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addCategory(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name || !restaurant) return;

    await db.category.create({
      data: { name, restaurantId: restaurant.id },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

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

  async function updateMenuItemImage(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const imageUrl = formData.get("imageUrl") as string;
    if (!id || !restaurant) return;

    await db.menuItem.update({
      where: { id },
      data: { imageUrl: imageUrl || null },
    });

    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function deleteMenuItem(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id || !restaurant) return;

    await db.menuItem.delete({ where: { id } });

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
              <Link href="/" className="text-xs font-semibold text-emerald-600 hover:underline mb-1 inline-block">
                ← Bütün Restoranlar (Ana Səhifə)
              </Link>
              <h1 className="text-2xl font-bold text-zinc-900">
                {restaurant.name} — İdarəetmə Paneli
              </h1>
              <p className="text-gray-500 text-sm">
                Menyu kateqoriyalarını, məhsulları, şəkilləri və QR kodunuzu buradan idarə edin
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

          {/* Restoran Vitrin, Logo, Arxa Plan, Wi-Fi və Əlaqə Ayarları */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200">
            <h2 className="text-xl font-bold mb-1 text-zinc-900">
              👑 Ana Səhifə Vitrin və Restoran Məlumatları
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Loqo, arxa plan şəkli, şüarlar, Wi-Fi şifrəsi, ünvan və iş saatlarını buradan yeniləyə bilərsiniz.
            </p>

            <form action={updateRestaurantSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Restoranın Adı</label>
                  <input type="text" name="name" defaultValue={restaurant.name} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mətbəx / Alt Başlıq</label>
                  <input type="text" name="subtitle" defaultValue={restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div className="md:col-span-2">
                  <ImagePickerInput name="logoUrl" label="Restoran Loqosu (Qalereyadan seçin və ya link yazın)" defaultValue={restaurant.logoUrl || ""} />
                </div>

                <div className="md:col-span-2">
                  <ImagePickerInput name="bgImageUrl" label="Arxa Plan / Fon Şəkli (Qalereyadan seçin və ya link yazın)" defaultValue={restaurant.bgImageUrl || ""} />
                </div>

                <div className="md:col-span-2">
                  <ImagePickerInput name="heroFoodUrl" label="Telefon Ekranı İçindəki Yemək Şəkli (Qalereyadan seçin və ya link yazın)" defaultValue={restaurant.heroFoodUrl || ""} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Əsas Şüar (Slogan)</label>
                  <input type="text" name="slogan" defaultValue={restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alt Açıqlama Mətni</label>
                  <input type="text" name="description" defaultValue={restaurant.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wi-Fi Şəbəkə Adı</label>
                  <input type="text" name="wifiName" defaultValue={restaurant.wifiName || "Fatullali 1"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wi-Fi Şifrəsi</label>
                  <input type="text" name="wifiPassword" defaultValue={restaurant.wifiPassword || "Fatullali12345"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon və WhatsApp Nömrəsi</label>
                  <input type="text" name="phone" defaultValue={restaurant.phone} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ünvan</label>
                  <input type="text" name="address" defaultValue={restaurant.address || "Fətəli Xan Xoyski 98"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İş Saatları (Açıq saatlar)</label>
                  <input type="text" name="workingHours" defaultValue={restaurant.workingHours || "8:00 / 23:30"} className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Linki (İstəyə bağlı)</label>
                  <input type="url" name="instagramUrl" defaultValue={restaurant.instagramUrl || ""} placeholder="https://instagram.com/..." className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Linki (İstəyə bağlı)</label>
                  <input type="url" name="facebookUrl" defaultValue={restaurant.facebookUrl || ""} placeholder="https://facebook.com/..." className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Xəritə Linki (İstəyə bağlı)</label>
                  <input type="url" name="mapUrl" defaultValue={restaurant.mapUrl || ""} placeholder="https://maps.google.com/..." className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>
              </div>

              <button type="submit" className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl hover:bg-amber-700 transition">
                💾 Vitrin və Restoran Məlumatlarını Yadda Saxla
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Kutu: Kategori Ekleme */}
            <div className="bg-white p-6 rounded-2xl shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4">➕ Yeni Kateqoriya Əlavə Et</h2>
              <form action={addCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kateqoriya Adı</label>
                  <input type="text" name="name" placeholder="Məs: İsti İçkilər, Kabablar..." required className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl hover:bg-emerald-700 transition">
                  Kateqoriya Yarat
                </button>
              </form>
            </div>

            {/* 2. Kutu: Ürün Ekleme */}
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h2 className="text-lg font-bold mb-4">🍔 Yeni Məhsul Əlavə Et</h2>
              <form action={addMenuItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kateqoriya Seçin</label>
                  <select name="categoryId" required className="w-full border border-gray-300 rounded-xl px-4 py-2.5 bg-white">
                    <option value="">-- Seçin --</option>
                    {restaurant.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Məhsulun Adı</label>
                  <input type="text" name="name" placeholder="Məs: Çay dəstgahı, Adana Kabab..." required className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qiymət (₼)</label>
                  <input type="number" step="0.01" name="price" placeholder="Məs: 8.50" required className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <ImagePickerInput name="imageUrl" label="Məhsul Şəkli (Qalereyadan seçin və ya link yazın)" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tərkibi / Açıqlama (İstəyə bağlı)</label>
                  <input type="text" name="description" placeholder="Məs: Quzu əti, pomidor, acı bibər" className="w-full border border-gray-300 rounded-xl px-4 py-2.5" />
                </div>

                <button type="submit" className="w-full bg-zinc-900 text-white font-semibold py-2.5 rounded-xl hover:bg-zinc-800 transition">
                  Məhsulu Menyuya Əlavə Et
                </button>
              </form>
            </div>
          </div>

          {/* 3. Kutu: Mevcut Menü Listesi (Məhsullara Sonradan Şəkil Əlavə Etmə İmkanı ilə) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-6">📋 Mövcud Menyu Siyahısı</h2>
            <div className="space-y-6">
              {restaurant.categories.map((category) => (
                <div key={category.id} className="border border-gray-200 rounded-xl p-4">
                  <h3 className="font-bold text-lg text-zinc-900 border-b pb-2 mb-3">{category.name}</h3>
                  {category.menuItems.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">Bu kateqoriyada hələ məhsul yoxdur.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {category.menuItems.map((item) => (
                        <li key={item.id} className="py-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover border" />
                              )}
                              <div>
                                <span className="font-semibold text-zinc-900">{item.name}</span>
                                {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-emerald-600">{item.price.toFixed(2)} ₼</span>
                              <form action={deleteMenuItem}>
                                <input type="hidden" name="id" value={item.id} />
                                <button type="submit" className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50">
                                  Sil
                                </button>
                              </form>
                            </div>
                          </div>

                          {/* Mövcud məhsulun şəklini qalereyadan seçib yeniləmə */}
                          <form action={updateMenuItemImage} className="bg-gray-50 p-3 rounded-xl flex flex-col sm:flex-row sm:items-end justify-between gap-3 border border-gray-200">
                            <input type="hidden" name="id" value={item.id} />
                            <div className="flex-1">
                              <ImagePickerInput
                                name="imageUrl"
                                label={`${item.name} — Şəkil Əlavə Et / Dəyiş`}
                                defaultValue={item.imageUrl || ""}
                              />
                            </div>
                            <button type="submit" className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-zinc-800 shrink-0">
                              💾 Şəkli Yadda Saxla
                            </button>
                          </form>
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
