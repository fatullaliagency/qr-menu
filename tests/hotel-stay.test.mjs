import test from "node:test";
import assert from "node:assert/strict";
import {hotelRoomStayKey,shouldRotateHotelRoomToken} from "../app/lib/hotel-stay.ts";
test("stay keys are scoped by hotel, room and nonce",()=>{
 const k=hotelRoomStayKey("hotel-A","101","nonce1");
 assert.equal(k.length,20);
 assert.match(k,/^[0-9a-f]{20}$/);
 assert.equal(k,hotelRoomStayKey("hotel-A","101","nonce1"));
 assert.notEqual(k,hotelRoomStayKey("hotel-A","101","nonce2"));
 assert.notEqual(k,hotelRoomStayKey("hotel-A","102","nonce1"));
 assert.notEqual(k,hotelRoomStayKey("hotel-B","101","nonce1"));
});
test("leaving occupied state and vacating inactive rooms revoke QR",()=>{
 assert.equal(shouldRotateHotelRoomToken("OCCUPIED","VACANT"),true);
 assert.equal(shouldRotateHotelRoomToken("OCCUPIED","OUT_OF_SERVICE"),true);
 assert.equal(shouldRotateHotelRoomToken("OUT_OF_SERVICE","VACANT"),true);
 assert.equal(shouldRotateHotelRoomToken("VACANT","OCCUPIED"),false);
 assert.equal(shouldRotateHotelRoomToken("OCCUPIED","OCCUPIED"),false);
});
