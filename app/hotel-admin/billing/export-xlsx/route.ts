import {NextRequest,NextResponse} from "next/server";
import {db} from "@/app/lib/db";
import {getHotelSession} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
import {parseHotelFolioDateRange} from "@/app/lib/hotel-folio-export";
import {hotelFolioXlsx} from "@/app/lib/hotel-folio-xlsx";
const HEADERS={
 "Cache-Control":"private, no-store, max-age=0, must-revalidate",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "Vary":"Cookie",
};
export async function GET(request:NextRequest) {
 if(!hotelModuleEnabled())return new NextResponse("Not found",{status:404,headers:HEADERS});
 const manager=await getHotelSession();
 if(!manager)return new NextResponse("Giriş tələb olunur",{status:401,headers:HEADERS});
 const q=request.nextUrl.searchParams;
 const range=parseHotelFolioDateRange(q.get("from"),q.get("to"));
 if(!range)return new NextResponse("Tarix aralığı yanlışdır (maksimum 31 gün).",{status:400,headers:HEADERS});
 const hotel=await db.hotel.findUnique({
  where:{id:manager.hotelId},select:{name:true,slug:true}
 });
 if(!hotel)return new NextResponse("Not found",{status:404,headers:HEADERS});
 const records=await db.hotelRoomCharge.findMany({
  where:{hotelId:manager.hotelId,createdAt:{gte:range.start,lt:range.endExclusive}},
  orderBy:[{createdAt:"asc"},{id:"asc"}],
  take:5001,
  select:{
   room:{select:{number:true}},stayKey:true,amount:true,status:true,
   createdAt:true,approvedAt:true,
   order:{select:{id:true,department:true,status:true}}
  }
 });
 if(records.length>5000)return new NextResponse(
  "Hesabat üçün 5000-dən çox qeyd var. Tarix aralığını daraldın.",
  {status:413,headers:HEADERS}
 );
 const rows=records.map(r=>({
  hotel:hotel.name,room:r.room.number,stay:r.stayKey,orderId:r.order.id,
  department:r.order.department,orderStatus:r.order.status,chargeStatus:r.status,
  amount:r.amount.toFixed(2),createdAt:r.createdAt.toISOString(),
  approvedAt:r.approvedAt?.toISOString()??""
 }));
 const xlsx=hotelFolioXlsx(hotel.name,rows,
  range.start.toISOString().slice(0,10),
  new Date(range.endExclusive.getTime()-86400000).toISOString().slice(0,10));
 const filename="hotel-hesabat-"+hotel.slug+"-"+range.start.toISOString().slice(0,10)+".xlsx";
 return new NextResponse(new Uint8Array(xlsx),{
  status:200,
  headers:{...HEADERS,
   "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
   "Content-Disposition":'attachment; filename="'+filename+'"'
  }
 });
}
