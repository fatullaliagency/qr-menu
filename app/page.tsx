import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import AdminPinGuard from "./admin/AdminPinGuard";

export const instant = false;

function makeSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "");
}

export default async function HomePage() {
  const restaurants = await db.restaurant.findMany({
    include: { categories: { include: { menuItems: true } } },
    orderBy: { name: "asc" },
  });

  async function createRestaurant(fd: FormData) {
    "use server";
    const name = (fd.get("name") as string) ?? "";
    const rawSlug = (fd.get("slug") as string) ?? "";
    const phone = (fd.get("phone") as string) ?? "";
    const pinCode = (fd.get("pinCode") as string) ?? "1234";
    const subtitle = (fd.get("subtitle") as string) ?? "";
    const address = (fd.get("address") as string) ?? "";

    const slug = makeSlug(rawSlug ? rawSlug : name);
    if (!name) return;
    if (!slug) return;
    if (!phone) return;

    const existing = await db.restaurant.findUnique({ where: { slug } });
    if (existing) return;

    await (db.restaurant as any).create({
      data: {
        name,
        slug,
        phone,
        pinCode: pinCode ? pinCode : "1234",
        subtitle: subtitle ? subtitle : "RESTORAN VƏ KAFE",
        slogan: "Zövqünüzə uyğun təamlarla xidmətinizdəyik!",
        description: "Dad, keyfiyyət və qonaqpərvərlik hər zaman bir arada.",
        address: address ? address : "Bakı şəhəri",
        workingHours: "09:00 / 23:30",
      },
    });

    revalidatePath("/");
  }

  async function updatePin(fd: FormData) {
    "use server";
    const id = (fd.get("id") as string) ?? "";
    const pinCode = (fd.get("pinCode") as string) ?? "";
    if (!id) return;
    if (!pinCode) return;
    await (db.restaurant as any).update({
      where: { id },
      data: { pinCode },
    });
    revalidatePath("/");
  }

  async function deleteRestaurant(fd: FormData) {
    "use server";
    const id = (fd.get("id") as string) ?? "";
    if (!id) return;
    await db.menuItem.deleteMany({ where: { restaurantId: id } });
    await db.category.deleteMany({ where: { restaurantId: id } });
    await db.restaurant.delete({ where: { id } });
    revalidatePath("/");
  }

  const inp = "w-full border border-zinc-700 bg-zinc-900 text-white rounded-xl px-3.5 py-2.5 text-sm";

  return (
    <AdminPinGuard storageKey="master_super_admin">
      <div className="min-h-screen bg-[#0b0a09] text-white p-6 md:p-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="border border-[#d4af37]/40 bg-[#141210] p-6 rounded-2xl flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#e5c158]">
                QR Menyu Platforması — Baş Admin
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Hər yeni restorana özəl PİN şifrəsi təyin edin (Baş Admin şifrəniz: 05230715)
              </p>
            </div>
            <div className="bg-[#1c1813] border border-[#d4af37]/30 px-4 py-2 rounded-xl text-center">
              <span className="text-xs text-zinc-400 block">Restoranlar</span>
              <span className="text-xl font-bold text-[#e5c158]">{restaurants.length}</span>
            </div>
          </div>

          <form action={createRestaurant} className="bg-[#141210] border border-[#d4af37]/30 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-[#e5c158]">➕ Yeni Restoran və Özəl Şifrə Yarat</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <input name="name" placeholder="Restoranın Adı (məs: Padişah)" required className={inp} />
              <input name="slug" placeholder="Link adı (məs: padisah)" required className={inp} />
              <input name="pinCode" placeholder="🔑 Restoranın PİN Şifrəsi (məs: 5566)" required className={inp} />
              <input name="phone" placeholder="WhatsApp (məs: 994501234567)" required className={inp} />
              <input name="subtitle" placeholder="Mətbəx (məs: Milli Mətbəx)" className={inp} />
              <input name="address" placeholder="Ünvan (məs: Bakı ş.)" className={inp} />
            </div>
            <button type="submit" className="w-full bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold py-3 rounded-xl transition">
              🚀 Yeni Restoranı Yarat
            </button>
          </form>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#e5c158]">🏪 Sistemdəki Restoranlar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {restaurants.map((rest) => {
                const r = rest as any;
                return (
                  <div key={rest.id} className="bg-[#141210] border border-[#d4af37]/30 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">{rest.name}</h3>
                        <p className="text-xs text-[#d4af37]">Link: /{rest.slug}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">📞 {rest.phone}</p>
                      </div>
                      <form action={deleteRestaurant}>
                        <input type="hidden" name="id" value={rest.id} />
                        <button type="submit" className="text-xs text-red-400 font-bold">Sil</button>
                      </form>
                    </div>

                    <form action={updatePin} className="flex items-center gap-2 bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                      <input type="hidden" name="id" value={rest.id} />
                      <span className="text-xs text-zinc-400 shrink-0">🔑 Restoran PİN:</span>
                      <input
                        name="pinCode"
                        defaultValue={r.pinCode ? r.pinCode : "1234"}
                        className="bg-black border border-zinc-700 text-[#e5c158] font-bold text-xs px-2.5 py-1.5 rounded-lg w-full"
                      />
                      <button type="submit" className="bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0">
                        Dəyiş
                      </button>
                    </form>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href={`/admin?slug=${rest.slug}`}
                        className="bg-[#d4af37] text-black text-xs font-bold py-2.5 px-3 rounded-xl text-center"
                      >
                        ⚙️ Admin Paneli
                      </Link>
                      <Link
                        href={`/${rest.slug}`}
                        target="_blank"
                        className="bg-zinc-800 text-white text-xs font-bold py-2.5 px-3 rounded-xl text-center"
                      >
                        📱 Müştəri Menyusu ↗
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminPinGuard>
  );
}
