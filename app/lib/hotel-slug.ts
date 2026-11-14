import {restaurantSlugFromName} from "@/app/lib/restaurant-slug";
export function hotelSlugFromName(name:string,attempt=1):string {
 const base=restaurantSlugFromName(name,1).replace(/-restoran$/,"-otel");
 const suffix=attempt===1?"":"-"+attempt;
 return base.slice(0,60-suffix.length).replace(/-+$/,"")+suffix;
}
export async function createWithHotelSlug(name:string,save:(slug:string)=>Promise<unknown>):Promise<string>{
 for(let attempt=1;attempt<=100;attempt++){
  const slug=hotelSlugFromName(name,attempt);
  try{await save(slug);return slug;}
  catch(error){
   if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="P2002"){
    const meta="meta" in error?error.meta:undefined;
    if(meta&&typeof meta==="object"&&"target" in meta &&
      !(String(meta.target).includes("slug")))throw error;
    continue;
   }
   throw error;
  }
 }
 throw new Error("Unikal otel URL adı yaradıla bilmədi.");
}
