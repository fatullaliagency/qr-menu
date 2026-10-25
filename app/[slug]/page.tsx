import { db } from "@/app/lib/db";
import { notFound } from "next/navigation";
import ClientRestaurantMenu from "./ClientRestaurantMenu";

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
          menuItems: true, // Şemadaki 'menuItems' alanı ile birebir eşleştirildi
        },
      },
    },
  });

  if (!restaurant) {
    notFound();
  }

  // Veriyi Client bileşenine aktarıyoruz
  return <ClientRestaurantMenu restaurant={restaurant} />;
}