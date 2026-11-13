"use client";
import {useEffect,useState} from "react";
export default function RoomQRCode({slug,number,token}:{slug:string;number:string;token:string}){
 const [url,setUrl]=useState("");
 useEffect(()=>{
   setUrl(window.location.origin+"/hotel/"+encodeURIComponent(slug)+"/room/"+
     encodeURIComponent(number)+"?t="+encodeURIComponent(token));
 },[slug,number,token]);
 if(!url)return <span className="text-xs">QR hazırlanır...</span>;
 const qr="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data="+encodeURIComponent(url);
 return <div className="space-y-2">
   <img alt={"Otaq "+number+" QR kodu"} src={qr} width={138} height={138} className="rounded-lg bg-white p-1" referrerPolicy="no-referrer"/>
   <a className="block break-all text-xs text-blue-700 underline" href={url} target="_blank" rel="noopener noreferrer">Qonaq linkini aç</a>
   <a className="text-xs text-blue-700 underline" href={qr} target="_blank" rel="noopener noreferrer">QR təsvirini aç / çap et</a>
 </div>;
}
