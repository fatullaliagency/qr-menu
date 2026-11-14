import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { validateHotelTestDatabaseConfig } from "../app/lib/hotel-test-db-preflight.ts";

const check=validateHotelTestDatabaseConfig({
 databaseUrl:process.env.DATABASE_URL,
 restaurantStagingUrl:process.env.RESTAURANT_STAGING_DATABASE_URL,
 productionUrl:process.env.PRODUCTION_DATABASE_URL,
 approval:process.env.HOTEL_TEST_DB_APPROVAL
});
if(!check.ok){
 console.error("Hotel test database preflight DENIED: "+check.reason);
 process.exit(1);
}
// Do not log connection strings, database credentials, IP addresses or query results.
const db=new PrismaClient();
try{
 const tables=await db.$queryRaw`SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE'`;
 if(!Array.isArray(tables)||tables.length!==0){
  console.error("Hotel test database preflight DENIED: database already contains tables. No migration was run.");
  process.exitCode=1;
 }else{
  console.log("Fresh isolated hotel test database preflight PASS. Starting tracked Prisma migrations.");
  await db.$disconnect();
  const p=spawnSync(process.platform==="win32"?"npx.cmd":"npx",
   ["prisma","migrate","deploy"],{stdio:"inherit",shell:process.platform==="win32"});
  if(p.error||p.status!==0){console.error("Hotel test database migrations did not complete.");process.exitCode=1;}
  else console.log("Dedicated hotel test database migrations completed.");
 }
}catch{
 console.error("Hotel test database preflight DENIED: cannot verify an empty database.");
 process.exitCode=1;
}finally{await db.$disconnect().catch(()=>{});}
