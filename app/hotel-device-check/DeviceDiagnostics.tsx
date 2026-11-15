"use client";

import { useEffect, useRef, useState } from "react";

type Status = "yoxlanmayıb" | "icazə verildi" | "dəstəklənmir" | "icazə verilmədi" | "xəta";
type AudioStatus = "yoxlanmayıb" | "səs göndərildi" | "dəstəklənmir" | "xəta";

export default function DeviceDiagnostics() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<Status>("yoxlanmayıb");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sound, setSound] = useState<AudioStatus>("yoxlanmayıb");
  const [heardSound, setHeardSound] = useState(false);
  const [notification, setNotification] = useState<Status>("yoxlanmayıb");
  const [network, setNetwork] = useState("Yoxlanır...");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = () => setNetwork(navigator.onLine ? "Brauzer onlayn görünür" : "Brauzer oflayn görünür");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
    };
  }, []);

  function stopCamera() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraOpen(false);
  }

  async function testCamera() {
    stopCamera();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera("dəstəklənmir");
      return;
    }
    try {
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: "environment" } }
      });
      stream.current = captured;
      if (!video.current) {
        stopCamera();
        setCamera("xəta");
        return;
      }
      video.current.srcObject = captured;
      await video.current.play();
      setCameraOpen(true);
      setCamera("icazə verildi");
    } catch (e) {
      stopCamera();
      setCamera(e instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(e.name)
        ? "icazə verilmədi" : "xəta");
    }
  }

  async function testSound() {
    const compatible = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Constructor = window.AudioContext || compatible.webkitAudioContext;
    if (!Constructor) {
      setSound("dəstəklənmir");
      return;
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = new Constructor();
      await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 800;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.35);
      setSound("səs göndərildi");
      const opened = ctx;
      oscillator.onended = () => { void opened.close().catch(() => {}); };
    } catch {
      setSound("xəta");
      if (ctx) await ctx.close().catch(() => {});
    }
  }

  async function testNotification() {
    if (!("Notification" in window) || !window.isSecureContext) {
      setNotification("dəstəklənmir");
      return;
    }
    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        setNotification("icazə verilmədi");
        return;
      }
      // On some iOS browsers notifications require an installed PWA.
      try {
        new Notification("Otel test bildirişi", {
          body: "Bu yalnız telefonun brauzer testidir; real sifariş deyil."
        });
        setNotification("icazə verildi");
      } catch {
        setNotification("dəstəklənmir");
      }
    } catch {
      setNotification("xəta");
    }
  }

  async function copyResults() {
    const results = [
      "Otel telefon qəbul sınağı",
      "Tarix (UTC): " + new Date().toISOString(),
      "Kamera: " + camera,
      "Səsin brauzerdən göndərilməsi: " + sound,
      "Səsi real eşitdim: " + (heardSound ? "Bəli" : "Təsdiqlənməyib"),
      "Brauzer bildirişi: " + notification,
      "Şəbəkə: " + network,
      "Qeyd: Kamera görüntüsü və şəxsi məlumatlar serverə göndərilmədi.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(results);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const button = "rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white";
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl bg-white p-5">
        <h2 className="text-lg font-bold">1. Telefon kamerası</h2>
        <p className="text-sm text-zinc-600">
          Kamera yalnız bu cihazda göstərilir. Görüntü saxlanılmır və serverə ötürülmür.
          Otaq QR kodunun faktiki skanı otel test bazası qoşulduqdan sonra ayrıca yoxlanacaq.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={button} type="button" onClick={() => void testCamera()}>Kameranı yoxla</button>
          {cameraOpen && <button type="button" className="rounded-lg border px-4 py-2.5 text-sm" onClick={stopCamera}>Kameranı dayandır</button>}
        </div>
        <video ref={video} autoPlay playsInline muted
          className={cameraOpen ? "max-h-72 w-full rounded-lg bg-zinc-950 object-contain" : "hidden"} />
        <p role="status" className="text-sm">Kamera nəticəsi: <strong>{camera}</strong></p>
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5">
        <h2 className="text-lg font-bold">2. Səsli bildiriş</h2>
        <p className="text-sm text-zinc-600">
          Düyməyə basdıqda qısa test siqnalı çalınacaq. Telefonun səsini və səssiz rejimini də yoxlayın.
        </p>
        <button type="button" className={button} onClick={() => void testSound()}>Test səsini çal</button>
        <p role="status" className="text-sm">Səs əməliyyatı: <strong>{sound}</strong></p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={heardSound} onChange={e => setHeardSound(e.target.checked)} />
          Səsi telefonda həqiqətən eşitdim
        </label>
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5">
        <h2 className="text-lg font-bold">3. Brauzer bildirişi</h2>
        <p className="text-sm text-zinc-600">
          Yalnız icazənizlə test bildirişi göstərməyə çalışacaq. iOS-da quraşdırılmış
          veb tətbiq tələb oluna bilər. Brauzer bağlandıqdan sonra push göndərişi burada test edilmir.
        </p>
        <button type="button" className={button} onClick={() => void testNotification()}>Bildirişi yoxla</button>
        <p role="status" className="text-sm">Bildiriş nəticəsi: <strong>{notification}</strong></p>
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5">
        <h2 className="text-lg font-bold">4. Şəbəkə və nəticə</h2>
        <p role="status" className="text-sm">Şəbəkə vəziyyəti: <strong>{network}</strong></p>
        <p className="text-xs text-zinc-600">
          Bu, brauzerin şəbəkə göstəricisidir; serverə real qoşulmanı sübut etmir.
        </p>
        <button type="button" className={button} onClick={() => void copyResults()}>Test nəticəsini kopyala</button>
        {copied && <p role="status" className="text-sm text-emerald-800">Nəticə cihazın mübadilə yaddaşına kopyalandı.</p>}
      </section>
    </div>
  );
}
