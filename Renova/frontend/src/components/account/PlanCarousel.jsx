"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import s from "../../styles/AccountPage.module.scss";

export default function PlanCarousel({
  items = [],
  onChoose,
  currentKey,
  focusKey,
  autoplay = false,
  autoplayMs = 4500,
}) {
  const n = items.length;
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const drag = useRef({ down: false, lastX: 0, accPx: 0 }); // drag state
  const [dragFrac, setDragFrac] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const wheelAcc = useRef(0);  // wheel state

  // keep active index valid when list changes
  useEffect(() => {
    if (!n) return;
    setActive((a) => ((a % n) + n) % n);
  }, [n]);
  useEffect(() => {
    if (!n || !currentKey) return;
    const idx = items.findIndex((x) => x?.key === currentKey);
    if (idx >= 0) setActive(idx);
  }, [currentKey, items, n]);
  useEffect(() => {         // autoplay
    if (!autoplay || n <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), autoplayMs);
    return () => clearInterval(t);
  }, [autoplay, autoplayMs, n]);


  const stepLeft = useCallback(() => {
    if (!n) return;
    setActive((a) => (a - 1 + n) % n);
  }, [n]);
  const stepRight = useCallback(() => {
    if (!n) return;
    setActive((a) => (a + 1) % n);
  }, [n]);

  const STEP_PX = 120;      // drag rotate


  function onPointerDown(e) {
    if (n <= 1) return;

    const el = e.target;
    if (el instanceof Element && el.closest("button, a, input, textarea, [data-nodrag]")) return;

    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { down: true, lastX: e.clientX, accPx: 0 };
    setIsDragging(true);
  }

  function onPointerMove(e) {
    if (!drag.current.down || n <= 1) return;

    const dx = e.clientX - drag.current.lastX;
    drag.current.lastX = e.clientX;
    drag.current.accPx += dx;

    while (drag.current.accPx >= STEP_PX) {
      setActive((a) => (a - 1 + n) % n);
      drag.current.accPx -= STEP_PX;
    }
    while (drag.current.accPx <= -STEP_PX) {
      setActive((a) => (a + 1) % n);
      drag.current.accPx += STEP_PX;
    }

    setDragFrac(drag.current.accPx / STEP_PX);
  }

  function endDrag(e) {
    if (!drag.current.down) return;

    drag.current.down = false;

    // snap
    const leftover = drag.current.accPx / STEP_PX;
    if (leftover > 0.5) setActive((a) => (a - 1 + n) % n);
    if (leftover < -0.5) setActive((a) => (a + 1) % n);

    drag.current.accPx = 0;
    setDragFrac(0);
    setIsDragging(false);

    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  //Native wheel listener
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onWheelNative = (e) => {
      if (n <= 1) return;

      //allow ctrl+wheel zoom
      if (e.ctrlKey) return;

      //stop page scroll while hovering carousel
      e.preventDefault();
      e.stopPropagation();

      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelAcc.current += d;

      const WSTEP = 90;
      while (wheelAcc.current >= WSTEP) {
        stepRight();
        wheelAcc.current -= WSTEP;
      }
      while (wheelAcc.current <= -WSTEP) {
        stepLeft();
        wheelAcc.current += WSTEP;
      }
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [n, stepLeft, stepRight]);

  const didFocusRef = useRef(null);

  useEffect(() => {
    if (!n || !focusKey) return;
    if (didFocusRef.current === focusKey) return;

    const idx = items.findIndex((x) => x?.key === focusKey);
    if (idx >= 0) {
      setActive(idx);
      didFocusRef.current = focusKey;
    }
  }, [focusKey, items, n]);

  // offset with fractional drag
  function offsetFor(i) {
    const virt = active - dragFrac;
    const half = Math.floor(n / 2);
    let o = i - virt;
    if (o > half) o -= n;
    if (o < -half) o += n;
    return o;
  }

  const cards = useMemo(() => {
    return items.map((it, i) => {
      const o = offsetFor(i);
      const abs = Math.abs(o);

      const GAP = 180;
      const baseX = o * GAP;
      const scale = Math.max(0.6, 1 - abs * 0.12);
      const rotY = o * -16;
      const z = 100 - abs;

      const style = {
        transform: `translateX(calc(-50% + ${baseX}px)) translateZ(0) scale(${scale}) rotateY(${rotY}deg)`,
        zIndex: z,
        opacity: Math.max(0.35, 1 - abs * 0.15),
        pointerEvents: abs <= 2 ? "auto" : "none",
        transition: isDragging ? "none" : undefined,
      };

      const isCenter = Math.abs(o) < 0.001;
      const isCurrent = currentKey && it.key === currentKey;

      return (
        <article
          key={it.key || i}
          className={`${s.planCard} ${isCenter ? s.planCardCenter : ""}`}
          style={style}
          onClick={(e) => {
            if (e.target instanceof Element && e.target.closest("button, a")) return;
            if (!isCenter) setActive(i);
          }}
          onDragStart={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          aria-label={`${it.name}${isCurrent ? " (current plan)" : ""}${isCenter ? " (selected)" : ""}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isCenter) onChoose?.(it);
              else setActive(i);
            }
          }}
        >
          {isCurrent && <span className={s.planRibbon}>Current</span>}

          <header className={s.planHead}>
            <div className={s.planName}>{it.name}</div>
            <div className={s.planPrice}>
              {it.price}
              {it.interval ? <span className={s.planInterval}>/{it.interval}</span> : null}
            </div>
            {it.blurb && <div className={s.planBlurb}>{it.blurb}</div>}
          </header>

          {Array.isArray(it.perks) && it.perks.length > 0 && (
            <ul className={s.planPerks}>
              {it.perks.slice(0, 6).map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          )}

          <div className={s.planCtaRow}>
            {isCenter ? (
              <button
                type="button"
                className={s.btnPrimary}
                onClick={(e) => {
                  e.stopPropagation();
                  onChoose?.(it);
                }}
              >
                Choose {it.name}
              </button>
            ) : (
              <button
                type="button"
                className={s.btn}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(i);
                }}
              >
                View {it.name}
              </button>
            )}
          </div>
        </article>
      );
    });
  }, [items, active, currentKey, dragFrac, isDragging, n, onChoose]);

  if (n === 0) return null;

  return (
    <div
      ref={rootRef}
      className={`${s.planCarousel} ${isDragging ? s.planGrabbing : ""}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          stepLeft();
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          stepRight();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
//      onWheel={onWheel}
      aria-roledescription="carousel"
      aria-label="Plans"
    >
      <div className={s.planViewport}>{cards}</div>

      <button
        type="button"
        className={`${s.planArrow} ${s.left}`}
        aria-label="Previous"
        onClick={stepLeft}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ‹
      </button>

      <button
        type="button"
        className={`${s.planArrow} ${s.right}`}
        aria-label="Next"
        onClick={stepRight}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ›
      </button>
    </div>
  );
}