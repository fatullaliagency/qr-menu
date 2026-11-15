import test from "node:test";
import assert from "node:assert/strict";
import {canApproveHotelRoomCharge,canVoidHotelRoomCharge} from "../app/lib/hotel-billing-policy.ts";
test("pending room folio is manager approvable only after order completion",()=>{
 for(const status of ["NEW","ACCEPTED","PREPARING","DISPATCHED"])
  assert.equal(canApproveHotelRoomCharge(status,"PENDING"),false);
 assert.equal(canApproveHotelRoomCharge("COMPLETED","PENDING"),true);
 assert.equal(canApproveHotelRoomCharge("COMPLETED","APPROVED"),false);
 assert.equal(canApproveHotelRoomCharge("COMPLETED","VOID"),false);
 assert.equal(canVoidHotelRoomCharge("PENDING"),true);
 assert.equal(canVoidHotelRoomCharge("APPROVED"),false);
 assert.equal(canVoidHotelRoomCharge("VOID"),false);
});
