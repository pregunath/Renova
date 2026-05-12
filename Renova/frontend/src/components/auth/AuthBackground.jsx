"use client";
import { useEffect, useRef } from "react";

/* ======================
   AuthBackground
   ----------------------
   Just make this professional this file works on the background animation for the login 
   & signup page it creates cards that represents furniture each representing one
   of four render stages (outline / highlight / solid / OBJ) also the Rows alternate direction
   each level
========================= */

export default function AuthBackground({
  density = 10,        // target cards per row
  rowGap = 100,        // gap between rows (px)
  chipW = 160,         // card width (px)
  chipH = 90,          // card height (px)
  speed = 60,          // horizontal speed (px/s), per-row +-10% variance
  blur = 1,            // canvas CSS blur
  opacity = 0.22,      // canvas opacity
  autoScale = true,    // scale card size on viewport width
  cover = "viewport",
  minHGap = 24,        // minimum horizontal gap between cards (px)
  minVGap = 18,        // minimum vertical gap between rows (px)
  minScale = 0.8,      // lower bound for auto scale
  maxScale = 2.0,      // upper bound for auto scale
}) {

  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const ctxRef = useRef(null);
  const stateRef = useRef({
    w: 0, h: 0, dpr: 1,
    lastT: 0,
    rows: [],  
  });

  const COLS = {
    outline: "#cfd6df",
    highlight: "#55bbff",
    solidFill: "rgba(184,195,255,0.28)",
    solidStroke: "rgba(230,235,255,0.6)",
    objFill: "rgba(232,236,255,0.34)",
    objStroke: "rgba(255,255,255,0.9)",
  };

  const GLYPH_TYPES = [
    "sofa", "carpet", "plant", "tv", "desk", "table",
    "shelf", "bed", "fridge", "island", "sink", "toilet", "bathtub",
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

 
  //resize to setup canvas + rebuild rows for spacing
  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Canvas siize
    const parent = cover === "viewport" ? null : canvas.parentElement || document.body;
    const width  = cover === "viewport" ? window.innerWidth  : parent.getBoundingClientRect().width;
    const height = cover === "viewport" ? window.innerHeight : parent.getBoundingClientRect().height;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    //2D context 
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
    const st = stateRef.current;
    st.w = width; st.h = height; st.dpr = dpr;

    initRows();
  };

  const initRows = () => {
    const st = stateRef.current;
    const rows = [];

    //scaling
    const scale = autoScale ? clamp(st.w / 1200, minScale, maxScale) : 1;
    const CW = chipW * scale;   // card width
    const CH = chipH * scale;   // card height
    //row gap
    const RG = Math.max(rowGap * scale, CH + minVGap);
    //rnough rows to fill + overscan
    const rowCount = Math.max(4, Math.ceil(st.h / RG) + 2);

    for (let r = 0; r < rowCount; r++) {
      const y   = (r + 0.5) * RG - RG;  // shift up 1
      const dir = r % 2 === 0 ? 1 : -1; // alternate direction
      const rowSpeed = speed * (1.0 + (r % 3 - 1) * 0.1); // +-10% variance

      //horizontal 
      const perCard = CW + minHGap;  
      const loopLen = st.w + CW * 4;  
      const maxSafeCount = Math.max(3, Math.floor(loopLen / perCard));
      const dens = Math.min(maxSafeCount, Math.max(4, density)); 
      const spacing = loopLen / dens;           
      const stage = r % 4;

      //desync in rows so doesnt line up perfectly
      const baseOffset = Math.random() * spacing;

      const chips = [];
      for (let i = 0; i < dens; i++) {
        const loopX = i * spacing - baseOffset - loopLen * 0.25;  
        const x = dir === 1 ? loopX - CW : st.w - (loopX - CW);
        const type = GLYPH_TYPES[(i + r) % GLYPH_TYPES.length];
        chips.push({ x, y, w: CW, h: CH, stage, type });
      }
      rows.push({ y, dir, speed: rowSpeed, chips, loopLen, spacing, CW, CH, stage });
    }
    st.rows = rows;
  };

  //Drawing helpers
  const roundRectPath = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const rrRect = (ctx, x, y, w, h, r, fill, stroke, lw) => {
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r);
    if (fill)   { ctx.fillStyle = fill;   ctx.fill();   }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const drawGlyph = (ctx, type, cx, cy, w, h, opt) => {
    const { fill, stroke, lw } = opt;
    ctx.save();
    ctx.translate(cx, cy);

    const legW = Math.max(2, w * 0.02);
    const legH = Math.max(2, h * 0.25);

    switch (type) {
      case "sofa": {
        const armW = w * 0.12;
        rrRect(ctx, -w / 2, -h * 0.15, w, h * 0.5, 8, fill, stroke, lw);
        rrRect(ctx, -w / 2, -h * 0.4,  w, h * 0.35, 8, fill ? "rgba(255,255,255,0.06)" : null, stroke, lw);
        rrRect(ctx, -w / 2, -h * 0.05, armW, h * 0.4, 6, fill, stroke, lw);
        rrRect(ctx,  w / 2 - armW, -h * 0.05, armW, h * 0.4, 6, fill, stroke, lw);
        break;
      }
      case "carpet":
        rrRect(ctx, -w * 0.5, -h * 0.18, w, h * 0.36, 8, fill, stroke, lw);
        break;
      case "plant":
        rrRect(ctx, -w * 0.12,  h * 0.04,  w * 0.24, h * 0.18, 6, fill, stroke, lw); // pot
        rrRect(ctx, -w * 0.2,  -h * 0.28,  w * 0.4,  h * 0.4, 12, fill ? "rgba(255,255,255,0.06)" : null, stroke, lw); // canopy
        break;
      case "tv":
        rrRect(ctx, -w * 0.42, -h * 0.35, w * 0.84, h * 0.52, 6, fill, stroke, lw);
        rrRect(ctx, -w * 0.12,  h * 0.2,  w * 0.24, h * 0.1,  4, fill, stroke, lw);
        rrRect(ctx, -w * 0.02, -h * 0.02, w * 0.04, h * 0.28, 2, fill, stroke, lw);
        break;
      case "desk":
        rrRect(ctx, -w * 0.5, -h * 0.25, w, h * 0.18, 6, fill, stroke, lw);
        rrRect(ctx, -w * 0.48, -h * 0.07, w * 0.06, h * 0.5, 4, fill, stroke, lw);
        rrRect(ctx,  w * 0.42, -h * 0.07, w * 0.06, h * 0.5, 4, fill, stroke, lw);
        break;
      case "table":
        rrRect(ctx, -w * 0.45, -h * 0.18, w * 0.9, h * 0.2, 6, fill, stroke, lw);
        rrRect(ctx, -w * 0.38,  h * 0.02, legW, legH, 3, fill, stroke, lw);
        rrRect(ctx,  w * 0.36,  h * 0.02, legW, legH, 3, fill, stroke, lw);
        break;
      case "shelf":
        rrRect(ctx, -w * 0.5, -h * 0.28, w, h * 0.08, 4, fill, stroke, lw);
        rrRect(ctx, -w * 0.5, -h * 0.08, w, h * 0.08, 4, fill, stroke, lw);
        rrRect(ctx, -w * 0.5,  h * 0.12, w, h * 0.08, 4, fill, stroke, lw);
        rrRect(ctx, -w * 0.5, -h * 0.28, w * 0.04, h * 0.48, 4, fill, stroke, lw);
        rrRect(ctx,  w * 0.46, -h * 0.28, w * 0.04, h * 0.48, 4, fill, stroke, lw);
        break;
      case "bed":
        rrRect(ctx, -w * 0.5, -h * 0.18, w, h * 0.34, 8, fill, stroke, lw);
        rrRect(ctx, -w * 0.48, -h * 0.28, w * 0.4, h * 0.12, 6, fill, stroke, lw);
        rrRect(ctx,  w * 0.08, -h * 0.28, w * 0.4, h * 0.12, 6, fill, stroke, lw);
        break;
      case "fridge":
        rrRect(ctx, -w * 0.25, -h * 0.35, w * 0.5, h * 0.7, 8, fill, stroke, lw);
        rrRect(ctx,  w * 0.1,  -h * 0.18, w * 0.04, h * 0.26, 3, fill, stroke, lw);
        rrRect(ctx,  w * 0.1,   h * 0.1,  w * 0.04, h * 0.22, 3, fill, stroke, lw);
        break;
      case "island":
        rrRect(ctx, -w * 0.45, -h * 0.18, w * 0.9, h * 0.36, 8, fill, stroke, lw);
        rrRect(ctx, -w * 0.48, -h * 0.24, w * 0.96, h * 0.08, 6, fill, stroke, lw);
        break;
      case "sink":
        rrRect(ctx, -w * 0.22, -h * 0.14, w * 0.44, h * 0.28, 10, fill, stroke, lw);
        rrRect(ctx,  0,        -h * 0.22, w * 0.16, h * 0.1,  6, fill, stroke, lw);
        break;
      case "toilet":
        rrRect(ctx, -w * 0.2,  -h * 0.12, w * 0.4, h * 0.24, 10, fill, stroke, lw);
        rrRect(ctx, -w * 0.18, -h * 0.3,  w * 0.36, h * 0.16, 6, fill, stroke, lw);
        break;
      case "bathtub":
        rrRect(ctx, -w * 0.48, -h * 0.16, w * 0.96, h * 0.32, 14, fill, stroke, lw);
        rrRect(ctx,  w * 0.28, -h * 0.26, w * 0.2,  h * 0.1,  6, fill, stroke, lw);
        break;
      default: //fallback 
        rrRect(ctx, -w * 0.5, -h * 0.25, w, h * 0.18, 6, fill, stroke, lw);
        rrRect(ctx, -w * 0.48, -h * 0.07, w * 0.06, h * 0.5, 4, fill, stroke, lw);
        rrRect(ctx,  w * 0.42, -h * 0.07, w * 0.06, h * 0.5, 4, fill, stroke, lw);
    }

    ctx.restore();
  };


  //draw a single card
  const drawChip = (ctx, c) => {
    const { x, y, w, h, stage, type } = c;
    const r = Math.min(16, Math.min(w, h) * 0.18);
    const lw = Math.max(1.2, w * 0.015);

    // base
    ctx.beginPath();
    roundRectPath(ctx, x - w / 2, y - h / 2, w, h, r);
    ctx.fillStyle = "rgba(15,19,26,0.55)";
    ctx.fill();
    ctx.lineWidth = lw;

    //bounds
    const innerW = w * 0.66;
    const innerH = h * 0.42;
    const cx = x, cy = y + 2;

    //styles
    if (stage === 0) {
      // Outline
      ctx.strokeStyle = COLS.outline;
      ctx.stroke();
      drawGlyph(ctx, type, cx, cy, innerW, innerH, { fill: null, stroke: COLS.outline, lw });
    } else if (stage === 1) {
      // Highlight
      ctx.strokeStyle = COLS.highlight;
      ctx.shadowColor = COLS.highlight;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawGlyph(ctx, type, cx, cy, innerW, innerH, { fill: "rgba(85,187,255,0.12)", stroke: COLS.highlight, lw });
    } else if (stage === 2) {
      // Solid
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.stroke();
      drawGlyph(ctx, type, cx, cy, innerW, innerH, { fill: COLS.solidFill, stroke: COLS.solidStroke, lw });
    } else {
      // OBJ label
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.stroke();
      drawGlyph(ctx, type, cx, cy, innerW, innerH, { fill: COLS.objFill, stroke: COLS.objStroke, lw });
      ctx.fillStyle = "rgba(232,236,255,0.9)";
      ctx.font = `${Math.max(10, Math.round(w * 0.08))}px ui-sans-serif, system-ui`;
      ctx.fillText("OBJ", x - w * 0.46, y - h * 0.36);
    }
  };

  //Animation tick
  const tick = (ts) => {
    const st = stateRef.current;
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (!st.lastT) st.lastT = ts;
    const dt = Math.min(0.05, (ts - st.lastT) / 1000);
    st.lastT = ts;

    ctx.clearRect(0, 0, st.w, st.h);

    for (const row of st.rows) {
      const v = row.speed;
      const dir = row.dir;

      for (const c of row.chips) {
        c.x += dir * v * dt;

        //wrap around
        if (dir === 1 && c.x - c.w / 2 > st.w + row.CW * 2) c.x -= row.loopLen;
        else if (dir === -1 && c.x + c.w / 2 < -row.CW * 2) c.x += row.loopLen;

        drawChip(ctx, c);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  };

 
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: cover === "viewport" ? "fixed" : "absolute",
        inset: 0,
        zIndex: 0,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
