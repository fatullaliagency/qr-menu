"use client";
import {useEffect,useState} from "react";
import {hotelStatusLabels,hotelDepartmentLabels,HotelStatusName,HotelDepartmentName} from "@/app/lib/hotel-validation";
type Row={id:string;department:HotelDepartmentName;status:HotelStatusName;updatedAt:string};
export default function LiveHotelStatus({token,initial}:{token:string;initial:Row[]}){
 const [orders,setOrders]=useState(initial);
 const [changed,setChanged]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
 let stopped=false;
 const poll=async()=>{
  try{
   const response=await fetch(window.location.pathname+"/status?t="+encodeURIComponent(token),{cache:"no-store"});
   if(!response.ok)throw new Error();
   const json=(await response.json()) as {orders:Row[]};
   if(stopped || !Array.isArray(json.orders))return;
   setOrders(prev=>{
     if(prev.some(p=>json.orders.some(n=>n.id===p.id&&n.status!==p.status))){
       setChanged(true);setMessage("Sifarişinizin statusu yeniləndi.");
     }
     return json.orders;
   });
  }catch{if(!stopped)setMessage("Yenilənmə müvəqqəti əlçatan deyil. Səhifəni yeniləyə bilərsiniz.");}
 };
 const interval=window.setInterval(()=>void poll(),12000);
 return ()=>{stopped=true;window.clearInterval(interval);};
 },[token]);
 return <section className="space-y-3 rounded-xl bg-white p-5" aria-live="polite">
  <h2 className="text-lg font-bold">Cari status</h2>
  {changed&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{message}</p>}
  {!changed&&message&&<p className="text-sm text-zinc-500">{message}</p>}
  {orders.map(o=><div key={o.id} className="rounded-lg border border-zinc-200 p-3">
   <p className="font-semibold">{hotelDepartmentLabels[o.department]}: {hotelStatusLabels[o.status]}</p>
   <p className="text-xs text-zinc-500">{new Date(o.updatedAt).toLocaleString("az-AZ")}</p>
  </div>)}
  <p className="text-xs text-zinc-500">Status hər 12 saniyədən bir yenilənir. Linki başqalarına göndərməyin.</p>
 </section>;
}
