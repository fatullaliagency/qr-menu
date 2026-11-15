import "server-only";
import {createHmac, timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {connection} from "next/server";
import {hotelRuntimeSecureCookie} from "@/app/lib/hotel-cookie-policy";

const COOKIE="qr_hotel_session";
const TTL_SECONDS=60*60*8;
type HotelSession={hotelId:string;expiresAt:number};
export function getHotelSecret(): string {
 const s=process.env.ADMIN_SESSION_SECRET;
 if(!s || s.length<32) throw new Error("Hotel session secret is not configured.");
 return s;
}
function sign(payload:string):Buffer {
 return createHmac("sha256",getHotelSecret()).update("hotel-session:v1:"+payload).digest();
}
export async function createHotelSession(hotelId:string):Promise<void> {
 if(!hotelId) throw new Error("Hotel ID is missing.");
 const session:HotelSession={hotelId,expiresAt:Date.now()+TTL_SECONDS*1000};
 const payload=Buffer.from(JSON.stringify(session)).toString("base64url");
 (await cookies()).set(COOKIE,payload+"."+sign(payload).toString("hex"),{
  httpOnly:true,secure:hotelRuntimeSecureCookie(),sameSite:"lax",
  path:"/hotel-admin",maxAge:TTL_SECONDS,
 });
}
export async function getHotelSession():Promise<HotelSession|null> {
 await connection();
 const value=(await cookies()).get(COOKIE)?.value;
 if(!value)return null;
 const parts=value.split(".");
 if(parts.length!==2|| !/^[a-f0-9]{64}$/.test(parts[1]))return null;
 const expected=sign(parts[0]);
 if(!timingSafeEqual(expected,Buffer.from(parts[1],"hex")))return null;
 try {
 const data=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as Partial<HotelSession>;
 if(typeof data.hotelId!=="string" || !data.hotelId ||
 typeof data.expiresAt!=="number"|| data.expiresAt<=Date.now())return null;
 return {hotelId:data.hotelId,expiresAt:data.expiresAt};
 } catch { return null; }
}
export async function deleteHotelSession():Promise<void>{
 (await cookies()).set(COOKIE,"",{httpOnly:true,secure:hotelRuntimeSecureCookie(),sameSite:"lax",path:"/hotel-admin",maxAge:0});
}
