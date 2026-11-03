import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";

export const metadata = {
  title: "Restoran menyusu | QR Menü Super Admin",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export default function SuperAdminRestaurantMenuPage(props: Props) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantMenuContent {...props} />
    </Suspense>
  );
}

async function RestaurantMenuContent({ params }: Props) {
  // Məlumat oxunmadan əvvəl serverdə Super Admin sessiyası yoxlanılır.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) notFound();

  // Yalnız URL-də seçilmiş restorana bağlı kateqoriya və məhsullar oxunur.
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      categories: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          menuItems: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
            },
          },
        },
      },
    },
  });
  if (!restaurant) notFound();

  const productCount = restaurant.categories.reduce(
    (sum, category) => sum + category.menuItems.length,
    0
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm font-medium text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">{restaurant.name} — Menyu icmalı</h1>
          <p className="mt-2 text-sm text-zinc-600">
            URL adı: {restaurant.slug}. Bu səhifə yalnız baxış üçündür.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-zinc-100 px-3 py-2">
              Kateqoriya: <strong>{restaurant.categories.length}</strong>
            </span>
            <span className="rounded-lg bg-zinc-100 px-3 py-2">
              Məhsul: <strong>{productCount}</strong>
            </span>
          </div>
          <Link
            href={"/" + restaurant.slug}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-medium text-blue-700 underline"
          >
            Müştəri menyusunu aç ↗
          </Link>
        </header>

        {restaurant.categories.length === 0 ? (
          <section className="rounded-xl bg-white p-5 text-zinc-600 shadow-sm">
            Bu restoranda hələ kateqoriya yaradılmayıb.
          </section>
        ) : (
          restaurant.categories.map((category) => (
            <section key={category.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <h2 className="text-lg font-bold">{category.name}</h2>
                <span className="text-sm text-zinc-600">
                  {category.menuItems.length} məhsul
                </span>
              </div>
              {category.menuItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Bu kateqoriyada məhsul yoxdur.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {category.menuItems.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.name}</p>
                        {item.description && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-600">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="whitespace-nowrap font-semibold text-emerald-800">
                        {item.price.toFixed(2)} ₼
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
        <p className="text-sm text-zinc-600">
          Burada menyu redaktə edilmir. Məhsulları restoranın öz admin paneli idarə edir.
        </p>
      </div>
    </main>
  );
}
