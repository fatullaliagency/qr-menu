import test from "node:test";
import assert from "node:assert/strict";
import {hotelSecureCookie} from "../app/lib/hotel-cookie-policy.ts";
const local="postgresql://postgres:postgres@127.0.0.1:5432/qr_hotel_ci";
test("secure cookies stay required on real production deployments",()=>{
 assert.equal(hotelSecureCookie({nodeEnv:"production"}),true);
 assert.equal(hotelSecureCookie({nodeEnv:"production",ephemeralDbTest:"true"}),true);
 assert.equal(hotelSecureCookie({
  nodeEnv:"production",ephemeralDbTest:"true",databaseUrl:"postgresql://u:p@db.example.com/qr_hotel_ci"
 }),true);
 assert.equal(hotelSecureCookie({nodeEnv:"production",ephemeralDbTest:"false",databaseUrl:local}),true);
});
test("WebKit's local HTTP CI can use its strictly isolated disposable fixture",()=>{
 assert.equal(hotelSecureCookie({nodeEnv:"production",ephemeralDbTest:"true",databaseUrl:local}),false);
 assert.equal(hotelSecureCookie({nodeEnv:"development",ephemeralDbTest:"false"}),false);
});
