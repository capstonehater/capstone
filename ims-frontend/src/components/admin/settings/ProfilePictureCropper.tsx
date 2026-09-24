"use client";

import { useEffect, useRef, useState } from "react";
import ActionAlert from "@/components/feedback/ActionAlert";

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export default function ProfilePictureCropper({ file, onCancel, onApply }: {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const active = useRef(true);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    active.current = true;
    const url = URL.createObjectURL(file);
    const source = new window.Image();
    source.onload = () => {
      if (!active.current) return;
      if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > 25000000) {
        setError("Choose an image up to 25 megapixels.");
        return;
      }
      setImage(source);
    };
    source.onerror = () => { if (active.current) setError("This picture could not be opened. Choose another JPG, PNG, or WebP file."); };
    source.src = url;
    return () => {
      active.current = false;
      source.onload = null;
      source.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const side = image ? Math.min(image.naturalWidth, image.naturalHeight) / zoom : 0;
  const left = image ? (image.naturalWidth - side) * (position.x + 1) / 2 : 0;
  const top = image ? (image.naturalHeight - side) * (position.y + 1) / 2 : 0;

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!image || !context) return;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(image, left, top, side, side, 0, 0, 512, 512);
  }, [image, left, top, side]);

  function applyCrop() {
    if (!image || saving || !canvasRef.current) return;
    setSaving(true);
    // Export the actual crop, not just the circular CSS preview.
    canvasRef.current.toBlob((blob) => {
      if (!active.current) return;
      if (!blob) {
        setSaving(false);
        setError("Unable to crop this picture. Please try another image.");
        return;
      }
      onApply(new File([blob], "profile-picture.png", { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="mx-auto grid max-w-md gap-5">
      {error && <ActionAlert tone="error" title="Unable to crop picture" message={error} onDismiss={() => setError(null)} />}
      <p className="m-0 text-center text-sm text-slate-600">Drag to reposition, then zoom to frame your photo.</p>
      <div className="relative mx-auto aspect-square w-full max-w-80 overflow-hidden rounded-2xl bg-slate-200">
        <canvas
          ref={canvasRef} width={512} height={512}
          aria-label="Profile photo crop preview. Use the sliders below to adjust the crop."
          className="block h-full w-full touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={(event) => {
            if (!image || saving) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current || !image || saving) return;
            const width = event.currentTarget.getBoundingClientRect().width;
            const dx = (event.clientX - drag.current.x) * side / width;
            const dy = (event.clientY - drag.current.y) * side / width;
            setPosition({
              x: image.naturalWidth > side ? clamp(drag.current.startX - 2 * dx / (image.naturalWidth - side)) : 0,
              y: image.naturalHeight > side ? clamp(drag.current.startY - 2 * dy / (image.naturalHeight - side)) : 0,
            });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_100px_rgba(15,23,42,0.55)]" />
        {!image && <p role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-slate-700">{error ? "Choose another picture to continue." : "Loading picture..."}</p>}
      </div>
      <fieldset disabled={!image || saving} className="grid gap-3">
        <legend className="sr-only">Adjust photo crop</legend>
        <label className="grid gap-2 text-sm font-semibold text-[#232d46]">Zoom ({zoom.toFixed(1)}×)
          <input className="w-full accent-[#232d46]" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#232d46]">Horizontal position
          <input className="w-full accent-[#232d46]" type="range" min={-1} max={1} step={0.01} value={position.x} onChange={(event) => setPosition((previous) => ({ ...previous, x: Number(event.target.value) }))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#232d46]">Vertical position
          <input className="w-full accent-[#232d46]" type="range" min={-1} max={1} step={0.01} value={position.y} onChange={(event) => setPosition((previous) => ({ ...previous, y: Number(event.target.value) }))} />
        </label>
        <button type="button" className="justify-self-start text-sm font-semibold text-[#232d46] underline" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Reset crop</button>
      </fieldset>
      <p className="m-0 text-xs text-slate-500">The circle shows how your profile picture will appear. Save your account changes to upload it.</p>
      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-[#232d46] disabled:opacity-50">Cancel</button>
        <button type="button" disabled={!image || saving} onClick={applyCrop} className="rounded-full bg-[#232d46] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Cropping..." : "Use photo"}</button>
      </div>
    </div>
  );
}
