import test from "node:test";
import assert from "node:assert/strict";
import {isHotelRequestUUIDv4,isMatchingHotelRequest} from "../app/lib/hotel-guest-idempotency.ts";
test("hotel client request ID must be an unpredictable UUIDv4",()=>{
 assert.equal(isHotelRequestUUIDv4("f876b66b-4e27-4db7-8fd1-c22c3aacc351"),true);
 assert.equal(isHotelRequestUUIDv4("f876b66b-4e27-1db7-8fd1-c22c3aacc351"),false);
 assert.equal(isHotelRequestUUIDv4("../../../etc"),false);
});
test("retry only restores the identical guest request, not a different cart or note",()=>{
 const stored={hotelId:"h1",roomId:"r1",orders:[
  {note:"hot",items:[{serviceId:"abcdefghij",quantity:2}]},
  {note:"hot",items:[{serviceId:"klmnopqrst",quantity:1}]},
 ]};
 const lines=[{serviceId:"klmnopqrst",quantity:1},{serviceId:"abcdefghij",quantity:2}];
 assert.equal(isMatchingHotelRequest(stored,"h1","r1","hot",lines),true);
 assert.equal(isMatchingHotelRequest(stored,"h2","r1","hot",lines),false);
 assert.equal(isMatchingHotelRequest(stored,"h1","r2","hot",lines),false);
 assert.equal(isMatchingHotelRequest(stored,"h1","r1","cold",lines),false);
 assert.equal(isMatchingHotelRequest(stored,"h1","r1","hot",[{serviceId:"abcdefghij",quantity:1},{serviceId:"klmnopqrst",quantity:1}]),false);
 assert.equal(isMatchingHotelRequest({...stored,orders:[{...stored.orders[0],items:[{serviceId:"abcdefghij",quantity:2},{serviceId:"abcdefghij",quantity:2}]}]},"h1","r1","hot",lines),false);
});
