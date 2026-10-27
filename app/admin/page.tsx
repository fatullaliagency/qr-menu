import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";

export const instant = false;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const params = await searchParams;
  const activeSlug = params.slug || "fatullali";
  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
    include: { categories: { include: { menuItems: true } } },
  });

  if (!restaurant) return <div className="p-10 text-center text-red-600 font-bold">Tapılmadı!</div>;
  const r = restaurant as any;

  async function updateRestaurantSettings(fd: FormData) {
    "use server";
    if (!restaurant) return;
    await (db.restaurant as any).update({
      where: { id: restaurant.id },
      data: {
        name: (fd.get("name") as string) || restaurant.name,
        phone: (fd.get("phone") as string) || restaurant.phone,
        subtitle: (fd.get("subtitle") as string) || "",
        slogan: (fd.get("slogan") as string) || "",
        description: (fd.get("description") as string) || "",
        logoUrl: (fd.get("logoUrl") as string) || "",
        bgImageUrl: (fd.get("bgImageUrl") as string) || "",
        heroFoodUrl: (fd.get("heroFoodUrl") as string) || "",
        wifiName: (fd.get("wifiName") as string) || "",
        wifiPassword: (fd.get("wifiPassword") as string) || "",
        address: (fd.get("address") as string) || "",
        workingHours: (fd.get("workingHours") as string) || "",
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addCategory(fd: FormData) {
    "use server";
    const name = fd.get("name") as string;
    if (!name || !restaurant) return;
    await db.category.create({ data: { name, restaurantId: restaurant.id } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addMenuItem(fd: FormData) {
    "use server";
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    const categoryId = fd.get("categoryId") as string;
    if (!name || isNaN(price) || !categoryId || !restaurant) return;
    await db.menuItem.create({
      data: {
        name,
        price,
        description: (fd.get("description") as string) || null,
        imageUrl: (fd.get("imageUrl") as string) || null,
        categoryId,
        restaurantId: restaurant.id,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function updateMenuItem(fd: FormData) {
    "use server";
    const id = fd.get("id") as string;
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    if (!id || !name || isNaN(price) || !restaurant) return;
    await db.menuItem.update({
      where: { id },
      data: {
        name,
        price,
        description: (fd.get("description") as string) || null,
        imageUrl: (fd.get("imageUrl") as string) || null,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function deleteMenuItem(fd: FormData) {
    "use server";
    const id = fd.get("id") as string;
    if (id && restaurant) await db.menuItem.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  const inp = "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white";
  const fileBtn = "block w-full text-xs text-gray-700 border border-amber-400 rounded-xl p-1.5 bg-amber-50 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white cursor-pointer";

  return (
    <AdminPinGuard>
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('change', function(e) {
          var el = e.target;
          if (!el || el.type !== 'file') return;
          var file = el.files && el.files[0];
          if (!file) return;
          var hidden = el.previousElementSibling;
          var reader = new FileReader();
          reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
              var c = document.createElement('canvas'), max = 700, w = img.width, h = img.height;
              if (w > h && w > max) { h = Math.round(h * max / w); w = max; } else if (h > max) { w = Math.round(w * max / h); h = max; }
              c.width = w; c.height = h;
              c.getContext('2d').drawImage(img, 0, 0, w, h);
              if (hidden) hidden.value = c.toDataURL('image/jpeg', 0.75);
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      `}} />
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
            <h1 className="text-xl font-bold">{restaurant.name} — İdarəetmə Paneli</h1>
            <Link href={`/${restaurant.slug}`} target="_blank" className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm">Menyuya Bax ↗</Link>
          </div>

          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          <form action={updateRestaurantSettings} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 space-y-4">
            <h2 className="text-lg font-bold">👑 Loqo, Arxa Plan və Restoran Məlumatları</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="text-xs font-bold">1. Restoran Loqosu Seç</label><input type="hidden" name="logoUrl" defaultValue={r.logoUrl || ""} /><input type="file" accept="image/*" className={fileBtn} /></div>
              <div><label className="text-xs font-bold">2. Arxa Plan Şəkli Seç</label><input type="hidden" name="bgImageUrl" defaultValue={r.bgImageUrl || ""} /><input type="file" accept="image/*" className={fileBtn} /></div>
              <div><label className="text-xs font-bold">3. Telefon Ekranı Şəkli Seç</label><input type="hidden" name="heroFoodUrl" defaultValue={r.heroFoodUrl || ""} /><input type="file" accept="image/*" className={fileBtn} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input name="name" defaultValue={restaurant.name} placeholder="Restoran Adı" className={inp} />
              <input name="subtitle" defaultValue={r.subtitle || "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} className={inp} />
              <input name="slogan" defaultValue={r.slogan || "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} className={inp} />
              <input name="description" defaultValue={r.description || "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} className={inp} />
              <input name="wifiName" defaultValue={r.wifiName || "Fatullali 1"} className={inp} />
              <input name="wifiPassword" defaultValue={r.wifiPassword || "Fatullali12345"} className={inp} />
              <input name="phone" defaultValue={restaurant.phone} className={inp} />
              <input name="address" defaultValue={r.address || "Fətəli Xan Xoyski 98"} className={inp} />
              <input name="workingHours" defaultValue={r.workingHours || "8:00 / 23:30"} className={`${inp} md:col-span-2`} />
            </div>
            <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2.5 rounded-xl">💾 Loqo, Arxa Plan və Məlumatları Yadda Saxla</button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form action={addCategory} className="bg-white p-6 rounded-2xl shadow-sm space-y-3 h-fit">
              <h2 className="text-lg font-bold">➕ Yeni Kateqoriya</h2>
              <input name="name" placeholder="Kateqoriya Adı" required className={inp} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl">Kateqoriya Yarat</button>
            </form>

            <form action={addMenuItem} className="bg-white p-6 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-lg font-bold">🍔 Yeni Məhsul Əlavə Et</h2>
              <select name="categoryId" required className={inp}>
                <option value="">-- Kateqoriya Seçin --</option>
                {restaurant.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="name" placeholder="Məhsulun Adı" required className={inp} />
              <input type="number" step="0.01" name="price" placeholder="Qiymət (₼)" required className={inp} />
              <input name="description" placeholder="Tərkibi" className={inp} />
              <div><label className="text-xs font-bold">Məhsul Şəkli Qalereyadan Seç:</label><input type="hidden" name="imageUrl" /><input type="file" accept="image/*" className={fileBtn} /></div>
              <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl">Məhsulu Əlavə Et</button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xl font-bold">📋 Mövcud Menyunu Düzənlə (Ad, Qiymət, Şəkil)</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="border rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-lg border-b pb-2">{cat.name}</h3>
                {cat.menuItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 p-3 rounded-xl border space-y-2">
                    <form action={updateMenuItem} className="space-y-2">
                      <input type="hidden" name="id" value={item.id} />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input name="name" defaultValue={item.name} className={inp} />
                        <input type="number" step="0.01" name="price" defaultValue={item.price} className={inp} />
                        <input name="description" defaultValue={item.description || ""} placeholder="Tərkibi" className={inp} />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                        <div className="flex-1"><label className="text-xs font-bold">Yeni Şəkil Seç:</label><input type="hidden" name="imageUrl" defaultValue={item.imageUrl || ""} /><input type="file" accept="image/*" className={fileBtn} /></div>
                        <button type="submit" className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">💾 Yadda Saxla</button>
                      </div>
                    </form>
                    <form action={deleteMenuItem} className="text-right"><input type="hidden" name="id" value={item.id} /><button type="submit" className="text-red-500 text-xs font-bold">🗑 Sil</button></form>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPinGuard>
  );
}
// SON SƏTİR
