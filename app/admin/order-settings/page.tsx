import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";

async function saveFulfillmentSettings(formData: FormData) {
  "use server";
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const rawTableCount = formData.get("tableCount");
  if (typeof rawTableCount !== "string" || !/^\d{1,3}$/.test(rawTableCount)) {
    throw new Error("Masa sayı 0–200 aralığında olmalıdır.");
  }
  const tableCount = Number(rawTableCount);
  if (!Number.isInteger(tableCount) || tableCount > 200) {
    throw new Error("Masa sayı 0–200 aralığında olmalıdır.");
  }
  const dineInEnabled = formData.get("dineInEnabled") === "on";
  const deliveryEnabled = formData.get("deliveryEnabled") === "on";
  const pickupEnabled = formData.get("pickupEnabled") === "on";
  if (dineInEnabled && tableCount === 0) {
    throw new Error("Masa sifarişini aktiv etmək üçün ən azı 1 masa qeyd edin.");
  }
  if (!dineInEnabled && !deliveryEnabled && !pickupEnabled) {
    throw new Error("Ən azı bir sifariş xidmətini aktiv saxlayın.");
  }

  const result = await db.restaurant.updateMany({
    where: { id: session.restaurantId },
    data: { tableCount, dineInEnabled, deliveryEnabled, pickupEnabled },
  });
  if (result.count !== 1) throw new Error("Restoran tapılmadı.");
  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { slug: true },
  });
  if (restaurant) revalidatePath("/" + restaurant.slug);
  revalidatePath("/admin/order-settings");
  revalidatePath("/admin");
  redirect("/admin/order-settings?saved=1");
}

export default async function OrderSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    return <main className="p-8"><h1>Giriş tələb olunur</h1>
      <Link className="text-blue-700 underline" href="/admin">Admin girişinə qayıt</Link></main>;
  }
  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: {
      name: true, tableCount: true, dineInEnabled: true,
      deliveryEnabled: true, pickupEnabled: true,
    },
  });
  if (!restaurant) return <main className="p-8">Restoran tapılmadı.</main>;
  const query = await searchParams;
  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/admin" className="text-sm font-semibold text-indigo-700">← İdarəetmə paneli</Link>
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Masa və sifariş xidmətləri</h1>
          <p className="mt-2 text-sm text-zinc-600">{restaurant.name} · Bütün müştərilər eyni QR menyudan istifadə edir.</p>
        </header>
        {query.saved === "1" && (
          <p role="status" className="rounded-lg bg-emerald-100 p-3 font-semibold text-emerald-900">Parametrlər yadda saxlanıldı.</p>
        )}
        <form action={saveFulfillmentSettings} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold">
            Restoranda masa sayı
            <input type="number" name="tableCount" min="0" max="200" step="1" required
              defaultValue={restaurant.tableCount}
              className="mt-2 w-full rounded-xl border border-zinc-300 p-3 text-lg" />
            <span className="mt-1 block text-xs font-normal text-zinc-600">Məsələn, 20 yazsanız, müştəri 1–20 arası masa seçəcək.</span>
          </label>
          <fieldset className="space-y-4 border-t border-zinc-200 pt-4">
            <legend className="text-sm font-bold">Aktiv sifariş növləri</legend>
            <label className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
              <input type="checkbox" name="dineInEnabled" defaultChecked={restaurant.dineInEnabled}
                className="mt-1 h-5 w-5" />
              <span><strong>Restoranda · Masa seçimi</strong>
                <span className="block text-xs text-zinc-600">Ofisiant və mətbəx sifarişin masa nömrəsini görür.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
              <input type="checkbox" name="deliveryEnabled" defaultChecked={restaurant.deliveryEnabled}
                className="mt-1 h-5 w-5" />
              <span><strong>Çatdırılma</strong>
                <span className="block text-xs text-zinc-600">Müştəri masa seçmir, çatdırılma ünvanı qeyd edir.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3">
              <input type="checkbox" name="pickupEnabled" defaultChecked={restaurant.pickupEnabled}
                className="mt-1 h-5 w-5" />
              <span><strong>Al-apar</strong>
                <span className="block text-xs text-zinc-600">Sifariş əvvəlcədən verilir, restorandan götürülür.</span>
              </span>
            </label>
          </fieldset>
          <p className="text-xs text-zinc-500">Ən azı bir xidmət aktiv olmalıdır. Dəyişikliklər yeni sifarişlərə tətbiq olunur.</p>
          <button type="submit" className="w-full rounded-xl bg-indigo-700 p-3 font-bold text-white">
            💾 Yadda saxla
          </button>
        </form>
      </div>
    </main>
  );
}
