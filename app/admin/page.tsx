import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";

export const instant = false;

async function fileToUrl(entry: FormDataEntryValue | null, current: string | null) {
  if (!entry || typeof entry === "string") return current;
  const file = entry as File;
  if (!file.size) return current;
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
}

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
    return <div className="p-10 text-center text-red-600 font-bold">Restoran tapılmadı!</div>;
  }

  async function updateRestaurant(formData: FormData) {
    "use server";
    if (!restaurant) return;
    const logoUrl = await fileToUrl(formData.get("logoFile"), restaurant.logoUrl);
    const bgImageUrl = await fileToUrl(formData.get("bgFile"), restaurant.bgImageUrl);
    const heroFoodUrl = await fileToUrl(formData.get("heroFile"), restaurant.heroFoodUrl);

    await db.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: (formData.get("name") as string) || restaurant.name,
        phone: (formData.get("phone") as string) || restaurant.phone,
        subtitle: formData.get("subtitle") as string,
        slogan: formData.get("slogan") as string,
        description: formData.get("description") as string,
        logoUrl,
        bgImageUrl,
        heroFoodUrl,
        wifiName: formData.get("wifiName") as string,
        wifiPassword: formData.get("wifiPassword") as string,
        address: formData.get("address") as string,
        workingHours: formData.get("workingHours") as string,
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

  async function addMenuItem(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const price = parseFloat(formData.get("price") as string);
    const description = formData.get("description") as string;
    const categoryId = formData.get("categoryId") as string;
    if (!name || isNaN(price) || !categoryId || !restaurant) return;
    const imageUrl = await fileToUrl(formData.get("imageFile"), null);

    await db.menuItem.create({
      data: { name, price, description: description || null, imageUrl, categoryId, restaurantId: restaurant.id },
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
    const oldImg = formData.get("oldImg") as string;
    if (!id || !name || isNaN(price) || !restaurant) return;
    const imageUrl = await fileToUrl(formData.get("imageFile"), oldImg || null);

    await db.menuItem.update({
      where: { id },
      data: { name, price, description: description || null, imageUrl },
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

  const inp = "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm";
  const fileInp = "w-full text-xs border border-amber-300 bg-amber-50 rounded-xl p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:text-white file:font-semibold";

  return (
    <AdminPinGuard>
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
            <h1 className="text-xl font-bold">{restaurant.name} — Admin Panel</h1>
            <Link href={`/${restaurant.slug}`} target="_blank" className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm">
              Menyuya Bax ↗
            </Link>
          </div>

          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          {/* 1. Vitrin, Loqo və Arxa Plan (Birbaşa Qalereyadan Yükləmə) */}
          <form action={updateRestaurant} className="bg-white p-6 rounded-2xl shadow-sm space-y-4 border border-amber-200">
            <h2 className="text-lg font-bold">👑 Loqo, Arxa Plan və Restoran Məlumatları</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1">📷 Restoran Loqosu Seç</label>
                <input type="file" name="logoFile" accept="image/*" className={fileInp} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">📷 Arxa Plan Şəkli Seç</label>
                <input type="file" name="bgFile" accept="image/*" className={fileInp} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">📷 Telefon İçi Yemək Şəkli Seç</label>
                <input type="file" name="heroFile" accept="image/*" className={fileInp} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" name="name" defaultValue={restaurant.name} placeholder="Restoran Adı" className={inp} />
              <input type="text" name="subtitle" defaultValue={restaurant.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} className={inp} />
              <input type="text" name="slogan" defaultValue={restaurant.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} className={inp} />
              <input type="text" name="description" defaultValue={restaurant.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} className={inp} />
              <input type="text" name="wifiName" defaultValue={restaurant.wifiName || "Fatullali 1"} className={inp} />
              <input type="text" name="wifiPassword" defaultValue={restaurant.wifiPassword || "Fatullali12345"} className={inp} />
              <input type="text" name="phone" defaultValue={restaurant.phone} className={inp} />
              <input type="text" name="address" defaultValue={restaurant.address || "Fətəli Xan Xoyski 98"} className={inp} />
              <input type="text" name="workingHours" defaultValue={restaurant.workingHours || "8:00 / 23:30"} className={inp} />
            </div>
            <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2.5 rounded-xl">💾 Məlumatları və Şəkilləri Yadda Saxla</button>
          </form>

          {/* 2. Yeni Kateqoriya və Yeni Məhsul */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form action={addCategory} className="bg-white p-6 rounded-2xl shadow-sm space-y-3 h-fit">
              <h2 className="font-bold">➕ Yeni Kateqoriya</h2>
              <input type="text" name="name" placeholder="Kateqoriya Adı" required className={inp} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl">Yarat</button>
            </form>

            <form action={addMenuItem} className="bg-white p-6 rounded-2xl shadow-sm space-y-3">
              <h2 className="font-bold">🍔 Yeni Məhsul Əlavə Et</h2>
              <select name="categoryId" required className={inp}>
                <option value="">-- Kateqoriya Seçin --</option>
                {restaurant.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="text" name="name" placeholder="Məhsulun Adı" required className={inp} />
              <input type="number" step="0.01" name="price" placeholder="Qiymət (₼)" required className={inp} />
              <input type="text" name="description" placeholder="Tərkibi" className={inp} />
              <label className="text-xs font-bold block">📷 Qalereyadan Məhsul Şəkli Seç:</label>
              <input type="file" name="imageFile" accept="image/*" className={fileInp} />
              <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl">Əlavə Et</button>
            </form>
          </div>

          {/* 3. Mövcud Məhsullara Düzəliş Et */}
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-lg font-bold">📋 Mövcud Menyuya Düzəliş Et</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="border rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-base border-b pb-2">{cat.name}</h3>
                {cat.menuItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-3 rounded-xl border space-y-2">
                    <form action={updateMenuItem} className="space-y-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="oldImg" value={item.imageUrl || ""} />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="text" name="name" defaultValue={item.name} className={inp} />
                        <input type="number" step="0.01" name="price" defaultValue={item.price} className={inp} />
                        <input type="text" name="description" defaultValue={item.description || ""} placeholder="Tərkibi" className={inp} />
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-12
