import { db } from "@/app/lib/db";
import { notFound } from "next/navigation";
import ClientRestaurantMenu from "./ClientRestaurantMenu";
export const instant = false;
interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// 1. Sunucu Tarafı: Veritabanından veriyi çekiyoruz
export default async function RestaurantMenuPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        include: {
          menuItems: {
            include: { video: { select: { updatedAt: true } } },
          },
        },
      },
    },
  });

  if (!restaurant) {
    notFound();
  }

  // Veriyi Client bileşenine aktarıyoruz
  return <ClientRestaurantMenu restaurant={restaurant} webOrdersEnabled={process.env.ENABLE_WEB_ORDERS === "true"} />;
}
