"use client";
import {useEffect,useState,useRef} from "react";
import {type HotelStatusName,type HotelDepartmentName} from "@/app/lib/hotel-validation";
import {hotelGuestText,type HotelGuestLang} from "@/app/lib/hotel-guest-i18n";
type Row={id:string;department:HotelDepartmentName;status:HotelStatusName;updatedAt:string};
export default function LiveHotelStatus({token,initial,lang}:{token:string;initial:Row[];lang:HotelGuestLang}){
 const copy=hotelGuestText[lang];
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
    setMessage(copy.updated);
    if(notifications.current && "Notification" in window && Notification.permission==="granted"){
     try{new Notification(copy.notificationTitle,{
      body:copy.notificationBody,
      tag:"hotel-order-status"
     });}catch{}
    }
   }
   previous.current=json.orders;
   setOrders(json.orders);
  }catch{if(!stopped)setMessage(copy.unavailable);}
 };
 const interval=window.setInterval(()=>void poll(),12000);
 return ()=>{stopped=true;window.clearInterval(interval);};
 },[token,lang,copy]);
 const toggleAlerts=async()=>{
  if(notifications.current){notifications.current=false;setAlertsEnabled(false);return;}
  if(!("Notification" in window)) {setMessage(copy.alertsUnsupported);return;}
  try{
   const permission=Notification.permission==="default"?await Notification.requestPermission():Notification.permission;
   if(permission!=="granted"){setMessage(copy.alertsDenied);return;}
   notifications.current=true;setAlertsEnabled(true);
  }catch{setMessage(copy.alertsError);}
 };
 return <section className="space-y-3 rounded-xl bg-white p-5" aria-live="polite">
  <h2 className="text-lg font-bold">{copy.currentStatus}</h2>
  <button type="button" onClick={()=>void toggleAlerts()}
    className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium">
    {alertsEnabled?copy.disableAlerts:copy.enableAlerts}
  </button>
  {changed&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{message}</p>}
  {!changed&&message&&<p className="text-sm text-zinc-500">{message}</p>}
  {orders.map(o=><div key={o.id} className="rounded-lg border border-zinc-200 p-3">
   <p className="font-semibold">{copy.department[o.department]}: {copy.status[o.status]}</p>
   <p className="text-xs text-zinc-500">{new Date(o.updatedAt).toLocaleString(lang==="ru"?"ru-RU":lang==="en"?"en-GB":"az-AZ")}</p>
  </div>)}
  <p className="text-xs text-zinc-500">{copy.statusInfo}</p>
 </section>;
}
