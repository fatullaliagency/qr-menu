"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DeliveryCoordinates } from "@/app/lib/delivery-location";

const START: DeliveryCoordinates = { latitude: 40.4093, longitude: 49.8671 };
const TILE = 256;
const HEIGHT = 260;
const MAX_LATITUDE = 85.05112878;
const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

function worldPixel(point: DeliveryCoordinates, zoom: number) {
  const world = TILE * 2 ** zoom;
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude));
  const sine = Math.sin(lat * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * world,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world,
  };
}

function geographicPoint(x: number, y: number, zoom: number): DeliveryCoordinates {
  const world = TILE * 2 ** zoom;
  const wrappedX = ((x % world) + world) % world;
  const safeY = Math.max(0, Math.min(world, y));
  return {
    latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * safeY / world))) * 180 / Math.PI,
    longitude: wrappedX / world * 360 - 180,
  };
}

function rounded(point: DeliveryCoordinates): DeliveryCoordinates {
  return {
    latitude: Number(point.latitude.toFixed(6)),
    longitude: Number(point.longitude.toFixed(6)),
  };
}

type PointerDrag = {
  id: number; startX: number; startY: number;
  origin: DeliveryCoordinates; moved: boolean;
};

export default function DeliveryMapPicker({
  value, onChange, disabled = false,
}: {
  value: DeliveryCoordinates | null;
  onChange: (point: DeliveryCoordinates | null) => void;
  disabled?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const [width, setWidth] = useState(340);
  const [center, setCenter] = useState<DeliveryCoordinates>(START);
  const [zoom, setZoom] = useState(12);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(1, map.getBoundingClientRect().width));
    });
    observer.observe(map);
    setWidth(Math.max(1, map.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const centerPx = worldPixel(center, zoom);
  const tiles = useMemo(() => {
    const middle = worldPixel(center, zoom);
    const count = 2 ** zoom;
    const startX = Math.floor((middle.x - width / 2) / TILE);
    const endX = Math.floor((middle.x + width / 2) / TILE);
    const startY = Math.max(0, Math.floor((middle.y - HEIGHT / 2) / TILE));
    const endY = Math.min(count - 1, Math.floor((middle.y + HEIGHT / 2) / TILE));
    const output: { key: string; src: string; left: number; top: number }[] = [];
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const wrappedX = ((x % count) + count) % count;
        output.push({
          key: zoom + ":" + x + ":" + y,
          src: "https://tile.openstreetmap.org/" + zoom + "/" + wrappedX + "/" + y + ".png",
          left: x * TILE - middle.x + width / 2,
          top: y * TILE - middle.y + HEIGHT / 2,
        });
      }
    }
    return output;
  }, [center, zoom, width]);

  // Keep the pin in the correct place even if the map crosses the 180° meridian.
  const pin = useMemo(() => {
    if (!value) return null;
    const world = TILE * 2 ** zoom;
    const point = worldPixel(value, zoom);
    const middle = worldPixel(center, zoom);
    let dx = point.x - middle.x;
    if (dx > world / 2) dx -= world;
    if (dx < -world / 2) dx += world;
    return { left: width / 2 + dx, top: HEIGHT / 2 + point.y - middle.y };
  }, [value, center, zoom, width]);

  function selectFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - HEIGHT / 2;
    onChange(rounded(geographicPoint(centerPx.x + x, centerPx.y + y, zoom)));
    setLocationError("");
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || dragRef.current) return;
    dragRef.current = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      origin: center, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (disabled || !drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    const origin = worldPixel(drag.origin, zoom);
    setCenter(geographicPoint(origin.x - dx, origin.y - dy, zoom));
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && !disabled) selectFromPointer(event);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function locate() {
    if (disabled || locating) return;
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Brauzer məkan müəyyənləşdirməni dəstəkləmir. Xəritədən yer seçin.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = rounded({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        onChange(next);
        setCenter(next);
        setZoom(16);
        setLocating(false);
      },
      () => {
        setLocationError("Məkan icazəsi alınmadı. Xəritəyə toxunaraq yer seçə bilərsiniz.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  return (
    <section aria-label="Çatdırılma xəritəsi" className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
      <p className="text-sm font-semibold">📍 Çatdırılma yerini xəritədə seçin (istəyə bağlı)</p>
      <p className="text-xs text-zinc-300">
        Xəritəyə toxunun, yaxud xəritəni sürüşdürüb mərkəzdəki nöqtəni seçin.
        Yeriniz yalnız sifarişi göndərdikdə restorana ötürülür.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={locate} disabled={disabled || locating}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold disabled:opacity-50">
          {locating ? "Məkan axtarılır..." : "Cari yerimi seç"}
        </button>
        <button type="button" onClick={() => { onChange(rounded(center)); setLocationError(""); }}
          disabled={disabled}
          className="rounded-lg border border-zinc-500 px-3 py-2 text-xs font-bold disabled:opacity-50">
          Xəritənin mərkəzini seç
        </button>
        {value && <button type="button" onClick={() => onChange(null)} disabled={disabled}
          className="rounded-lg border border-zinc-500 px-3 py-2 text-xs disabled:opacity-50">
          Seçimi sil
        </button>}
      </div>
      <div className="relative overflow-hidden rounded-lg border border-zinc-600 bg-zinc-700"
        ref={mapRef} data-testid="delivery-map" role="application"
        aria-label="İnteraktiv xəritə; nöqtə seçmək üçün toxunun"
        style={{ height: HEIGHT, touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; }}>
        {tiles.map((tile) => (
          <img key={tile.key} src={tile.src} alt="" draggable={false}
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ position: "absolute", left: tile.left, top: tile.top, width: TILE, height: TILE, maxWidth: "none", pointerEvents: "none", userSelect: "none" }} />
        ))}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600/70 shadow-lg" />
        {pin && pin.left >= 0 && pin.left <= width && pin.top >= 0 && pin.top <= HEIGHT && (
          <div data-testid="delivery-pin" aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-3xl drop-shadow-lg"
            style={{ left: pin.left, top: pin.top }}>📍</div>
        )}
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button type="button" aria-label="Xəritəni yaxınlaşdır" onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled || zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            className="h-8 w-8 rounded bg-zinc-950/90 text-lg font-bold text-white disabled:opacity-40">+</button>
          <button type="button" aria-label="Xəritəni uzaqlaşdır" onPointerDown={(e) => e.stopPropagation()}
            disabled={disabled || zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            className="h-8 w-8 rounded bg-zinc-950/90 text-lg font-bold text-white disabled:opacity-40">−</button>
        </div>
        <a className="absolute bottom-1 right-1 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-black underline"
          href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}>© OpenStreetMap iştirakçıları</a>
      </div>
      {value ? (
        <p role="status" className="text-xs font-medium text-emerald-300">
          ✓ Məkan seçildi: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </p>
      ) : <p role="status" className="text-xs text-amber-200">Hələ məkan seçilməyib. Yazılı ünvanla da sifariş verə bilərsiniz.</p>}
      {locationError && <p role="alert" className="text-xs text-rose-300">{locationError}</p>}
    </section>
  );
}
