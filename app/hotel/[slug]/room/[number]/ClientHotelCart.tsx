"use client";
import {useEffect,useMemo,useState} from "react";
import {useFormStatus} from "react-dom";
import {createHotelGuestRequest} from "./actions";
import {hotelCategoryLabels,HOTEL_CATEGORIES,type HotelCategory} from "@/app/lib/hotel-validation";
type Service={id:string;name:string;description:string|null;category:HotelCategory;price:string};
const categories=HOTEL_CATEGORIES;
function OrderButton({enabled}:{enabled:boolean}){
 const {pending}=useFormStatus();
 return <button type="submit" disabled={pending||!enabled}
   className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">
   {pending?"Sifariş qeydə alınır...":"Otaq hesabına sifariş göndər"}
 </button>;
}
export default function ClientHotelCart({slug,roomNumber,token,services}:{
 slug:string;roomNumber:string;token:string;services:Service[];
}){
 const [quantity,setQuantity]=useState<Record<string,number>>({});
 const [requestId,setRequestId]=useState("");
 const [note,setNote]=useState("");
 useEffect(()=>{setRequestId(crypto.randomUUID());},[]);
 const selected=useMemo(()=>services.filter(s=>(quantity[s.id]??0)>0)
  .map(s=>({serviceId:s.id,quantity:quantity[s.id]})),[services,quantity]);
 const total=services.reduce((sum,s)=>sum+(quantity[s.id]??0)*Number(s.price),0);
 return <form action={createHotelGuestRequest} className="space-y-5">
   <input type="hidden" name="slug" value={slug}/>
   <input type="hidden" name="roomNumber" value={roomNumber}/>
   <input type="hidden" name="roomToken" value={token}/>
   <input type="hidden" name="requestId" value={requestId}/>
   <input type="hidden" name="items" value={JSON.stringify(selected)}/>
   {categories.map(category=><section key={category} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">{hotelCategoryLabels[category]}</h2>
     {services.filter(s=>s.category===category).length===0
       ?<p className="text-sm text-zinc-500">Bu bölmədə xidmət yoxdur.</p>
       :services.filter(s=>s.category===category).map(s=><div key={s.id} className="flex items-center justify-between gap-3 border-t border-zinc-100 py-3">
         <div className="min-w-0">
           <h3 className="font-semibold">{s.name}</h3>
           {s.description&&<p className="text-sm text-zinc-500">{s.description}</p>}
           <p className="text-sm font-bold text-emerald-800">{Number(s.price).toFixed(2)} ₼</p>
         </div>
         <label className="shrink-0 text-xs font-medium">
           Say
           <input type="number" min={0} max={20} step={1} value={quantity[s.id]??0}
             onChange={e=>{
               const n=Number(e.target.value);
               setQuantity(prev=>({...prev,[s.id]:Number.isSafeInteger(n)?Math.max(0,Math.min(20,n)):0}));
             }}
             className="mt-1 block w-20 rounded-lg border border-zinc-300 p-2 text-center text-base"/>
         </label>
       </div>)}
   </section>)}
   <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">Səbət</h2>
     {selected.length===0?<p className="text-sm text-zinc-500">Xidmət seçilməyib.</p>
      :selected.map(line=><p key={line.serviceId} className="text-sm">
        {services.find(s=>s.id===line.serviceId)?.name} × {line.quantity}
      </p>)}
     <p className="text-xl font-bold">Cəmi: {total.toFixed(2)} ₼</p>
     <label className="block text-sm font-medium">Qeyd (istəyə bağlı)
       <textarea name="note" value={note} onChange={e=>setNote(e.target.value)} maxLength={500}
         rows={3} className="mt-1 block w-full rounded-lg border border-zinc-300 p-3"/>
     </label>
     <p className="text-xs text-amber-900">“Otaq hesabına yaz” müraciəti otel tərəfindən təsdiqlənməlidir; kartdan və ya bank hesabından avtomatik ödəniş tutulmur.</p>
     <OrderButton enabled={selected.length>0&&Boolean(requestId)}/>
   </section>
 </form>;
}
