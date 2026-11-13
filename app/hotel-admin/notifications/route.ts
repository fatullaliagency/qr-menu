import {NextRequest,NextResponse} from "next/server";
import {getHotelSession} from "@/app/lib/hotel-auth";
import {hotelModuleEnabled,isHotelDepartment} from "@/app/lib/hotel-validation";
import {db} from "@/app/lib/db";
const H={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(req:NextRequest){
 if(!hotelModuleEnabled())return NextResponse.json({error:"Not found"},{status:404,headers:H});
 const session=await getHotelSession();
 if(!session)return NextResponse.json({error:"Giriş tələb olunur"},{status:401,headers:H});
 const department=req.nextUrl.searchParams.get("department");
 if(!isHotelDepartment(department))return NextResponse.json({error:"Yanlış şöbə"},{status:400,headers:H});
 const [count,last]=await Promise.all([
  db.hotelOrder.count({where:{hotelId:session.hotelId,department,status:"NEW"}}),
  db.hotelOrder.findFirst({where:{hotelId:session.hotelId,department},
    orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true,createdAt:true}}),
 ]);
 return NextResponse.json({scope:session.hotelId,department,newCount:count,
  latest:last?{id:last.id,createdAt:last.createdAt.toISOString()}:null},{headers:H});
}
