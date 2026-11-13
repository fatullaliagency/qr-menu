import { notFound } from "next/navigation";
import { connection } from "next/server";
import DeviceDiagnostics from "./DeviceDiagnostics";

export const metadata = { title: "Otel — telefon qəbul testi", robots: { index: false, follow: false } };

export default async function HotelDeviceCheckPage() {
  await connection();
  // Public device-only diagnostics: explicitly opt-in on the isolated hotel project.
  // No database access, guest details, tokens or uploads.
  if (process.env.HOTEL_DEVICE_CHECK_ENABLED !== "true") notFound();
  return (
    <main className="min-h-screen bg-zinc-100 p-5 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-xl bg-white p-5">
          <p className="text-sm font-semibold text-emerald-800">Otel modulunun qəbul sınağı</p>
          <h1 className="mt-1 text-2xl font-bold">Telefon və brauzer yoxlaması</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Real iPhone və ya Android cihazınızda kameranın, səsin və bildiriş icazələrinin
            işləməsini yoxlayın. Bu səhifə sifariş yaratmır və verilənlər bazasına qoşulmur.
          </p>
        </header>
        <DeviceDiagnostics />
      </div>
    </main>
  );
}
