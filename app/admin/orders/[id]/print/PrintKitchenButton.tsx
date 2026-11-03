"use client";

export default function PrintKitchenButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
    >
      🖨️ Çap et
    </button>
  );
}
