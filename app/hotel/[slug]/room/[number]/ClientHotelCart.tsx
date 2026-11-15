"use client";
import {useEffect,useMemo,useState} from "react";
import {useFormStatus} from "react-dom";
import {createHotelGuestRequest} from "./actions";
import {HOTEL_CATEGORIES,type HotelCategory} from "@/app/lib/hotel-validation";
import {
 hotelGuestText,hotelGuestCategoryLabel,hotelGuestServiceLabel,
 hotelGuestPrice,hotelGuestAznPrice,type HotelGuestLang
} from "@/app/lib/hotel-guest-i18n";
type Service={
 id:string;name:string;nameEn:string|null;nameRu:string|null;
 description:string|null;descriptionEn:string|null;descriptionRu:string|null;
 category:HotelCategory;price:string;
};
function OrderButton({enabled,lang}:{enabled:boolean;lang:HotelGuestLang}){
 const {pending}=useFormStatus(),copy=hotelGuestText[lang];
 return <button type="submit" disabled={pending||!enabled}
   className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">
   {pending?copy.pending:copy.submit}
 </button>;
}
export default function ClientHotelCart({slug,roomNumber,token,lang,services}:{
 slug:string;roomNumber:string;token:string;lang:HotelGuestLang;services:Service[];
}){
 const [quantity,setQuantity]=useState<Record<string,number>>({});
 const [requestId,setRequestId]=useState("");
 const [note,setNote]=useState("");
 const copy=hotelGuestText[lang];
 useEffect(()=>{setRequestId(crypto.randomUUID());},[]);
 const selected=useMemo(()=>services.filter(s=>(quantity[s.id]??0)>0)
  .map(s=>({serviceId:s.id,quantity:quantity[s.id]})),[services,quantity]);
 const total=services.reduce((sum,s)=>sum+(quantity[s.id]??0)*Number(s.price),0);
 return <form action={createHotelGuestRequest} className="space-y-5">
   <input type="hidden" name="slug" value={slug}/>
   <input type="hidden" name="roomNumber" value={roomNumber}/>
   <input type="hidden" name="roomToken" value={token}/>
   <input type="hidden" name="requestId" value={requestId}/>
   <input type="hidden" name="lang" value={lang}/>
   <input type="hidden" name="items" value={JSON.stringify(selected)}/>
   {HOTEL_CATEGORIES.map(category=><section key={category} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">{hotelGuestCategoryLabel(lang,category)}</h2>
     {services.filter(s=>s.category===category).length===0
       ?<p className="text-sm text-zinc-500">{copy.empty}</p>
       :services.filter(s=>s.category===category).map(s=>{
         const translated=hotelGuestServiceLabel(s,lang);
         const azn=Number(s.price);
         return <div key={s.id} className="flex items-center justify-between gap-3 border-t border-zinc-100 py-3">
          <div className="min-w-0">
           <h3 className="font-semibold">{translated.name}</h3>
           {translated.description&&<p className="text-sm text-zinc-500">{translated.description}</p>}
           {!translated.translated&&<p className="text-xs text-amber-800">{copy.notTranslated}</p>}
           <p className="text-sm font-bold text-emerald-800">{hotelGuestPrice(azn,lang)}</p>
           {lang!=="az"&&<p className="text-xs text-zinc-500">{copy.originalPrice} {hotelGuestAznPrice(azn)}</p>}
          </div>
          <label className="shrink-0 text-xs font-medium">
           {copy.quantity}
           <input type="number" min={0} max={20} step={1} value={quantity[s.id]??0}
             onChange={e=>{
               const n=Number(e.target.value);
               setQuantity(prev=>({...prev,[s.id]:Number.isSafeInteger(n)?Math.max(0,Math.min(20,n)):0}));
             }}
             className="mt-1 block w-20 rounded-lg border border-zinc-300 p-2 text-center text-base"/>
          </label>
         </div>;
       })}
   </section>)}
   <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">{copy.cart}</h2>
     {selected.length===0?<p className="text-sm text-zinc-500">{copy.emptyCart}</p>
      :selected.map(line=><p key={line.serviceId} className="text-sm">
        {hotelGuestServiceLabel(services.find(s=>s.id===line.serviceId)!,lang).name} × {line.quantity}
      </p>)}
     <p className="text-xl font-bold">{copy.total}: {hotelGuestPrice(total,lang)}</p>
     {lang!=="az"&&<p className="text-sm font-medium text-zinc-800">{copy.originalPrice} {hotelGuestAznPrice(total)}</p>}
     {lang!=="az"&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{copy.exchangeNote}</p>}
     <label className="block text-sm font-medium">{copy.notes}
       <textarea name="note" value={note} onChange={e=>setNote(e.target.value)} maxLength={500}
         rows={3} className="mt-1 block w-full rounded-lg border border-zinc-300 p-3"/>
     </label>
     <p className="text-xs text-amber-900">{copy.currencyNote}</p>
     <OrderButton enabled={selected.length>0&&Boolean(requestId)} lang={lang}/>
   </section>
 </form>;
}
