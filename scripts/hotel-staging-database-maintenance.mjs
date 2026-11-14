/**
 * One-off hotel PREVIEW deployment build maintenance.
 * Called only through an explicitly reviewed Vercel build command.
 * No HTTP route, passwords or hostnames are ever printed.
 */
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";

const ALLOWED_PROJECT = "prj_2AX2rvep2HL0X0hqjKZDuurYHHLy";
const ALLOWED_BRANCH = "feature/hotel-module-v1";
const action = process.env.HOTEL_DB_SETUP_ACTION;
const approval = "INITIALIZE_ISOLATED_HOTEL_TEST";
function deny(reason){
  console.error("HOTEL_DB_SETUP_DENIED: "+reason);
  process.exit(1);
}
if(!["inspect","initialize"].includes(action))deny("No valid maintenance action");
if(process.env.VERCEL_ENV!=="preview")deny("Only Vercel preview builds are permitted");
if(process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID!==ALLOWED_PROJECT)
  deny("Project ID is not the isolated hotel staging project");
if(process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_REF!==ALLOWED_BRANCH)
  deny("Unapproved Git branch");
if(process.env.ENABLE_HOTEL_MODULE==="true"||process.env.ENABLE_WEB_ORDERS==="true")
  deny("Hotel runtime and restaurant orders must remain disabled during DB setup");
if(action==="initialize" && process.env.HOTEL_TEST_DB_APPROVAL!==approval)
  deny("Explicit one-time hotel DB initialization approval required");

const raw=process.env.DATABASE_URL;
if(!raw)deny("No DATABASE_URL provided");
let u;
try{u=new URL(raw);}catch{deny("Invalid DATABASE_URL");}
if(!["postgres:","postgresql:"].includes(u.protocol)||!u.hostname||!u.pathname.slice(1))
  deny("Invalid PostgreSQL URL");
const db=new PrismaClient({log:[]});
let done=false;
try {
  const rows=await db.$queryRaw`
   SELECT current_database() AS db_name,
      current_schema() AS schema_name,
      (SELECT COUNT(*)::integer FROM information_schema.tables
       WHERE table_type='BASE TABLE'
         AND table_schema NOT IN ('pg_catalog','information_schema')) AS table_count
  `;
  const info=rows[0];
  if(!info||typeof info.db_name!=="string"||!Number.isInteger(info.table_count))
    deny("Unable to verify PostgreSQL metadata");
  if(!["qr_menu_hotel_staging","postgres"].includes(info.db_name))
    deny("Database identity differs from approved hotel test store");
  if(info.schema_name!=="public")deny("Only the public schema is permitted");
  console.log("HOTEL_DB_"+action.toUpperCase()+"_PASS: database="+info.db_name+
    ", schema="+info.schema_name+", user_table_count="+info.table_count);
  if(action==="inspect"){done=true;}
  if(action==="initialize"){
    if(info.table_count!==0)deny("Database contains tables; migrations not attempted");
    await db.$disconnect();
    const result=spawnSync(process.platform==="win32"?"npx.cmd":"npx",
      ["prisma","migrate","deploy"],{stdio:"inherit",shell:process.platform==="win32"});
    if(result.error||result.status!==0)deny("Tracked Prisma migration failed");
    const verifyDb=new PrismaClient({log:[]});
    try{
      const verified=await verifyDb.$queryRaw`
        SELECT COUNT(*)::integer AS count FROM information_schema.tables
        WHERE table_schema='public' AND table_name IN
         ('Hotel','HotelRoom','HotelRoomStatusEvent','HotelService',
          'HotelOrder','HotelGuestRequest','Restaurant','_prisma_migrations')
      `;
      if(verified[0]?.count!==8)deny("Required hotel and Prisma tables missing after migration");
      console.log("HOTEL_DB_MIGRATION_SUCCESS: verified 8 required tables");
      done=true;
    }finally{await verifyDb.$disconnect();}
  }
}catch{
  console.error("HOTEL_DB_SETUP_FAILED: database connection, permission or schema check failed");
  process.exitCode=1;
}finally{
  await db.$disconnect().catch(()=>{});
}
if(!done)process.exitCode=1;
