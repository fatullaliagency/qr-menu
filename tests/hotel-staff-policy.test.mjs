import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHotelStaffUsername, canStaffAccessHotelDepartment } from "../app/lib/hotel-staff-policy.ts";
test("staff usernames are strictly normalized and scoped to an assigned hotel", () => {
 assert.equal(normalizeHotelStaffUsername("  CHEF.01 "), "chef.01");
 assert.equal(normalizeHotelStaffUsername("ab"), null);
 assert.equal(normalizeHotelStaffUsername("../chef"), null);
 assert.equal(normalizeHotelStaffUsername("hər kəs"), null);
 assert.equal(normalizeHotelStaffUsername(["chef"]), null);
});
test("department authorization is restrictive", () => {
 for (const role of ["KITCHEN", "HOUSEKEEPING", "RECEPTION"]) {
  for (const other of ["KITCHEN", "HOUSEKEEPING", "RECEPTION"]) {
   assert.equal(canStaffAccessHotelDepartment(role,other),role===other);
  }
 }
});
