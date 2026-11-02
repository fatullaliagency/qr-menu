import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import { saveRestaurantPaymentSettings } from "./actions";

export const metadata = {
  title: "Restoran ödəniş parametrləri | QR Menü",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
};

const APPROVAL_LABELS = {
  NOT_SUBMITTED: "Müraciət edilməyib",
  PENDING: "Provayder yoxlayır",
  APPROVED: "Təsdiqlənib (müqaviləni ayrıca yoxlayın)",
  REJECTED: "Rədd edilib",
} as const;

export default function RestaurantPaymentSettingsPage(props: PageProps) {
  return (
    <Suspense fallback={<main className="p-8">Yüklənir...</main>}>
      <RestaurantPaymentSettingsContent {...props} />
    </Suspense>
  );
}

async function RestaurantPaymentSettingsContent({ params, searchParams }: PageProps) {
  // Hər hansı restoran və maliyyə məlumatı oxunmadan əvvəl sessiya yoxlanır.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const { slug } = await params;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) notFound();

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
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
          updatedAt: true,
        },
      },
    },
  });
  if (!restaurant) notFound();

  const query = await searchParams;
  const settings = restaurant.paymentSettings;
  const input = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900";

  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-xl bg-white p-5 shadow-sm">
          <Link href="/superadmin" className="text-sm text-blue-700 underline">
            ← Super Admin icmalına qayıt
          </Link>
          <h1 className="mt-3 text-2xl font-bold">
            {restaurant.name} — Ödəniş parametrləri
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Restoran: {restaurant.slug}. Bu bölməyə yalnız Super Admin daxil ola bilər.
          </p>
        </header>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Provayder təsdiqi</h2>
          <p className="mt-2 text-sm">
            Mövcud status: <strong>{APPROVAL_LABELS[settings?.approvalStatus ?? "NOT_SUBMITTED"]}</strong>
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Bu status burada dəyişdirilmir. Kart ödənişi üçün provayder müqaviləsi,
            ayrı server inteqrasiyası və ödənişin təhlükəsiz təsdiqi tələb olunur.
            Aşağıdakı seçimlər kart ödənişini avtomatik açmır.
          </p>
          {settings?.updatedAt && (
            <p className="mt-2 text-xs text-zinc-500">
              Son yenilənmə: {settings.updatedAt.toLocaleString("az-AZ", { timeZone: "Asia/Baku" })}
            </p>
          )}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">Restoranın hüquqi və ödəniş məlumatları</h2>
          {query.saved === "1" && (
            <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-900">
              Məlumatlar yadda saxlanıldı.
            </p>
          )}
          {query.error === "validation" && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-900">
              Məlumatlar düzgün deyil. VÖEN 10 rəqəm olmalıdır; provayder adı
              və merchant ID hər ikisi doldurulmalı və ya hər ikisi boş qalmalıdır.
            </p>
          )}
          {query.error === "stale" && (
            <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">
              Məlumatlar başqa yerdə dəyişdirilib. Səhifəni yeniləyərək təkrar yoxlayın.
            </p>
          )}
          <form action={saveRestaurantPaymentSettings} className="space-y-4">
            <input type="hidden" name="slug" value={restaurant.slug} />
            <input type="hidden" name="version" value={settings?.updatedAt.toISOString() ?? "new"} />
            <label className="block text-sm font-medium">
              Hüquqi şəxs / sahibkarın adı
              <input
                type="text"
                name="legalName"
                maxLength={200}
                defaultValue={settings?.legalName ?? ""}
                autoComplete="organization"
                placeholder="Rəsmi qeydiyyat adı"
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              VÖEN (10 rəqəm)
              <input
                type="text"
                name="taxId"
                maxLength={10}
                inputMode="numeric"
                pattern="[0-9]{10}"
                defaultValue={settings?.taxId ?? ""}
                placeholder="10 rəqəmli VÖEN"
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              Planlaşdırılan ödəniş üsulları
              <select
                name="paymentMode"
                defaultValue={settings?.paymentMode ?? "CASH_ONLY"}
                className={input}
              >
                <option value="CASH_ONLY">Yalnız nağd</option>
                <option value="CASH_AND_CARD">Nağd + kart (yalnız planlaşdırma)</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Ödəniş provayderinin adı
              <input
                type="text"
                name="providerName"
                maxLength={100}
                defaultValue={settings?.providerName ?? ""}
                placeholder="Məsələn: bank və ya provayder"
                className={input}
              />
            </label>
            <label className="block text-sm font-medium">
              Provayder merchant ID (gizli açar deyil)
              <input
                type="text"
                name="providerMerchantId"
                maxLength={150}
                defaultValue={settings?.providerMerchantId ?? ""}
                autoComplete="off"
                placeholder="Provayderin verdiyi merchant identifikatoru"
                className={input}
              />
            </label>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              Bu formada parol, API tokeni, gizli açar, bank kartı nömrəsi və CVV daxil etməyin.
              VÖEN-in burada qeyd edilməsi vergi və ya bank təsdiqi demək deyil.
            </p>
            <button type="submit" className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-semibold text-white">
              Ödəniş parametrlərini yadda saxla
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
