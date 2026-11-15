import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getHotelSession } from "@/app/lib/hotel-auth";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";
import { hotelFolioCsv, parseHotelFolioDateRange } from "@/app/lib/hotel-folio-export";
const HEADERS = {
 "Cache-Control":"private, no-store, max-age=0, must-revalidate",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "Vary":"Cookie",
};
export async function GET(request: NextRequest) {
 if(!hotelModuleEnabled())return new NextResponse("Not found",{status:404,headers:HEADERS});
 const manager=await getHotelSession();
 if(!manager)return new NextResponse("Giriş tələb olunur",{status:401,headers:HEADERS});
 const q=request.nextUrl.searchParams;
 const range=parseHotelFolioDateRange(q.get("from"),q.get("to"));
 if(!range)return new NextResponse("Tarix aralığı yanlışdır (maksimum 31 gün).",{status:400,headers:HEADERS});
 const hotel=await db.hotel.findUnique({where:{id:manager.hotelId},select:{name:true,slug:true}});
 if(!hotel)return new NextResponse("Not found",{status:404,headers:HEADERS});
 const charges=await db.hotelRoomCharge.findMany({
  where:{hotelId:manager.hotelId,createdAt:{gte:range.start,lt:range.endExclusive}},
  orderBy:[{createdAt:"asc"},{id:"asc"}],
  take:5001,
  select:{
   room:{select:{number:true}},stayKey:true,amount:true,status:true,
   createdAt:true,approvedAt:true,
   order:{select:{id:true,department:true,status:true}},
  },
 });
 if(charges.length>5000)return new NextResponse("Hesabat üçün 5000-dən çox qeyd var. Tarix aralığını daraldın.",{status:413,headers:HEADERS});
 const csv=hotelFolioCsv(charges.map(c=>({
  hotel:hotel.name,room:c.room.number,stay:c.stayKey,orderId:c.order.id,
  department:c.order.department,orderStatus:c.order.status,chargeStatus:c.status,
  amount:c.amount.toFixed(2),createdAt:c.createdAt.toISOString(),
  approvedAt:c.approvedAt?.toISOString()??"",
 })));
 const file=`hotel-folio-${hotel.slug}-${range.start.toISOString().slice(0,10)}.csv`;
 return new NextResponse(csv,{status:200,headers:{
  ...HEADERS,
  "Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":`attachment; filename="${file}"`,
 }});
}
