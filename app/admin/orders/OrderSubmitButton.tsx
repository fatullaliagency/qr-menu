"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function OrderSubmitButton({
  children,
  variant = "success",
}: {
  children: ReactNode;
  variant?: "success" | "danger";
}) {
  const { pending } = useFormStatus();
  const className = variant === "danger"
    ? "rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
    : "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? "İcra edilir..." : children}
    </button>
  );
}
