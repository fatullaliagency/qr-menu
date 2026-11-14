"use client";
import {useEffect,useState,useRef} from "react";
import {hotelStatusLabels,hotelDepartmentLabels,HotelStatusName,HotelDepartmentName} from "@/app/lib/hotel-validation";
type Row={id:string;department:HotelDepartmentName;status:HotelStatusName;updatedAt:string};
export default function LiveHotelStatus({token,initial}:{token:string;initial:Row[]}){
 const [orders,setOrders]=useState(initial);
 const [changed,setChanged]=useState(false);
 const [message,setMessage]=useState("");
 const previous=useRef(initial);
 const notifications=useRef(false);
 const [alertsEnabled,setAlertsEnabled]=useState(false);
 useEffect(()=>{
 let stopped=false;
 const poll=async()=>{
  try{
   const response=await fetch(window.location.pathname+"/status?t="+encodeURIComponent(token),{cache:"no-store"});
   if(!response.ok)throw new Error();
   const json=(await response.json()) as {orders:Row[]};
   if(stopped || !Array.isArray(json.orders))return;
   const updated=previous.current.some(p=>json.orders.some(n=>n.id===p.id&&n.status!==p.status));
   if(updated){
    setChanged(true);
    setMessage("Sifarişinizin statusu yeniləndi.");
    if(notifications.current && "Notification" in window && Notification.permission==="granted"){
     try{new Notification("Otel sifarişinin statusu yeniləndi",{
      body:"Sifarişinizin vəziyyətini izləmə səhifəsində görə bilərsiniz.",
      tag:"hotel-order-status"
     });}catch{}
    }
   }
   previous.current=json.orders;
   setOrders(json.orders);
  }catch{if(!stopped)setMessage("Yenilənmə müvəqqəti əlçatan deyil. Səhifəni yeniləyə bilərsiniz.");}
 };
 const interval=window.setInterval(()=>void poll(),12000);
 return ()=>{stopped=true;window.clearInterval(interval);};
 },[token]);
 const toggleAlerts=async()=>{
  if(notifications.current){notifications.current=false;setAlertsEnabled(false);return;}
  if(!("Notification" in window)) {setMessage("Bu brauzerdə sistem bildirişi mövcud deyil.");return;}
  try{
   const permission=Notification.permission==="default"?await Notification.requestPermission():Notification.permission;
   if(permission!=="granted"){setMessage("Bildiriş icazəsi verilməyib.");return;}
   notifications.current=true;setAlertsEnabled(true);
  }catch{setMessage("Bildiriş icazəsi açıla bilmədi.");}
 };
 return <section className="space-y-3 rounded-xl bg-white p-5" aria-live="polite">
  <h2 className="text-lg font-bold">Cari status</h2>
  <button type="button" onClick={()=>void toggleAlerts()}
    className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium">
    {alertsEnabled?"Brauzer bildirişini söndür":"Status üçün brauzer bildirişini aktivləşdir"}
  </button>
  {changed&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{message}</p>}
  {!changed&&message&&<p className="text-sm text-zinc-500">{message}</p>}
  {orders.map(o=><div key={o.id} className="rounded-lg border border-zinc-200 p-3">
   <p className="font-semibold">{hotelDepartmentLabels[o.department]}: {hotelStatusLabels[o.status]}</p>
   <p className="text-xs text-zinc-500">{new Date(o.updatedAt).toLocaleString("az-AZ")}</p>
  </div>)}
  <p className="text-xs text-zinc-500">Status hər 12 saniyədən bir yenilənir. Brauzer bağlı olanda push göndərilmir. Linki başqalarına göndərməyin.</p>
 </section>;
}
