/**
 * Explicitly limited to initializing a brand-new, dedicated hotel TEST database.
 * The caller must still verify ownership/isolation externally before using credentials.
 */
const ALLOWED_NAMES = new Set(["qr_menu_hotel_staging","qr_hotel_staging","qr_hotel_test","hotel_test"]);
function endpoint(url: string): { name: string; identity: string } | null {
 try {
  const u=new URL(url);
  if (!["postgresql:","postgres:"].includes(u.protocol))return null;
  const name=decodeURIComponent(u.pathname.slice(1));
  if(!u.hostname||!name||u.pathname.indexOf("/",1)!==-1)return null;
  return {
   name,
   identity:u.hostname.toLowerCase()+":"+(u.port||"5432")+"/"+name+"?schema="+(u.searchParams.get("schema")||"public")
  };
 }catch{return null;}
}
export function validateHotelTestDatabaseConfig(data:{
 databaseUrl?: string; restaurantStagingUrl?: string; productionUrl?: string;
 approval?: string;
}): {ok:boolean;reason:string} {
 if(data.approval!=="INITIALIZE_ISOLATED_HOTEL_TEST")return {ok:false,reason:"Explicit test-only approval required."};
 const target=endpoint(data.databaseUrl||"");
 if(!target)return {ok:false,reason:"PostgreSQL DATABASE_URL is missing or malformed."};
 if(!ALLOWED_NAMES.has(target.name))return {ok:false,reason:"Database must have a dedicated hotel TEST name."};
 for(const reference of [data.restaurantStagingUrl,data.productionUrl]){
  if(!reference)continue;
  const existing=endpoint(reference);
  if(existing?.identity===target.identity)return {ok:false,reason:"Hotel database matches a restaurant database."};
 }
 return {ok:true,reason:"Dedicated-name and approval checks passed; inspect database emptiness before migration."};
}
