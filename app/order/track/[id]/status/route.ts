import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { validTrackingToken } from "@/app/lib/order-tracking";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";

  if (!validTrackingToken(id, token)) {
    return NextResponse.json(
      { error: "Sifariş tapılmadı." },
      { status: 404, headers: NO_STORE }
    );
  }

  const order = await db.order.findUnique({
    where: { id },
    select: {
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      updatedAt: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Sifariş tapılmadı." },
      { status: 404, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt.toISOString(),
    },
    { headers: { ...NO_STORE, "Referrer-Policy": "no-referrer" } }
  );
}
