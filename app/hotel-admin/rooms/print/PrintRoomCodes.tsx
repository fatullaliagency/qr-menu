"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Room={number:string;token:string;status:"VACANT"|"OCCUPIED"|"OUT_OF_SERVICE"};
export default function PrintRoomCodes({hotelName,slug,page,rooms}:{
 hotelName:string;slug:string;page:number;rooms:Room[];
}){
 const [qrImages,setQrImages]=useState<string[]>([]);
 const [error,setError]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  setQrImages([]);setError(false);
  void Promise.all(rooms.map(room=>{
   const url=window.location.origin+"/hotel/"+encodeURIComponent(slug)
    +"/room/"+encodeURIComponent(room.number)+"?t="+encodeURIComponent(room.token);
   // The bearer-token QR never leaves the manager's browser.
   return QRCode.toDataURL(url,{errorCorrectionLevel:"M",margin:3,width:480});
  })).then(images=>{if(!cancelled)setQrImages(images);})
   .catch(()=>{if(!cancelled)setError(true);});
  return ()=>{cancelled=true;};
 },[rooms,slug]);
 const ready=qrImages.length===rooms.length && !error;
 return <>
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 print:hidden">
   <p role="status" className="text-sm">
    {error?"QR-lər hazırlanmadı. Səhifəni yeniləyin.":ready?"Bu səhifədəki QR-lər çapa hazırdır.":"QR-lər hazırlanır..."}
   </p>
   <button type="button" disabled={!ready} onClick={()=>window.print()}
    className="rounded-lg bg-emerald-800 px-5 py-2.5 font-bold text-white disabled:opacity-50">Bu səhifəni çap et</button>
  </div>
  <div className="mb-3 hidden text-center print:block">
   <h1 className="text-xl font-bold">{hotelName} · Otaq QR kodları</h1>
   <p className="text-sm">QR çap vərəqi {page}. Yalnız otel daxilində istifadə üçün.</p>
  </div>
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
   {rooms.map((room,i)=><article key={room.number} data-print-room={room.number}
     className="break-inside-avoid rounded-xl border border-zinc-300 bg-white p-4 text-center print:rounded-none print:border-zinc-400 print:p-3">
    <h2 className="text-lg font-bold">Otaq № {room.number}</h2>
    {qrImages[i]?<img src={qrImages[i]} width={200} height={200}
      alt={"Otaq "+room.number+" QR kodu"} className="mx-auto my-2 aspect-square w-full max-w-44 object-contain print:max-w-40"/>:
     <div aria-label="QR hazırlanır" className="mx-auto my-2 aspect-square max-w-44 rounded-lg bg-zinc-100"/>}
    <p className="text-xs font-medium text-zinc-700">Xidmətlər üçün kameranızla skan edin</p>
    <p className="mt-2 text-xs text-zinc-500 print:hidden">
      {room.status==="VACANT"?"Boş":room.status==="OCCUPIED"?"Dolu":"Xidmətdən kənar"}
    </p>
   </article>)}
  </div>
  {rooms.length===0&&<p className="rounded-xl bg-white p-5 text-sm">Bu oteldə otaq mövcud deyil.</p>}
 </>;
}
