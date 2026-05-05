"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import s from "./AvatarCropModal.module.css";

export type AvatarPickerHandle = {
  /** Open the OS file picker. */
  open: () => void;
};

/* Avatar picker + cropper. The parent keeps a ref to call `open()` —
 * that triggers the native file picker immediately. Only after the user
 * selects an image does the crop modal mount, so there's no intermediate
 * "pick a file" popup. On confirm we resolve to a 512×512 JPEG `File`
 * and an in-memory preview URL. */
export const AvatarCropModal = forwardRef<
  AvatarPickerHandle,
  { onConfirm: (file: File, previewUrl: string) => void }
>(function AvatarCropModal({ onConfirm }, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  // Portal target only exists on the client; defer until after mount.
  useEffect(() => {
    setMounted(true);
  }, []);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        // Reset the input value so picking the same file twice still fires
        // the change event.
        if (fileInputRef.current) fileInputRef.current.value = "";
        fileInputRef.current?.click();
      },
    }),
    [],
  );

  const reset = useCallback(() => {
    setSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setBusy(false);
  }, []);

  // Esc closes; lock body scroll while the crop modal is showing.
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, reset]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSrc(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const onComplete = useCallback((_pct: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const confirm = async () => {
    if (!src || !croppedArea) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(src, croppedArea, 512);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(file, previewUrl);
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={onPick}
        style={{ display: "none" }}
      />

      {src && mounted && createPortal(
        <div className={s.cropOverlay} onMouseDown={reset}>
          <div className={s.cropDialog} onMouseDown={(e) => e.stopPropagation()}>
            <header className={s.cropHead}>
              <h2 className={s.cropTitle}>Frame your photo</h2>
              <button
                type="button"
                aria-label="Close"
                className={s.cropClose}
                onClick={reset}
              >
                ×
              </button>
            </header>

            <div className={s.cropStage}>
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onComplete}
              />
            </div>
            <div className={s.cropControls}>
              <label className={s.cropZoomLabel}>Zoom</label>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className={s.cropZoomInput}
              />
            </div>

            <footer className={s.cropFoot}>
              <button
                type="button"
                className={`${s.btn} ${s.btnGhost}`}
                onClick={() => {
                  setSrc(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  fileInputRef.current?.click();
                }}
                disabled={busy}
              >
                Pick another
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className={`${s.btn} ${s.btnText}`}
                onClick={reset}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${s.btn} ${s.btnCta}`}
                onClick={confirm}
                disabled={!croppedArea || busy}
              >
                {busy ? "Saving…" : "Use photo"}
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});

/** Crop the source image (data URL) to the pixel rect from react-easy-crop
 *  and return a JPEG Blob, scaled down to `outSize` × `outSize`. */
async function cropToBlob(src: string, area: Area, outSize: number): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d not available");
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, outSize, outSize,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas.toBlob returned null"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
