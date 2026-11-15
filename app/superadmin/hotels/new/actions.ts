"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {db} from "@/app/lib/db";
import {hasSuperAdminSession} from "@/app/lib/superadmin-auth";
import {hashRestaurantPin} from "@/app/lib/pin-security";
import {createWithHotelSlug} from "@/app/lib/hotel-slug";
import {hotelModuleEnabled} from "@/app/lib/hotel-validation";
function field(data:FormData,name:string):string{return typeof data.get(name)==="string"?String(data.get(name)).trim():"";}
export async function createSuperAdminHotel(data:FormData):Promise<void>{
 if(!hotelModuleEnabled()||!(await hasSuperAdminSession()))redirect("/superadmin");
 const name=field(data,"name"),branchName=field(data,"branchName"),
  phone=field(data,"phone"),email=field(data,"email"),address=field(data,"address"),
  pin=field(data,"pin"),countRaw=field(data,"roomCount");
 const roomCount=Number(countRaw);
 const foodEnabled=data.get("foodEnabled")==="on";
 const roomServiceEnabled=data.get("roomServiceEnabled")==="on";
 const extraEnabled=data.get("extraEnabled")==="on";
 const transferEnabled=data.get("transferEnabled")==="on";
 const spaEnabled=data.get("spaEnabled")==="on";
 if(name.length<2||name.length>120||branchName.length>120||
    phone.length<6||phone.length>30||!/^[+0-9() -]+$/.test(phone)||
    email.length>200||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||
    address.length>300||!/^[0-9]{6,12}$/.test(pin)||
    !Number.isInteger(roomCount)||roomCount<1||roomCount>500||
    (!foodEnabled&&!roomServiceEnabled&&!extraEnabled&&!transferEnabled&&!spaEnabled)){
  redirect("/superadmin/hotels/new?error=validation");
 }
 const pinHash=await hashRestaurantPin(pin);
 const slug=await createWithHotelSlug(name,async slug=>{
   await db.hotel.create({data:{
    name,slug,branchName:branchName||null,phone,email:email||null,address:address||null,
    roomCount,pinCode:pinHash,foodEnabled,roomServiceEnabled,extraEnabled,transferEnabled,spaEnabled,
    rooms:{create:Array.from({length:roomCount},(_,i)=>({number:String(i+1)}))},
   }});
 });
 revalidatePath("/superadmin");
 redirect("/superadmin/hotels/new?created="+encodeURIComponent(slug));
}
