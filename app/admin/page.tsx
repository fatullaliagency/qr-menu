import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";

export const instant = false;

async function saveRest(fd: FormData) {
  "use server";
  try {
    const restId = fd.get("restId") as string;
    const slug = fd.get("slug") as string;
    const name = fd.get("name") as string;
    const phone = fd.get("phone") as string;
    if (!restId) return;
    await (db.restaurant as any).update({
      where: { id: restId },
      data: {
        name: name ? name : "Fatullali",
        phone: phone ? phone : "",
        subtitle: (fd.get("subtitle") as string) ?? "",
        slogan: (fd.get("slogan") as string) ?? "",
        description: (fd.get("description") as string) ?? "",
        logoUrl: (fd.get("logoUrl") as string) ?? "",
        bgImageUrl: (fd.get("bgImageUrl") as string) ?? "",
        heroFoodUrl: (fd.get("heroFoodUrl") as string) ?? "",
        wifiName: (fd.get("wifiName") as string) ?? "",
        wifiPassword: (fd.get("wifiPassword") as string) ?? "",
        address: (fd.get("address") as string) ?? "",
        workingHours: (fd.get("workingHours") as string) ?? "",
      },
    });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function addCat(fd: FormData) {
  "use server";
  try {
    const restId = fd.get("restId") as string;
    const slug = fd.get("slug") as string;
    const name = fd.get("name") as string;
    if (!restId) return;
    if (!name) return;
    await db.category.create({ data: { name, restaurantId: restId } });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function editCat(fd: FormData) {
  "use server";
  try {
    const id = fd.get("id") as string;
    const slug = fd.get("slug") as string;
    const name = fd.get("name") as string;
    if (!id) return;
    if (!name) return;
    await db.category.updateMany({ where: { id }, data: { name } });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function delCat(fd: FormData) {
  "use server";
  try {
    const id = fd.get("id") as string;
    const slug = fd.get("slug") as string;
    if (!id) return;
    await db.menuItem.deleteMany({ where: { categoryId: id } });
    await db.category.deleteMany({ where: { id } });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function addItem(fd: FormData) {
  "use server";
  try {
    const restId = fd.get("restId") as string;
    const slug = fd.get("slug") as string;
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    const categoryId = fd.get("categoryId") as string;
    const desc = fd.get("description") as string;
    const img = fd.get("imageUrl") as string;
    if (!restId) return;
    if (!name) return;
    if (isNaN(price)) return;
    if (!categoryId) return;
    await db.menuItem.create({
      data: {
        name,
        price,
        description: desc ? desc : null,
        imageUrl: img ? img : null,
        categoryId,
        restaurantId: restId,
      },
    });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function editItem(fd: FormData) {
  "use server";
  try {
    const id = fd.get("id") as string;
    const slug = fd.get("slug") as string;
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    const desc = fd.get("description") as string;
    const img = fd.get("imageUrl") as string;
    if (!id) return;
    if (!name) return;
    if (isNaN(price)) return;
    await db.menuItem.updateMany({
      where: { id },
      data: {
        name,
        price,
        description: desc ? desc : null,
        imageUrl: img ? img : null,
      },
    });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

async function delItem(fd: FormData) {
  "use server";
  try {
    const id = fd.get("id") as string;
    const slug = fd.get("slug") as string;
    if (!id) return;
    await db.menuItem.deleteMany({ where: { id } });
    revalidatePath("/admin");
    if (slug) revalidatePath(`/${slug}`);
  } catch (e) {
    console.error(e);
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const params = await searchParams;
  const activeSlug = params.slug ? params.slug : "fatullali";
  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
    include: { categories: { include: { menuItems: true } } },
  });

  if (!restaurant) return <div className="p-10 text-center text-red-600 font-bold">Restoran tapılmadı!</div>;
  const r = restaurant as any;

  const picker = (name: string, label: string, val?: any) => (
    <div data-picker="1" className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
      <input type="hidden" name={name} defaultValue={val ? val : ""} />
      <div className="flex items-center gap-2.5">
        <img src={val ? val : undefined} style={{ display: val ? "block" : "none" }} className="w-12 h-12 rounded-lg object-cover border border-amber-400" data-prev="1" />
        <span className="text-xs font-bold text-zinc-800">{label}</span>
      </div>
      <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shrink-0 shadow-sm">
        📷 Qalereyadan Seç
        <input type="file" accept="image/*" data-pick="1" className="hidden" />
      </label>
    </div>
  );

  const inp = "w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm bg-white";

  return (
    <AdminPinGuard>
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('change',function(e){var t=e.target;if(!t)return;if(!t.dataset.pick)return;var f=t.files[0];if(!f)return;var box=t.closest('[data-picker="1"]');var hid=box.querySelector('input[type="hidden"]');var im=box.querySelector('[data-prev="1"]');var r=new FileReader();r.onload=function(v){var i=new Image();i.onload=function(){var c=document.createElement('canvas'),m=600,w=i.width,h=i.height;if(w>h){if(w>m){h=Math.round(h*m/w);w=m;}}else{if(h>m){w=Math.round(w*m/h);h=m;}}c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);var d=c.toDataURL('image/jpeg',0.72);hid.value=d;if(im){im.src=d;im.style.display='block';}};i.src=v.target.result;};r.readAsDataURL(f);});
      `}} />
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-zinc-900">{restaurant.name} — İdarəetmə Paneli</h1>
              <p className="text-xs text-gray-500">Şəkilləri qalereyadan seçin, məhsulları düzənləyin və ya silin</p>
            </div>
            <Link href={`/${restaurant.slug}`} target="_blank" className="bg-zinc-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
              Menyuya Bax ↗
            </Link>
          </div>

          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          <form action={saveRest} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200 space-y-4">
            <input type="hidden" name="restId" value={restaurant.id} />
            <input type="hidden" name="slug" value={restaurant.slug} />
            <h2 className="font-bold text-lg">👑 Restoran Loqosu, Arxa Plan və Məlumatlar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {picker("logoUrl", "1. Loqo Şəkli", r.logoUrl)}
              {picker("bgImageUrl", "2. Arxa Plan", r.bgImageUrl)}
              {picker("heroFoodUrl", "3. Vitrin Şəkli", r.heroFoodUrl)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input name="name" defaultValue={r.name} placeholder="Restoran Adı" className={inp} />
              <input name="subtitle" defaultValue={r.subtitle ? r.subtitle : "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} placeholder="Alt Başlıq" className={inp} />
              <input name="slogan" defaultValue={r.slogan ? r.slogan : "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} placeholder="Sloqan" className={inp} />
              <input name="description" defaultValue={r.description ? r.description : "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} placeholder="Açıqlama" className={inp} />
              <input name="wifiName" defaultValue={r.wifiName ? r.wifiName : "Fatullali 1"} placeholder="Wi-Fi Adı" className={inp} />
              <input name="wifiPassword" defaultValue={r.wifiPassword ? r.wifiPassword : "Fatullali12345"} placeholder="Wi-Fi Şifrəsi" className={inp} />
              <input name="phone" defaultValue={r.phone} placeholder="Telefon / WhatsApp" className={inp} />
              <input name="address" defaultValue={r.address ? r.address : "Fətəli Xan Xoyski 98"} placeholder="Ünvan" className={inp} />
              <input name="workingHours" defaultValue={r.workingHours ? r.workingHours : "8:00 / 23:30"} placeholder="İş Saatları" className={`${inp} md:col-span-2`} />
            </div>
            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl">
              💾 Restoran Məlumatlarını Yadda Saxla
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form action={addCat} className="bg-white p-6 rounded-2xl shadow-sm space-y-3 h-fit">
              <input type="hidden" name="restId" value={restaurant.id} />
              <input type="hidden" name="slug" value={restaurant.slug} />
              <h2 className="font-bold text-lg">➕ Yeni Kateqoriya Əlavə Et</h2>
              <input name="name" placeholder="Məs: İsti İçkilər, Kabablar..." required className={inp} />
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl">
                Kateqoriya Yarat
              </button>
            </form>

            <form action={addItem} className="bg-white p-6 rounded-2xl shadow-sm space-y-3">
              <input type="hidden" name="restId" value={restaurant.id} />
              <input type="hidden" name="slug" value={restaurant.slug} />
              <h2 className="font-bold text-lg">🍔 Yeni Məhsul Əlavə Et</h2>
              <select name="categoryId" required className={inp}>
                <option value="">-- Kateqoriya Seçin --</option>
                {restaurant.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input name="name" placeholder="Məhsulun Adı" required className={inp} />
              <input type="number" step="0.01" name="price" placeholder="Qiymət (₼)" required className={inp} />
              <input name="description" placeholder="Tərkibi / Açıqlama" className={inp} />
              {picker("imageUrl", "Məhsulun Şəkli")}
              <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl">
                Məhsulu Menyuya Əlavə Et
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-5">
            <h2 className="font-bold text-xl">📋 Mövcud Menyu Siyahısı (Düzənlə və Sil)</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <form action={editCat} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="hidden" name="slug" value={restaurant.slug} />
                    <input name="name" defaultValue={cat.name} className="font-bold text-base border border-gray-300 rounded-lg px-3 py-1" />
                    <button type="submit" className="bg-zinc-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                      Adı Dəyiş
                    </button>
                  </form>
                  <form action={delCat}>
                    <input type="hidden" name="id" value={cat.id} />
                    <input type="hidden" name="slug" value={restaurant.slug} />
                    <button type="submit" className="text-red-500 hover:text-red-700 text-xs font-bold">
                      🗑️ Kateqoriyanı Sil
                    </button>
                  </form>
                </div>

                {cat.menuItems.map((it) => (
                  <div key={it.id} className="py-3 border-b last:border-b-0">
                    <input type="checkbox" id={`edit_${it.id}`} className="peer hidden" />
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3">
                        {it.imageUrl && (
                          <img src={it.imageUrl} alt={it.name} className="w-14 h-14 rounded-xl object-cover border" />
                        )}
                        <div>
                          <div className="font-bold text-zinc-900">{it.name}</div>
                          {it.description && <div className="text-xs text-gray-500">{it.description}</div>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-emerald-600 mr-1">{it.price.toFixed(2)} ₼</span>
                        <label
                          htmlFor={`edit_${it.id}`}
                          className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
                        >
                          ✏️ Düzənlə
                        </label>
                        <form action={delItem}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="slug" value={restaurant.slug} />
                          <button
                            type="submit"
                            className="bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold px-3.5 py-2 rounded-xl"
                          >
                            🗑️ Sil
                          </button>
                        </form>
                      </div>
                    </div>

                    <form
                      action={editItem}
                      className="hidden peer-checked:block mt-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-3"
                    >
                      <input type="hidden" name="id" value={it.id} />
                      <input type="hidden" name="slug" value={restaurant.slug} />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Məhsulun Adı</label>
                          <input name="name" defaultValue={it.name} required className={inp} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Qiymət (₼)</label>
                          <input type="number" step="0.01" name="price" defaultValue={it.price} required className={inp} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">Tərkibi / Açıqlama</label>
                          <input name="description" defaultValue={it.description ? it.description : ""} className={inp} />
                        </div>
                      </div>
                      {picker("imageUrl", "Yeni Şəkil Seç (Qalereyadan)", it.imageUrl)}
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl"
                      >
                        💾 Dəyişiklikləri Yadda Saxla
                      </button>
                    </form>
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
