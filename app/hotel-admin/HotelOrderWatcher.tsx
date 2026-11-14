"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import type {HotelDepartmentName} from "@/app/lib/hotel-validation";
type Latest={id:string;createdAt:string};
type Snapshot={scope:string;newCount:number;lastChangedAt:string|null};
export default function HotelOrderWatcher({department}:{department:HotelDepartmentName}){
 const router=useRouter();
 const [count,setCount]=useState<number|null>(null);
 const [alertEnabled,setAlertEnabled]=useState(false);
 const [message,setMessage]=useState("");
 const scope=useRef<string|null>(null),baseline=useRef<Latest|null>(null),started=useRef(false);
 const snapshot=useRef<Snapshot|null>(null);
 const enabled=useRef(false),audio=useRef<AudioContext|null>(null);
 useEffect(()=>{
  let stopped=false;
  let inFlight=false;
  const poll=async()=>{
   if(inFlight||stopped)return;
   inFlight=true;
   try{
    const r=await fetch("/hotel-admin/notifications?department="+department,{cache:"no-store",credentials:"same-origin"});
    if(stopped)return;
    if(r.status===401||r.status===403){
      setCount(null);setMessage("Giriş icazəsi başa çatıb.");
      scope.current=null;baseline.current=null;started.current=false;snapshot.current=null;
      enabled.current=false;setAlertEnabled(false);
      router.replace("/hotel-staff");
      return;
    }
    if(!r.ok)throw new Error();
    const json=await r.json() as Snapshot&{latest:Latest|null};
    if(stopped)return;
    if(scope.current!==null && scope.current!==json.scope){
     started.current=false;baseline.current=null;snapshot.current=null;enabled.current=false;setAlertEnabled(false);
    }
    scope.current=json.scope;
    const prev=baseline.current,latest=json.latest;
    const isNew=started.current && latest &&
     (!prev || new Date(latest.createdAt)>new Date(prev.createdAt));
    if(!started.current || (latest &&(!prev||new Date(latest.createdAt)>new Date(prev.createdAt)))){
      baseline.current=latest;
    }
    started.current=true;
    const previous=snapshot.current;
    const shouldRefresh=Boolean(previous&&previous.scope===json.scope&&
      (previous.newCount!==json.newCount||previous.lastChangedAt!==json.lastChangedAt));
    snapshot.current={scope:json.scope,newCount:json.newCount,lastChangedAt:json.lastChangedAt};
    setCount(json.newCount);
    if(isNew){
      setMessage("Yeni otel müraciəti daxil oldu.");
      if(enabled.current&&audio.current){
       try{
         void audio.current.resume().then(()=>{
           if(!audio.current)return;
           const o=audio.current.createOscillator(),g=audio.current.createGain();
           o.frequency.value=880;g.gain.value=0.035;o.connect(g);g.connect(audio.current.destination);
           o.start();o.stop(audio.current.currentTime+0.23);
         }).catch(()=>{});
       }catch{}
      }
    }
    if(shouldRefresh&&document.visibilityState==="visible")router.refresh();
   }catch{if(!stopped)setMessage("Bildiriş yenilənməsi müvəqqəti mümkün deyil.");}
   finally{inFlight=false;}
  };
  void poll();
  const interval=window.setInterval(()=>void poll(),10000);
  return ()=>{stopped=true;window.clearInterval(interval);};
 },[department,router]);
 useEffect(()=>()=>{void audio.current?.close().catch(()=>{});},[]);
 async function toggle(){
   if(enabled.current){enabled.current=false;setAlertEnabled(false);return;}
   if("AudioContext" in window){
    try{audio.current??=new AudioContext();await audio.current.resume();}catch{}
   }
   enabled.current=true;setAlertEnabled(true);
 }
 return <section className="rounded-xl bg-emerald-50 p-4 text-emerald-950">
   <p className="font-bold">Yeni müraciətlər: {count??"Yoxlanır..."}</p>
   {message&&<p role="status" className="mt-2 text-sm">{message}</p>}
   <button type="button" onClick={toggle} className="mt-3 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold">
    {alertEnabled?"Səsli bildirişi söndür":"Səsli bildirişi aktivləşdir"}
   </button>
 </section>;
}
