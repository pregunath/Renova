"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import s from "../../styles/AccountPage.module.scss";

const AV_OUT = 512;
const BG_OUT_W = 1600;
const BG_OUT_H = 900;

const AV_PREVIEW = 220;

async function loadImageMeta(url) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
}

// fetch -> blob -> objectURL to avoid canvas taint
async function fetchAsObjectUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  return { obj, blob };
}

async function exportCropped({
  sourceUrl,
  outW,
  outH,
  meta,
  zoom,
  offset,
  quality,
  filename,
}) {
  const { obj } = await fetchAsObjectUrl(sourceUrl);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = obj;
  });

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(obj);
    return null;
  }

  const baseScale = Math.max(outW / meta.w, outH / meta.h);
  const scale = baseScale * zoom;

  const sw = meta.w * scale;
  const sh = meta.h * scale;

  const x = outW / 2 - sw / 2 + offset.x;
  const y = outH / 2 - sh / 2 + offset.y;

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, x, y, sw, sh);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  URL.revokeObjectURL(obj);
  if (!blob) return null;

  return new File([blob], filename, { type: "image/jpeg" });
}

export default function BackgroundProfileModal({
  open,
  initialTab = "background",
  currentBgUrl = "",
  currentAvatarUrl = "",
  onClose,
  onSaveBackground,
  onClearBackground,
  onSaveAvatar,
  onClearAvatar,
}) {
  const dialogId = useId();
  const firstFocusRef = useRef(null);

  const avatarCropRef = useRef(null);
  const bgCropRef = useRef(null);

  const [tab, setTab] = useState(initialTab);

  //local previews (for picked files)
  const [bgPreviewUrl, setBgPreviewUrl] = useState("");
  const [avPreviewUrl, setAvPreviewUrl] = useState("");
  //meta for picked file previews
  const [bgMetaSel, setBgMetaSel] = useState(null);
  const [avMetaSel, setAvMetaSel] = useState(null);
  //meta for current saved images
  const [bgMetaCur, setBgMetaCur] = useState(null);
  const [avMetaCur, setAvMetaCur] = useState(null);
  //bg crop box size (responsive)
  const [bgBox, setBgBox] = useState({ w: 0, h: 0 });
  //crop controls
  const [bgZoom, setBgZoom] = useState(1);
  const [bgOffset, setBgOffset] = useState({ x: 0, y: 0 });
  const [avZoom, setAvZoom] = useState(1);
  const [avOffset, setAvOffset] = useState({ x: 0, y: 0 });
  //drag refs
  const bgDrag = useRef({ down: false, lastX: 0, lastY: 0 });
  const avDrag = useRef({ down: false, lastX: 0, lastY: 0 });

  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", h);
    setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  useEffect(() => {
    if (!open || tab !== "background") return;
    const el = bgCropRef.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      setBgBox({ w: r.width, h: r.height });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, tab]);

  const bgSourceUrl = bgPreviewUrl || currentBgUrl || "";
  const avSourceUrl = avPreviewUrl || currentAvatarUrl || "";
  const bgMeta = bgPreviewUrl ? bgMetaSel : bgMetaCur;
  const avMeta = avPreviewUrl ? avMetaSel : avMetaCur;

  //load meta for currrent images
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        if (currentBgUrl && !bgPreviewUrl) setBgMetaCur(await loadImageMeta(currentBgUrl));
      } catch {
        setBgMetaCur(null);
      }
    })();
  }, [open, currentBgUrl, bgPreviewUrl]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        if (currentAvatarUrl && !avPreviewUrl) setAvMetaCur(await loadImageMeta(currentAvatarUrl));
      } catch {
        setAvMetaCur(null);
      }
    })();
  }, [open, currentAvatarUrl, avPreviewUrl]);

  //reset this shit ASP
  useEffect(() => {
    setBgZoom(1);
    setBgOffset({ x: 0, y: 0 });
  }, [bgSourceUrl]);

  useEffect(() => {
    setAvZoom(1);
    setAvOffset({ x: 0, y: 0 });
  }, [avSourceUrl]);

  function onPickBg(e) {
    const file = e.target.files?.[0] || null;
    if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);

    setBgMetaSel(null);

    if (!file) {
      setBgPreviewUrl("");
      return;
    }

    const preview = URL.createObjectURL(file);
    setBgPreviewUrl(preview);

    loadImageMeta(preview)
      .then(setBgMetaSel)
      .catch(() => setBgMetaSel(null));
  }

  function onPickAvatar(e) {
    const file = e.target.files?.[0] || null;
    if (avPreviewUrl) URL.revokeObjectURL(avPreviewUrl);

    setAvMetaSel(null);

    if (!file) {
      setAvPreviewUrl("");
      return;
    }

    const preview = URL.createObjectURL(file);
    setAvPreviewUrl(preview);

    loadImageMeta(preview)
      .then(setAvMetaSel)
      .catch(() => setAvMetaSel(null));
  }

  // cleanup
  useEffect(() => {
    return () => {
      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
      if (avPreviewUrl) URL.revokeObjectURL(avPreviewUrl);
    };
  }, [bgPreviewUrl, avPreviewUrl]);

  const clampBgOffset = useMemo(() => {
    return (next, nextZoom, meta) => {
      if (!meta) return { x: 0, y: 0 };

      const baseScale = Math.max(BG_OUT_W / meta.w, BG_OUT_H / meta.h);
      const scale = baseScale * nextZoom;

      const sw = meta.w * scale;
      const sh = meta.h * scale;

      const maxX = Math.max(0, (sw - BG_OUT_W) / 2);
      const maxY = Math.max(0, (sh - BG_OUT_H) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, next.x)),
        y: Math.max(-maxY, Math.min(maxY, next.y)),
      };
    };
  }, []);

  const clampAvOffset = useMemo(() => {
    return (next, nextZoom, meta) => {
      if (!meta) return { x: 0, y: 0 };

      const baseScale = Math.max(AV_OUT / meta.w, AV_OUT / meta.h);
      const scale = baseScale * nextZoom;

      const sw = meta.w * scale;
      const sh = meta.h * scale;

      const maxX = Math.max(0, (sw - AV_OUT) / 2);
      const maxY = Math.max(0, (sh - AV_OUT) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, next.x)),
        y: Math.max(-maxY, Math.min(maxY, next.y)),
      };
    };
  }, []);

  //background drag
  function onBgPointerDown(e) {
    if (!bgSourceUrl || !bgMeta) return;
    e.preventDefault();
    e.stopPropagation();
    bgCropRef.current?.setPointerCapture?.(e.pointerId);
    bgDrag.current = { down: true, lastX: e.clientX, lastY: e.clientY };
  }
  function onBgPointerMove(e) {
    if (!bgDrag.current.down || !bgMeta) return;

    const w = bgBox.w || 1;
    const h = bgBox.h || 1;

    const dx = (e.clientX - bgDrag.current.lastX) * (BG_OUT_W / w);
    const dy = (e.clientY - bgDrag.current.lastY) * (BG_OUT_H / h);

    bgDrag.current.lastX = e.clientX;
    bgDrag.current.lastY = e.clientY;

    setBgOffset((prev) => clampBgOffset({ x: prev.x + dx, y: prev.y + dy }, bgZoom, bgMeta));
  }
  function onBgPointerUp(e) {
    if (!bgDrag.current.down) return;
    bgDrag.current.down = false;
    bgCropRef.current?.releasePointerCapture?.(e.pointerId);
  }

  // avatar drag
  function onAvPointerDown(e) {
    if (!avSourceUrl || !avMeta) return;
    e.preventDefault();
    e.stopPropagation();
    avatarCropRef.current?.setPointerCapture?.(e.pointerId);
    avDrag.current = { down: true, lastX: e.clientX, lastY: e.clientY };
  }
  function onAvPointerMove(e) {
    if (!avDrag.current.down || !avMeta) return;

    const dx = (e.clientX - avDrag.current.lastX) * (AV_OUT / AV_PREVIEW);
    const dy = (e.clientY - avDrag.current.lastY) * (AV_OUT / AV_PREVIEW);

    avDrag.current.lastX = e.clientX;
    avDrag.current.lastY = e.clientY;

    setAvOffset((prev) => clampAvOffset({ x: prev.x + dx, y: prev.y + dy }, avZoom, avMeta));
  }
  function onAvPointerUp(e) {
    if (!avDrag.current.down) return;
    avDrag.current.down = false;
    avatarCropRef.current?.releasePointerCapture?.(e.pointerId);
  }

  const bgPreviewStyle = useMemo(() => {
    if (!open || !bgMeta || !bgSourceUrl || !bgBox.w || !bgBox.h) return null;

    const baseScale = Math.max(bgBox.w / bgMeta.w, bgBox.h / bgMeta.h);
    const scale = baseScale * bgZoom;

    const sw = bgMeta.w * scale;
    const sh = bgMeta.h * scale;

    const ox = bgOffset.x * (bgBox.w / BG_OUT_W);
    const oy = bgOffset.y * (bgBox.h / BG_OUT_H);

    const left = bgBox.w / 2 - sw / 2 + ox;
    const top = bgBox.h / 2 - sh / 2 + oy;

    return { width: sw, height: sh, left, top };
  }, [open, bgMeta, bgSourceUrl, bgBox, bgZoom, bgOffset]);

  const avPreviewStyle = useMemo(() => {
    if (!open || !avMeta || !avSourceUrl) return null;

    const baseScale = Math.max(AV_PREVIEW / avMeta.w, AV_PREVIEW / avMeta.h);
    const scale = baseScale * avZoom;

    const sw = avMeta.w * scale;
    const sh = avMeta.h * scale;

    const ox = avOffset.x * (AV_PREVIEW / AV_OUT);
    const oy = avOffset.y * (AV_PREVIEW / AV_OUT);

    const left = AV_PREVIEW / 2 - sw / 2 + ox;
    const top = AV_PREVIEW / 2 - sh / 2 + oy;

    return { width: sw, height: sh, left, top };
  }, [open, avMeta, avSourceUrl, avZoom, avOffset]);

  if (!open) return null;

  return (
    <div className={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} onMouseDown={onClose}>
      <div className={s.modalSheet} onMouseDown={(e) => e.stopPropagation()}>
        <header className={s.modalHeader}>
          <h3 id={`${dialogId}-title`} className={s.modalTitle}>Customize</h3>

          <div className={s.modalTabs} role="tablist">
            <button ref={firstFocusRef} className={`${s.modalTab} ${tab === "background" ? s.modalTabActive : ""}`} onClick={() => setTab("background")} type="button">
              Background
            </button>
            <button className={`${s.modalTab} ${tab === "profile" ? s.modalTabActive : ""}`} onClick={() => setTab("profile")} type="button">
              Profile Photo
            </button>
          </div>

          <button className={s.modalClose} onClick={onClose} aria-label="Close" type="button">✕</button>
        </header>

        <div className={s.modalBody}>
          {tab === "background" && (
            <section>
              <p className={s.modalHint}>Drag to reposition and zoom before saving.</p>

              <div className={s.modalRow}>
                <label className={s.uploadBtn}>
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(e) => { e.currentTarget.value = ""; }} 
                    onChange={onPickBg}
                    hidden
                  />
                  Choose image…
                </label>

                <button
                  className={s.btnGhost}
                  onClick={() => {
                    if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
                    setBgPreviewUrl("");
                    setBgMetaSel(null);
                    onClearBackground?.();
                  }}
                  type="button"
                >
                  Reset to default
                </button>

                <div className={s.spacer} />

                <button className={s.btn} disabled={!bgSourceUrl} onClick={() => { setBgZoom(1); setBgOffset({ x: 0, y: 0 }); }} type="button">
                  Center
                </button>

                <button
                  className={s.btnPrimary}
                  disabled={!bgSourceUrl || !bgMeta}
                  onClick={async () => {
                    const file = await exportCropped({
                      sourceUrl: bgSourceUrl,
                      outW: BG_OUT_W,
                      outH: BG_OUT_H,
                      meta: bgMeta,
                      zoom: bgZoom,
                      offset: bgOffset,
                      quality: 0.9,
                      filename: "background.jpg",
                    });
                    if (file) onSaveBackground?.(file);
                  }}
                  type="button"
                >
                  Save
                </button>
              </div>

              <div className={s.bgCropWrap}>
                <div
                  ref={bgCropRef}
                  className={s.bgCropBox}
                  onPointerDown={onBgPointerDown}
                  onPointerMove={onBgPointerMove}
                  onPointerUp={onBgPointerUp}
                  onPointerCancel={onBgPointerUp}
                >
                  {bgSourceUrl && bgPreviewStyle ? (
                    <img
                      src={bgSourceUrl}
                      alt="Background preview"
                      className={s.bgCropImg}
                      draggable={false}
                      style={{ width: bgPreviewStyle.width, height: bgPreviewStyle.height, left: bgPreviewStyle.left, top: bgPreviewStyle.top }}
                    />
                  ) : (
                    <div className={s.previewPlaceholder}>No image chosen</div>
                  )}
                </div>

                <div className={s.rangeRow}>
                  <div className={s.cropHelp}>Tip: drag to set the focal point. Use zoom if needed.</div>
                  <div className={s.rangeLabel}><span>Zoom</span><span>{bgZoom.toFixed(2)}x</span></div>
                  <input
                    className={s.range}
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.01"
                    value={bgZoom}
                    disabled={!bgSourceUrl || !bgMeta}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setBgZoom(next);
                      setBgOffset((prev) => clampBgOffset(prev, next, bgMeta));
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {tab === "profile" && (
            <section>
              <p className={s.modalHint}>Drag to reposition and zoom before saving.</p>

              <div className={s.modalRow}>
                <label className={s.uploadBtn}>
                  <input
                    type="file"
                    accept="image/*"
                    onClick={(e) => { e.currentTarget.value = ""; }} 
                    onChange={onPickAvatar}
                    hidden
                  />
                  Choose photo…
                </label>

                <button
                  className={s.btnGhost}
                  onClick={() => {
                    if (avPreviewUrl) URL.revokeObjectURL(avPreviewUrl);
                    setAvPreviewUrl("");
                    setAvMetaSel(null);
                    onClearAvatar?.();
                  }}
                  type="button"
                >
                  Remove photo
                </button>

                <div className={s.spacer} />

                <button className={s.btn} disabled={!avSourceUrl} onClick={() => { setAvZoom(1); setAvOffset({ x: 0, y: 0 }); }} type="button">
                  Center
                </button>

                <button
                  className={s.btnPrimary}
                  disabled={!avSourceUrl || !avMeta}
                  onClick={async () => {
                    const file = await exportCropped({
                      sourceUrl: avSourceUrl,
                      outW: AV_OUT,
                      outH: AV_OUT,
                      meta: avMeta,
                      zoom: avZoom,
                      offset: avOffset,
                      quality: 0.92,
                      filename: "avatar.jpg",
                    });
                    if (file) onSaveAvatar?.(file);
                  }}
                  type="button"
                >
                  Save
                </button>
              </div>

              <div className={s.avatarCropWrap}>
                <div
                  ref={avatarCropRef}
                  className={s.avatarCropCircle}
                  onPointerDown={onAvPointerDown}
                  onPointerMove={onAvPointerMove}
                  onPointerUp={onAvPointerUp}
                  onPointerCancel={onAvPointerUp}
                >
                  {avSourceUrl && avPreviewStyle ? (
                    <img
                      src={avSourceUrl}
                      alt="Avatar preview"
                      className={s.avatarCropImg}
                      draggable={false}
                      style={{ width: avPreviewStyle.width, height: avPreviewStyle.height, left: avPreviewStyle.left, top: avPreviewStyle.top }}
                    />
                  ) : (
                    <div className={s.previewPlaceholder}>No photo chosen</div>
                  )}
                </div>

                <div className={s.rangeRow}>
                  <div className={s.cropHelp}>Tip: drag the image to frame it. Use zoom if needed.</div>
                  <div className={s.rangeLabel}><span>Zoom</span><span>{avZoom.toFixed(2)}x</span></div>
                  <input
                    className={s.range}
                    type="range"
                    min="1"
                    max="2.75"
                    step="0.01"
                    value={avZoom}
                    disabled={!avSourceUrl || !avMeta}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setAvZoom(next);
                      setAvOffset((prev) => clampAvOffset(prev, next, avMeta));
                    }}
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}