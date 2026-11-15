/** Keep Secure cookies enabled except in the exact disposable HTTP localhost CI fixture.
 * Never use test flags alone to downgrade a remotely hosted session cookie.
 */
export function hotelSecureCookie(runtime:{
 nodeEnv?:string;ephemeralDbTest?:string;databaseUrl?:string;
}):boolean{
 const ciLocal=runtime.ephemeralDbTest==="true" &&
  runtime.databaseUrl==="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
 return runtime.nodeEnv==="production"&&!ciLocal;
}
export function hotelRuntimeSecureCookie():boolean{
 return hotelSecureCookie({
  nodeEnv:process.env.NODE_ENV,
  ephemeralDbTest:process.env.QR_MENU_EPHEMERAL_DB_TEST,
  databaseUrl:process.env.DATABASE_URL
 });
}
