import { db } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
export const instant = false;
export default async function PlatformHome() {
  // Sistemde kayıtlı olan tüm restoranları çekiyoruz
  const restaurants = await db.restaurant.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Yeni Restoran Kayıt Fonksiyonu (Server Action)
  async function createRestaurant(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const rawSlug = formData.get("slug") as string;
    const phone = formData.get("phone") as string;

    if (!name || !rawSlug || !phone) return;

    // URL adresini (slug) temiz ve uygun hale getiriyoruz (örn: "Fatullali Restoran" -> "fatullali-restoran")
    const slug = rawSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    const existing = await db.restaurant.findUnique({
      where: { slug },
    });

    if (!existing) {
      await db.restaurant.create({
        data: {
          name,
          slug,
          phone,
        },
      });
    }

    // Kayıt biter bitmez yeni restoranın kendi yönetim paneline yönlendir
    redirect(`/admin?slug=${slug}`);
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Sol Taraf: Tanıtım */}
        <div className="space-y-6">
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
            🚀 SaaS QR Menyu Platforması
          </span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Restoranınızı rəqəmsal dünyaya daşıyın
          </h1>
          <p className="text-zinc-400 text-lg">
            Saniyələr içində öz QR menyunuzu yaradın, məhsullarınızı əlavə edin və WhatsApp üzərindən birbaşa sifariş qəbul etməyə başlayın.
          </p>

          {/* Mevcut Restoranlar Listesi */}
          {restaurants.length > 0 && (
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-3">
                Sistemdəki Aktiv Restoranlar:
              </p>
              <div className="flex flex-wrap gap-2">
                {restaurants.map((rest) => (
                  <div
                    key={rest.id}
                    className="flex items-center bg-zinc-800 rounded-xl overflow-hidden text-sm border border-zinc-700"
                  >
                    <Link
                      href={`/${rest.slug}`}
                      className="px-3 py-1.5 hover:bg-zinc-700 transition font-medium"
                    >
                      🍴 {rest.name}
                    </Link>
                    <Link
                      href={`/admin?slug=${rest.slug}`}
                      className="bg-zinc-950 px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition border-l border-zinc-700"
                      title="İdarəetmə Paneli"
                    >
                      ⚙️ İdarə et
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Taraf: Yeni Restoran Kayıt Formu */}
        <div className="bg-zinc-800/70 border border-zinc-700 p-6 md:p-8 rounded-3xl shadow-xl">
          <h2 className="text-2xl font-bold mb-6">✨ Yeni Restoran Qeydiyyatı</h2>
          <form action={createRestaurant} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Restoranın Adı
              </label>
              <input
                type="text"
                name="name"
                placeholder="Məs: Bakı Gecələri"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Menyu Linki (URL Slug)
              </label>
              <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500">
                <span className="text-zinc-500 text-sm select-none">
                  site.com/
                </span>
                <input
                  type="text"
                  name="slug"
                  placeholder="baki-geceleri"
                  required
                  className="w-full bg-transparent text-white focus:outline-none ml-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                WhatsApp Sifariş Nömrəsi
              </label>
              <input
                type="text"
                name="phone"
                placeholder="Məs: 994501234567"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-emerald-400 transition shadow-lg mt-2"
            >
              Restoranı Yarat və Panelə Keç →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}