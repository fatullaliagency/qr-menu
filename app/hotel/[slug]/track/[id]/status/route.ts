import {NextRequest,NextResponse} from "next/server";
import {db} from "@/app/lib/db";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
import {verifyHotelTrackingToken} from "@/app/lib/hotel-security";
const H={"Cache-Control":"private, no-store, max-age=0, must-revalidate","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
export async function GET(req:NextRequest,{params}:{params:Promise<{slug:string;id:string}>}){
 if(!hotelModuleEnabled())return NextResponse.json({error:"Not found"},{status:404,headers:H});
 const {slug,id}=await params;
 const token=req.nextUrl.searchParams.get("t");
 const hotel=await db.hotel.findUnique({where:{slug},select:{id:true}});
 if(!hotel)return NextResponse.json({error:"Not found"},{status:404,headers:H});
 const record=await db.hotelGuestRequest.findUnique({
  where:{clientRequestId:id},
  select:{hotelId:true,trackingTokenHash:true,orders:{select:{id:true,department:true,status:true,updatedAt:true}}},
 });
 if(!record||record.hotelId!==hotel.id||!verifyHotelTrackingToken(token,record.trackingTokenHash))
 return NextResponse.json({error:"Not found"},{status:404,headers:H});
 return NextResponse.json({orders:record.orders.map(o=>({...o,updatedAt:o.updatedAt.toISOString()}))},{headers:H});
}
