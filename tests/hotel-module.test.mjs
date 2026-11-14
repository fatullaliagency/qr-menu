import test from "node:test";
import assert from "node:assert/strict";
import { hotelRoomToken, verifyHotelRoomToken, generateHotelTrackingToken, hashHotelTrackingToken, verifyHotelTrackingToken } from "../app/lib/hotel-security.ts";
import {parseHotelCart, hotelCategoryDepartment, hotelNextStatus, validHotelRoomNumber} from "../app/lib/hotel-validation.ts";
test("each hotel room has its own QR bearer token, rotating nonce invalidates old QR",()=>{
 const secret="a".repeat(40);
 const a=hotelRoomToken(secret,"hotel-a","room-a","stay1");
 const b=hotelRoomToken(secret,"hotel-a","room-b","stay1");
 assert.notEqual(a,b);
 assert.equal(verifyHotelRoomToken(secret,"hotel-a","room-a","stay1",a),true);
 assert.equal(verifyHotelRoomToken(secret,"hotel-b","room-a","stay1",a),false);
 assert.equal(verifyHotelRoomToken(secret,"hotel-a","room-a","stay2",a),false);
 assert.equal(verifyHotelRoomToken(secret,"hotel-a","room-a","stay1","x"),false);
});
test("tracking URL requires secret and hashes are not plaintext",()=>{
 const token=generateHotelTrackingToken(), hashed=hashHotelTrackingToken(token);
 assert.equal(token.length,32);
 assert.notEqual(hashed,token);
 assert.equal(verifyHotelTrackingToken(token,hashed),true);
 assert.equal(verifyHotelTrackingToken(generateHotelTrackingToken(),hashed),false);
});
test("cart is bounded, unique and department-specific",()=>{
 assert.deepEqual(parseHotelCart('[{"serviceId":"abcdefghij","quantity":2}]'),[{serviceId:"abcdefghij",quantity:2}]);
 assert.equal(parseHotelCart('[{"serviceId":"abcdefghij","quantity":1},{"serviceId":"abcdefghij","quantity":2}]'),null);
 assert.equal(parseHotelCart('[{"serviceId":"abcdefghij","quantity":0}]'),null);
 assert.equal(parseHotelCart('[]'),null);
 assert.equal(hotelCategoryDepartment("FOOD"),"KITCHEN");
 assert.equal(hotelCategoryDepartment("ROOM_SERVICE"),"HOUSEKEEPING");
 assert.equal(hotelCategoryDepartment("EXTRA"),"RECEPTION");
 assert.equal(hotelCategoryDepartment("TRANSFER"),"TRANSFER");
 assert.equal(hotelCategoryDepartment("SPA"),"SPA");
 assert.equal(hotelNextStatus("NEW"),"ACCEPTED");
 assert.equal(hotelNextStatus("DISPATCHED"),"COMPLETED");
 assert.equal(hotelNextStatus("COMPLETED"),null);
 assert.equal(validHotelRoomNumber("012A"),true);
 assert.equal(validHotelRoomNumber("../12"),false);
});
