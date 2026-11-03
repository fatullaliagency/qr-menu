import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";

export const metadata = {
  title: "VÖEN və ödəniş məlumatları | QR Menü",
  robots: { index: false, follow: false },
};

const APPROVAL_LABELS = {
  NOT_SUBMITTED: "Müraciət edilməyib",
  PENDING: "Provayder yoxlayır",
  APPROVED: "Təsdiqlənib (müqavilə ayrıca yoxlanmalıdır)",
  REJECTED: "Rədd edilib",
} as const;

export default function RestaurantAdminPaymentSettingsPage() {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantAdminPaymentSettingsContent />
    </Suspense>
  );
}

async function RestaurantAdminPaymentSettingsContent() {
  // Server sessiyası yoxlanmadan heç bir hüquqi/ödəniş məlumatı oxunmur.
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="p-8 text-zinc-900">
        <h1 className="text-xl font-bold">Giriş tələb olunur</h1>
        <Link href="/admin" className="text-blue-700 underline">
          Admin giriş səhifəsinə keç
        </Link>
      </main>
    );
  }

  // Slug və restaurant ID URL-dən yox, imzalanmış sessiyadan götürülür.
  // Beləliklə digər restoranın məlumatı üçün URL dəyişmək mümkün deyil.
  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: {
      name: true,
      slug: true,
      paymentSettings: {
        select: {
          legalName: true,
          taxId: true,
          paymentMode: true,
          providerName: true,
          providerMerchantId: true,
          approvalStatus: true,
        },
      },
    },
  });

  if (!restaurant) {
    return <main className="p-8 text-zinc-900">Restoran tapılmadı.</main>;
  }

  const settings = restaurant.paymentSettings;
  const empty = "Daxil edilməyib";
  const fields = [
    { label: "Hüquqi şəxs / sahibkarın adı", value: settings?.legalName || empty },
    { label: "VÖEN", value: settings?.taxId || empty },
    {
      label: "Planlaşdırılan ödəniş rejimi",
      value: settings?.paymentMode === "CASH_AND_CARD"
        ? "Nağd + kart (yalnız planlaşdırma)"
        : "Yalnız nağd",
    },
    { label: "Ödəniş provayderi", value: settings?.providerName || empty },
    { label: "Provayder merchant ID (gizli açar deyil)", value: settings?.providerMerchantId || empty },
    {
      label: "Provayder təsdiqi",
      value: APPROVAL_LABELS[settings?.approvalStatus ?? "NOT_SUBMITTED"],
    },
  ];

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <Link
            href={"/admin?slug=" + encodeURIComponent(restaurant.slug)}
            className="text-sm font-medium text-blue-700 underline"
          >
            ← İdarəetmə panelinə qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">VÖEN və ödəniş məlumatları</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {restaurant.name} — yalnız bu restorana aid məlumatlar göstərilir.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Restoranın ödəniş parametrləri</h2>
          <dl className="divide-y divide-gray-200">
            {fields.map((field) => (
              <div key={field.label} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-5">
                <dt className="text-sm text-zinc-600">{field.label}</dt>
                <dd className="break-words text-sm font-semibold">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          Bu səhifə yalnız məlumatları göstərir. Dəyişiklikləri hələlik
          Super Admin idarə edir. Kart seçiminin qeyd edilməsi real kart
          ödənişini aktivləşdirmir. Bunun üçün provayderlə müqavilə,
          server inteqrasiyası və ödəniş təsdiqi tələb olunur.
        </p>
      </div>
    </main>
  );
}
