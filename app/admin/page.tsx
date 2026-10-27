import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";
import ImagePickerInput from "./ImagePickerInput";

export const instant = false;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const params = await searchParams;
  const activeSlug = params.slug || "fatullali";

  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
    include: { categories: { include: { menuItems: true } } },
  });

  if (!restaurant) {
    return (
      <div className="p-10 text-center space-y-4">
        <div className="text-red-600 font-bold text-xl">Restoran tapılmadı!</div>
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
        subtitle: formData.get("subtitle") as string,
        slogan: formData.get("slogan") as string,
        description: formData.get("description") as string,
        logoUrl: formData.get("logoUrl") as string,
        bgImageUrl: formData.get("bgImageUrl") as string,
        heroFoodUrl: formData.get("heroFoodUrl") as string,
        wifiName: formData.get("wifiName") as string,
        wifiPassword: formData.get("wifiPassword") as string,
        address: formData.get("address") as string,
        workingHours: formData.get("workingHours") as string,
        instagramUrl: formData.get("instagramUrl") as string,
        facebookUrl: formData.get("facebookUrl") as string,
        mapUrl: formData.get("mapUrl") as string,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addCategory(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name || !restaurant) return;
    await db.category.create({ data: { name, restaurantId: restaurant.id } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function updateCategory(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    if (!id || !name || !restaurant) return;
    await db.category.update({ where: { id }, data: { name } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function deleteCategory(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id || !restaurant) return;
    await db.category.delete({ where: { id } });
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

  async function updateMenuItem(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const price = parseFloat(formData.get("price") as string);
    const description = formData.get("description") as string;
    const imageUrl = formData.get("imageUrl") as string;
    if (!id || !name || isNaN(price) || !restaurant) return;

    await db.menuItem.update({
      where: { id },
      data: {
        name,
        price,
        description: description || null,
        imageUrl: imageUrl || null,
      },
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
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Başlıq */}
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{restaurant.name} — Admin Panel</h1>
              <p className="text-xs text-gray-500">Bütün məlumatları və şəkilləri buradan düzənləyin</p>
            </div>
            <Link href={`/${restaurant.slug}`} target="_blank" className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-medium">
              Menyuya Bax ↗
            </Link>
          </div>

          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          {/* 1. Restoran Dizayn, Loqo, Arxa Plan və Məlumat Ayarları */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200">
            <h2 className="text-lg font-bold mb-4">👑 Restoran Dizaynı, Loqo, Arxa Plan və Əlaqə</h2>
            <form action={updateRestaurantSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <ImagePickerInput name="logoUrl" label="Restoran Loqosu" defaultValue={restaurant.logoUrl || ""} />
                <ImagePickerInput name="bgImageUrl" label="Arxa Plan Şəkli" defaultValue={restaurant.bgImageUrl || ""} />
                <ImagePickerInput name="heroFoodUrl" label="Telefon İçi Yemək Şəkli" defaultValue={restaurant.heroFoodUrl || ""} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <input type="text" name="name" defaultValue={restaurant.name} placeholder="Restoran Adı" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="subtitle" defaultValue={restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} placeholder="Alt Başlıq" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="slogan" defaultValue={restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} placeholder="Əsas Şüar" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="description" defaultValue={restaurant.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} placeholder="Alt Açıqlama" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="wifiName" defaultValue={restaurant.wifiName || "Fatullali 1"} placeholder="Wi-Fi Adı" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="wifiPassword" defaultValue={restaurant.wifiPassword || "Fatullali12345"} placeholder="Wi-Fi Şifrəsi" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="phone" defaultValue={restaurant.phone} placeholder="Telefon / WhatsApp" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="address" defaultValue={restaurant.address || "Fətəli Xan Xoyski 98"} placeholder="Ünvan" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="workingHours" defaultValue={restaurant.workingHours || "8:00 / 23:30"} placeholder="İş Saatları" className="border rounded-xl px-3.5 py-2.5" />
                <input type="text" name="instagramUrl" defaultValue={restaurant.instagramUrl || ""} placeholder="Instagram Linki" className="border rounded-xl px-3.5 py-2.5" />
              </div>

              <button type="submit" className="w-full bg-amber-600 text-white font-semibold py-3 rounded-xl hover:bg-amber-700">
                💾 Restoran Məlumatlarını Yadda Saxla
              </button>
            </form>
          </div>

          {/* 2. Yeni Kateqoriya və Yeni Məhsul Əlavə Et */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4">➕ Yeni Kateqoriya</h2>
              <form action={addCategory} className="space-y-3">
                <input type="text" name="name" placeholder="Məs: Çay, Kabablar..." required className="w-full border rounded-xl px-4 py-2.5 text-sm" />
                <button type="submit" className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl">Kateqoriya Yarat</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <h2 className="text-lg font-bold mb-4">🍔 Yeni Məhsul Əlavə Et</h2>
              <form action={addMenuItem} className="space-y-3 text-sm">
                <select name="categoryId" required className="w-full border rounded-xl px-4 py-2.5 bg-white">
                  <option value="">-- Kateqoriya Seçin --</option>
                  {restaurant.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input type="text" name="name" placeholder="Məhsulun Adı" required className="w-full border rounded-xl px-4 py-2.5" />
                <input type="number" step="0.01" name="price" placeholder="Qiymət (₼)" required className="w-full border rounded-xl px-4 py-2.5" />
                <input type="text" name="description" placeholder="Tərkibi / Açıqlama" className="w-full border rounded-xl px-4 py-2.5" />
                <ImagePickerInput name="imageUrl" label="Məhsul Şəkli Yüklə" />
                <button type="submit" className="w-full bg-zinc-900 text-white font-semibold py-2.5 rounded-xl">Məhsulu Əlavə Et</button>
              </form>
            </div>
          </div>

          {/* 3. Mövcud Menyunu Düzənlə (Ad, Qiymət, Tərkib, Şəkil Dəyişmə) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
            <h2 className="text-xl font-bold">📋 Mövcud Menyunu Düzənlə</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="border border-gray-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b pb-3">
                  <form action={updateCategory} className="flex items-center gap-2 flex-1">
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="text" name="name" defaultValue={cat.name} className="font-bold text-lg border rounded-lg px-3 py-1 w-full max-w-xs" />
                    <button type="submit" className="bg-amber-500 text-white text-xs font-semibold px-3 py-2 rounded-lg">Adı Dəyiş</button>
                  </form>
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={cat.id} />
                    <button type="submit" className="text-red-500 text-xs font-semibold px-2 py-1">Kateqoriyanı Sil</button>
                  </form>
                </div>

                <div className="space-y-3">
                  {cat.menuItems.map((item) => (
                    <details key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <summary className="flex justify-between items-center cursor-pointer font-medium">
                        <div className="flex items-center gap-3">
                          {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover border" />}
                          <div>
                            <div className="font-bold text-zinc-900">{item.name} — <span className="text-emerald-600">{item.price.toFixed(2)} ₼</span></div>
                            {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                          </div>
                        </div>
                        <span className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg">✏️ Düzənlə / Şəkil Yüklə</span>
                      </summary>

                      <div className="mt-4 pt-3 border-t space-y-3">
                        <form action={updateMenuItem} className="space-y-3 text-sm">
                          <input type="hidden" name="id" value={item.id} />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input type="text" name="name" defaultValue={item.name} placeholder="Məhsul adı" className="border rounded-lg px-3 py-2 bg-white" />
                            <input type="number" step="0.01" name="price" defaultValue={item.price} placeholder="Qiymət" className="border rounded-lg px-3 py-2 bg-white" />
                            <input type="text" name="description" defaultValue={item.description || ""} placeholder="Tərkibi" className="border rounded-lg px-3 py-2 bg-white" />
                          </div>
                          <ImagePickerInput name="imageUrl" label="Məhsulun Şəkli" defaultValue={item.imageUrl || ""} />
                          <button type="submit" className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">
                            💾 Dəyişiklikləri Yadda Saxla
                          </button>
                        </form>

                        <form action={deleteMenuItem} className="text-right">
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="text-red-600 text-xs font-semibold hover:underline">🗑️ Bu Məhsulu Sil</button>
                        </form>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPinGuard>
  );
}
