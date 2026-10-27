import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import QrCodeBox from "./QrCodeBox";
import AdminPinGuard from "./AdminPinGuard";

export const instant = false;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const params = await searchParams;
  const activeSlug = params.slug ? params.slug : "fatullali";
  const restaurant = await db.restaurant.findUnique({
    where: { slug: activeSlug },
    include: { categories: { include: { menuItems: true } } },
  });

  if (!restaurant) return <div className="p-10 text-center text-red-600 font-bold">Restoran tapılmadı!</div>;
  const r = restaurant as any;

  async function saveRest(fd: FormData) {
    "use server";
    if (!restaurant) return;
    const n = fd.get("name") as string;
    const p = fd.get("phone") as string;
    const pin = fd.get("pinCode") as string;
    await (db.restaurant as any).update({
      where: { id: restaurant.id },
      data: {
        name: n ? n : restaurant.name,
        phone: p ? p : restaurant.phone,
        pinCode: pin ? pin : r.pinCode,
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
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addCat(fd: FormData) {
    "use server";
    const name = fd.get("name") as string;
    if (!restaurant) return;
    if (!name) return;
    await db.category.create({ data: { name, restaurantId: restaurant.id } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function addItem(fd: FormData) {
    "use server";
    if (!restaurant) return;
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    const categoryId = fd.get("categoryId") as string;
    const desc = fd.get("description") as string;
    const img = fd.get("imageUrl") as string;
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
        restaurantId: restaurant.id,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function editItem(fd: FormData) {
    "use server";
    if (!restaurant) return;
    const id = fd.get("id") as string;
    const name = fd.get("name") as string;
    const price = parseFloat(fd.get("price") as string);
    const desc = fd.get("description") as string;
    const img = fd.get("imageUrl") as string;
    if (!id) return;
    if (!name) return;
    if (isNaN(price)) return;
    await db.menuItem.update({
      where: { id },
      data: {
        name,
        price,
        description: desc ? desc : null,
        imageUrl: img ? img : null,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  async function delItem(fd: FormData) {
    "use server";
    if (!restaurant) return;
    const id = fd.get("id") as string;
    if (!id) return;
    await db.menuItem.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath(`/${restaurant.slug}`);
  }

  const picker = (name: string, label: string, val?: any) => (
    <div data-picker="1" className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
      <input type="hidden" name={name} defaultValue={val ? val : ""} />
      <div className="flex items-center gap-2">
        <img src={val ? val : undefined} style={{ display: val ? "block" : "none" }} className="w-11 h-11 rounded-lg object-cover border" data-prev="1" />
        <span className="text-xs font-bold text-zinc-800">{label}</span>
      </div>
      <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0">
        📷 Qalereyadan Seç
        <input type="file" accept="image/*" data-pick="1" className="hidden" />
      </label>
    </div>
  );

  const inp = "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white";

  return (
    <AdminPinGuard restaurantPin={r.pinCode ? r.pinCode : "1234"} storageKey={`auth_${restaurant.slug}`}>
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('change',function(e){var t=e.target;if(!t)return;if(!t.dataset.pick)return;var f=t.files[0];if(!f)return;var box=t.closest('[data-picker="1"]');var hid=box.querySelector('input[type="hidden"]');var im=box.querySelector('[data-prev="1"]');var r=new FileReader();r.onload=function(v){var i=new Image();i.onload=function(){var c=document.createElement('canvas'),m=700,w=i.width,h=i.height;if(w>h){if(w>m){h=Math.round(h*m/w);w=m;}}else{if(h>m){w=Math.round(w*m/h);h=m;}}c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);var d=c.toDataURL('image/jpeg',0.75);hid.value=d;if(im){im.src=d;im.style.display='block';}};i.src=v.target.result;};r.readAsDataURL(f);});
        document.addEventListener('click',function(e){var b=e.target.closest('[data-edit-btn]');if(!b)return;var el=document.getElementById('edit_'+b.dataset.editBtn);if(el){el.style.display=el.style.display==='none'?'block':'none';}});
      `}} />
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm">
            <h1 className="text-xl font-bold">{restaurant.name} — İdarəetmə Paneli</h1>
            <Link href={`/${restaurant.slug}`} target="_blank" className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm">Menyuya Bax ↗</Link>
          </div>
          <QrCodeBox slug={restaurant.slug} restaurantName={restaurant.name} />

          <form action={saveRest} className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 space-y-3">
            <h2 className="font-bold text-lg">👑 Loqo, Arxa Plan, PİN Şifrə və Məlumatlar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {picker("logoUrl", "1. Loqo Şəkli", r.logoUrl)}
              {picker("bgImageUrl", "2. Arxa Plan", r.bgImageUrl)}
              {picker("heroFoodUrl", "3. Vitrin Şəkli", r.heroFoodUrl)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <input name="name" defaultValue={r.name} placeholder="Restoran Adı" className={inp} />
              <input name="pinCode" defaultValue={r.pinCode ? r.pinCode : "1234"} placeholder="🔑 Bu Restoranın PİN Şifrəsi" className={inp} />
              <input name="subtitle" defaultValue={r.subtitle ? r.subtitle : "TÜRKİYƏ · AVROPA · MİLLİ MƏTBƏXİ"} className={inp} />
              <input name="slogan" defaultValue={r.slogan ? r.slogan : "Zövqünüzə uyğun təamlarla xidmətinizdəyik!"} className={inp} />
              <input name="description" defaultValue={r.description ? r.description : "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada."} className={inp} />
              <input name="wifiName" defaultValue={r.wifiName ? r.wifiName : "Fatullali 1"} className={inp} />
              <input name="wifiPassword" defaultValue={r.wifiPassword ? r.wifiPassword : "Fatullali12345"} className={inp} />
              <input name="phone" defaultValue={r.phone} className={inp} />
              <input name="address" defaultValue={r.address ? r.address : "Fətəli Xan Xoyski 98"} className={inp} />
              <input name="workingHours" defaultValue={r.workingHours ? r.workingHours : "8:00 / 23:30"} className={`${inp} md:col-span-2`} />
            </div>
            <button type="submit" className="w-full bg-amber-600 text-white font-bold py-2.5 rounded-xl">💾 Restoran Məlumatlarını və PİN Şifrəni Yadda Saxla</button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form action={addCat} className="bg-white p-5 rounded-2xl shadow-sm space-y-3 h-fit">
              <h2 className="font-bold">➕ Yeni Kateqoriya Əlavə Et</h2>
              <input name="name" placeholder="Kateqoriya Adı" required className={inp} />
              <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl">Kateqoriya Yarat</button>
            </form>
            <form action={addItem} className="bg-white p-5 rounded-2xl shadow-sm space-y-3">
              <h2 className="font-bold">🍔 Yeni Məhsul Əlavə Et</h2>
              <select name="categoryId" required className={inp}>
                <option value="">-- Kateqoriya Seçin --</option>
                {restaurant.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="name" placeholder="Məhsulun Adı" required className={inp} />
              <input type="number" step="0.01" name="price" placeholder="Qiymət (₼)" required className={inp} />
              <input name="description" placeholder="Tərkibi / Açıqlama" className={inp} />
              {picker("imageUrl", "Məhsul Şəkli")}
              <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-2.5 rounded-xl">Məhsulu Menyuya Əlavə Et</button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
            <h2 className="font-bold text-lg">📋 Mövcud Menyu Siyahısı</h2>
            {restaurant.categories.map((cat) => (
              <div key={cat.id} className="border rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-lg border-b pb-2">{cat.name}</h3>
                {cat.menuItems.map((it) => (
                  <div key={it.id} className="py-2 border-b last:border-b-0 space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-3">
                        {it.imageUrl && <img src={it.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border" />}
                        <div>
                          <div className="font-bold">{it.name}</div>
                          {it.description && <div className="text-xs text-gray-500">{it.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 mr-1">{it.price.toFixed(2)} ₼</span>
                        <button type="button" data-edit-btn={it.id} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                          ✏️ Düzənlə
                        </button>
                        <form action={delItem}>
                          <input type="hidden" name="id" value={it.id} />
                          <button type="submit" className="bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold px-3 py-1.5 rounded-lg">
                            Sil
                          </button>
                        </form>
                      </div>
                    </div>

                    <form id={`edit_${it.id}`} action={editItem} style={{ display: "none" }} className="bg-gray-50 p-3 rounded-xl border space-y-2">
                      <input type="hidden" name="id" value={it.id} />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input name="name" defaultValue={it.name} placeholder="Məhsul adı" className={inp} />
                        <input type="number" step="0.01" name="price" defaultValue={it.price} placeholder="Qiymət" className={inp} />
                        <input name="description" defaultValue={it.description ? it.description : ""} placeholder="Tərkibi" className={inp} />
                      </div>
                      {picker("imageUrl", "Yeni Şəkil Seç", it.imageUrl)}
                      <button type="submit" className="w-full bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl">
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
