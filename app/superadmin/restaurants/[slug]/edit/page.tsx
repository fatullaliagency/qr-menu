import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import { updateSuperAdminRestaurant } from "./actions";

export const metadata = {
  title: "Restoran məlumatlarını düzəlt | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    saved?: string | string[];
    error?: string | string[];
  }>;
};

export default function EditSuperAdminRestaurantPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <EditRestaurantContent {...props} />
    </Suspense>
  );
}

async function EditRestaurantContent({ params, searchParams }: Props) {
  // Restaurant məlumatı yalnız yoxlanılmış Super Admin sessiyasına göstərilir.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) notFound();

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      phone: true,
      address: true,
      workingHours: true,
    },
  });
  if (!restaurant) notFound();

  const query = await searchParams;
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900";

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm font-medium text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">Restoran məlumatlarını düzəlt</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Restoran: <strong>{restaurant.slug}</strong> — bu menyu ünvanı dəyişdirilmir.
          </p>
        </header>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          {query.saved === "1" && (
            <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              Restoran məlumatları uğurla yadda saxlanıldı.
            </p>
          )}
          {query.error === "validation" && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">
              Məlumatları yoxlayın: restoran adı 2–200, telefon 3–100, ünvan 500,
              iş saatları isə maksimum 200 simvol ola bilər.
            </p>
          )}
          <form action={updateSuperAdminRestaurant} className="space-y-4">
            <input type="hidden" name="slug" value={restaurant.slug} />
            <label className="block text-sm font-medium">
              Restoranın adı
              <input
                name="name"
                required
                minLength={2}
                maxLength={200}
                defaultValue={restaurant.name}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              Telefon / WhatsApp
              <input
                name="phone"
                type="tel"
                required
                minLength={3}
                maxLength={100}
                defaultValue={restaurant.phone}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              Ünvan
              <textarea
                name="address"
                rows={3}
                maxLength={500}
                defaultValue={restaurant.address ?? ""}
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              İş saatları
              <input
                name="workingHours"
                maxLength={200}
                defaultValue={restaurant.workingHours ?? ""}
                placeholder="Məsələn: 09:00–23:00"
                className={input}
              />
            </label>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Bu forma yalnız restoranın ümumi məlumatlarını dəyişir.
              PİN, URL adı, VÖEN, kart ödənişi parametrləri və sifarişlər dəyişdirilmir.
            </p>
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white hover:bg-zinc-800"
            >
              Restoran məlumatlarını yadda saxla
            </button>
          </form>
        </section>
        <div className="flex flex-wrap gap-4 text-sm text-blue-700 underline">
          <Link href={"/" + restaurant.slug}>Müştəri menyusunu aç</Link>
          <Link href={"/superadmin/restaurants/" + restaurant.slug + "/payment-settings"}>
            VÖEN və ödəniş ayarları
          </Link>
        </div>
      </div>
    </main>
  );
}
