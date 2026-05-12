"use client";
import React, { useRef, useState, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Rect, Group, Image as KImage, Line, Text as KText } from "react-konva";
import { Transformer } from "react-konva";
import useImage from "use-image";
import { useBoardStore } from "@/contexts/boardStore";
import { toMoodboardDisplaySrc } from "@/utils/moodboardMedia";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const BASE = { w: 900, h: 600 };

const TEXT_LINE_HEIGHT = 1.2;
const TEXT_CORNER_ANCHORS = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);
const TEXT_HSIDE_ANCHORS = new Set(["middle-left", "middle-right"]);
const TEXT_VSIDE_ANCHORS = new Set(["top-center", "bottom-center"]);
const TEXT_MIN_W = 120;

const clampNum = (n, min, max) => Math.max(min, Math.min(max, n));

let textMeasureCanvas = null;

// helper to measure text height
const getTextAutoHeight = (text, fontSize = 28, lineHeight = TEXT_LINE_HEIGHT) => {
  const lines = String(text ?? "").split("\n").length || 1;
  return Math.max(1, Math.ceil(lines * fontSize * lineHeight));
};

// helper to estimate wrapped text height for a given width
const getWrappedTextHeightForWidth = (text, maxW, fontSize, fontFamily, lineHeight) => {
  const w = Math.max(1, maxW);

  if (typeof document === "undefined") {
    return getTextAutoHeight(text, fontSize, lineHeight);
  }

  if (!textMeasureCanvas) textMeasureCanvas = document.createElement("canvas");
  const ctx = textMeasureCanvas.getContext("2d");
  if (!ctx) return getTextAutoHeight(text, fontSize, lineHeight);

  ctx.font = `${fontSize}px ${fontFamily}`;

  const paragraphs = String(text ?? "").split("\n");
  let lines = 0;

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines += 1;
      continue;
    }

    let curW = 0;
    for (const ch of para) {
      const cw = ctx.measureText(ch).width;
      if (curW > 0 && curW + cw > w) {
        lines += 1;
        curW = cw;
      } 
      else {
        curW += cw;
      }
    }
    lines += 1;
  }

  return Math.max(1, Math.ceil(lines * fontSize * lineHeight));
};


// render component for items
function ItemImage({ item, moodboardId, onSelect, onMove, onTransform }) {
  const safeSrc = useMemo(
    () => toMoodboardDisplaySrc(item?.src, moodboardId),
    [item?.src, moodboardId]
  );

  const [img] = useImage(safeSrc, "anonymous");
  const { selectedId, mode } = useBoardStore();

  if (!img) return null;

  const isCroppingThis = mode === "crop" && selectedId === item.id;

  // While cropping this item, let the CropHUD render its own full image.
  if (isCroppingThis) {
    return null;
  }

  return (
    <Group
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rot}
      onMouseDown={(e) => {
        if (mode === "bg") return;
        if (mode === "crop" && selectedId !== item.id) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onTap={(e) => {
        if (mode === "bg") return;
        if (mode === 'crop' && selectedId !== item.id) {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onDragEnd={(e) => onMove(item.id, e.target.x(), e.target.y())}
      onTransformEnd={(e) => onTransform(item.id, e.target)}
      draggable={mode !== "crop" && mode !== "bg" && !item.locked}
    >
      {item.shadow && (
        <KImage
          image={img}
          width={item.w ?? undefined}
          height={item.h ?? undefined}
          scaleX={1}
          offsetX={0}
          shadowColor="#000"
          shadowOpacity={0.28}
          shadowBlur={16}
          shadowOffsetY={14}
          crop={item.crop || undefined}
        />
      )}

      <KImage
        image={img}
        width={item.w ?? undefined}
        height={item.h ?? undefined}
        scaleX={item.flipX ? -1 : 1}
        offsetX={item.flipX ? (item.w ?? 0) : 0}
        crop={item.crop || undefined}
      />
    </Group>
  );
}

// render component for drawings
function ItemDrawing({ item, onSelect, onMove, onTransform }) {
  const { mode, selectedId } = useBoardStore();
  const groupRef = useRef(null);

  const w = item.w || 1;
  const h = item.h || 1;
  const offsetX = item._cropOffsetX || 0;
  const offsetY = item._cropOffsetY || 0;

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    node.getClientRect = function ({ relativeTo, skipTransform } = {}) {
      const rect = { x: 0, y: 0, width: w, height: h };
      if (skipTransform) return rect;
      return node._transformedRect
        ? node._transformedRect(rect, relativeTo)
        : (() => {
            const t = relativeTo
              ? node.getAbsoluteTransform(relativeTo).copy()
              : node.getTransform().copy();
            const p1 = t.point({ x: rect.x, y: rect.y });
            const p2 = t.point({ x: rect.x + rect.width, y: rect.y });
            const p3 = t.point({ x: rect.x + rect.width, y: rect.y + rect.height });
            const p4 = t.point({ x: rect.x, y: rect.y + rect.height });
            const xs = [p1.x, p2.x, p3.x, p4.x];
            const ys = [p1.y, p2.y, p3.y, p4.y];
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return {
              x: minX,
              y: minY,
              width: Math.max(...xs) - minX,
              height: Math.max(...ys) - minY,
            };
          })();
    };
  }, [w, h]);

  if (mode === "crop" && selectedId === item.id) return null;

  return (
    // Clip on the outer Group so the Line (which may render outside [0..w, 0..h]
    // when cropped) is visually cropped. Transformer bounds are forced via
    // getClientRect override above.
    <Group
      id={item.id}
      ref={groupRef}
      x={item.x}
      y={item.y}
      rotation={item.rot}
      clipX={0}
      clipY={0}
      clipWidth={w}
      clipHeight={h}
      draggable={mode !== "crop" && mode !== "draw" && mode !== "bg" && !item.locked}
      onMouseDown={(e) => {
        if (mode === "bg") return;
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onTap={(e) => {
        if (mode === "bg") return;
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onDragEnd={(e) => onMove(item.id, e.target.x(), e.target.y())}
      onTransformEnd={(e) => onTransform(item.id, e.target)}
    >
      <Rect
        name="drawingHitbox"
        x={0}
        y={0}
        width={w}
        height={h}
        opacity={0}
        listening
      />

      <Group
        scaleX={item.flipX ? -1 : 1}
        offsetX={item.flipX ? w : 0}
        listening={false}
      >
        <Line
          name="drawingLine"
          x={-offsetX}
          y={-offsetY}
          points={item.points || []}
          stroke="#000"
          strokeWidth={item.strokeWidth || 5}
          lineCap="round"
          lineJoin="round"
          tension={0.22}
          perfectDrawEnabled={false}
          listening={false}
          shadowColor={item.shadow ? "#000" : undefined}
          shadowOpacity={item.shadow ? 0.28 : undefined}
          shadowBlur={item.shadow ? 16 : undefined}
          shadowOffsetY={item.shadow ? 14 : undefined}
        />
      </Group>
    </Group>
  );
}

// render component for text boxes
function ItemText({ item, onSelect, onMove, onTransformStart, onTransformLive, onTransformEnd, onEdit, isEditing = false }) {
  const { mode } = useBoardStore();

  const lineHeight = item.lineHeight || TEXT_LINE_HEIGHT;
  const fontSize = item.fontSize || 28;
  const fontFamily = item.fontFamily || "Arial";
  const w = Math.max(TEXT_MIN_W, item.w || 1);

  const cropOffsetX = item._cropOffsetX || 0;
  const cropOffsetY = item._cropOffsetY || 0;
  const hasCrop = !!(cropOffsetX || cropOffsetY);

  const neededH = getWrappedTextHeightForWidth(
    item.text || "",
    w,
    fontSize,
    fontFamily,
    lineHeight
  );

  const hitH = hasCrop ? Math.max(1, item.h ?? 1) : Math.max(1, item.h ?? 0, neededH);
  const textH = Math.max(hitH, neededH);

  return (
    <Group
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rot}
      clipX={0}
      clipY={0}
      clipWidth={w}
      clipHeight={hitH}
      draggable={mode !== "crop" && mode !== "bg" && !item.locked}
      onMouseDown={(e) => {
        if (mode === "bg") return;
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onTap={(e) => {
        if (mode === "bg") return;
        onSelect(item.id);
        e.cancelBubble = true;
      }}
      onDblClick={(e) => {
        if (mode === "bg" || item.locked) return;
        onEdit(item, e);
        e.cancelBubble = true;
      }}
      onDragEnd={(e) => onMove(item.id, e.target.x(), e.target.y())}
      onTransformStart={() => onTransformStart?.(item.id)}
      onTransform={(e) => onTransformLive?.(item.id, e.target)}
      onTransformEnd={(e) => onTransformEnd?.(item.id, e.target)}
    >
      <Rect x={0} y={0} width={w} height={hitH} opacity={0} listening />

      <KText
        visible={!isEditing}
        text={item.text || ""}
        x={-cropOffsetX}
        y={-cropOffsetY}
        width={w}
        height={textH}
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        wrap="char"
        fill="#000"
        shadowColor={item.shadow ? "#000" : undefined}
        shadowOpacity={item.shadow ? 0.28 : undefined}
        shadowBlur={item.shadow ? 16 : undefined}
        shadowOffsetY={item.shadow ? 14 : undefined}
      />
    </Group>
  );
}

// bounding box for selected item
function SelectionTransformer({ selectedId, mode }) {
  const transformerRef = useRef();
  const rafRef = useRef(null);
  const items = useBoardStore((s) => s.items);

  const selectedItem = items.find((item) => item.id === selectedId);

  useEffect(() => {
    const t = transformerRef.current;
    if (!t) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (mode === "crop" || mode === "bg" || !selectedId || selectedItem?.hidden) {
      t.nodes([]);
      t.getLayer()?.batchDraw();
      return;
    }

    const attachLoop = () => {
      const stage = t.getStage();
      if (!stage) {
        rafRef.current = requestAnimationFrame(attachLoop);
        return;
      }

      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        t.nodes([node]);
        t.getLayer()?.batchDraw();
        rafRef.current = null;
      } else {
        t.nodes([]);
        t.getLayer()?.batchDraw();
        rafRef.current = requestAnimationFrame(attachLoop);
      }
    };

    rafRef.current = requestAnimationFrame(attachLoop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [selectedId, items, mode, selectedItem?.hidden]);

  if (mode === "crop" || mode === "bg" || selectedItem?.hidden) return null;

  const forceRatio = selectedItem?.kind === "image" || selectedItem?.kind === "drawing";

  // boundBoxFunc fires on every pointer move during resize, enforcing aspect
  // ratio for image/drawing items. For edge-only drags (top/bottom or left/right)
  // it also keeps the item centered on the perpendicular axis so both sides
  // expand/shrink equally instead of anchoring to one edge.
  const boundBoxFunc = forceRatio
    ? (oldBox, newBox) => {
        const wDiff = Math.abs(newBox.width - oldBox.width);
        const hDiff = Math.abs(newBox.height - oldBox.height);

        // Pure rotation (or no change) — pass through so rotation pivots normally
        if (wDiff < 0.5 && hDiff < 0.5) return newBox;

        const ratio = oldBox.width / oldBox.height;
        const isWidthDriven = wDiff >= hDiff;

        // Constrain to aspect ratio
        let result = isWidthDriven
          ? { ...newBox, height: newBox.width / ratio }
          : { ...newBox, width: newBox.height * ratio };

        // Edge drag: one raw dimension barely changed — center on that axis
        const isEdgeDrag = wDiff < 0.5 || hDiff < 0.5;
        if (isEdgeDrag) {
          if (hDiff >= wDiff) {
            // top/bottom edge → keep center X fixed
            const cx = oldBox.x + oldBox.width / 2;
            result = { ...result, x: cx - result.width / 2 };
          } else {
            // left/right edge → keep center Y fixed
            const cy = oldBox.y + oldBox.height / 2;
            result = { ...result, y: cy - result.height / 2 };
          }
        }

        return result;
      }
    : undefined;

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled={!selectedItem?.locked}
      resizeEnabled={!selectedItem?.locked}
      enabledAnchors={selectedItem?.locked ? [] : undefined}
      keepRatio={forceRatio}
      boundBoxFunc={boundBoxFunc}
    />
  );
}

// HUD component for crop mode
function CropHUD({ item, moodboardId, onApply, onCancel }) {
  const hudRef = useRef(null);
  const [cornerDrag, setCornerDrag] = React.useState(null);
  const displaySrc = useMemo(
    () => toMoodboardDisplaySrc(item?.src, moodboardId),
    [item?.src, moodboardId]
  );
  const [img] = useImage(displaySrc, "anonymous");
    
  const [checkIcon] = useImage("/icons/check-white.svg");
  const [crossIcon] = useImage("/icons/cross-white.svg");

  // map between canvas space and source pixels
  const { frameW, frameH, scaleX, scaleY } = useMemo(() => {
    if (!img) {
      const w = item.w || 0;
      const h = item.h || 0;
      return { frameW: w, frameH: h, scaleX: 1, scaleY: 1 };
    }

    // no prior crop: current frame is already the full image
    if (!item.crop) {
      const w = item.w || img.width;
      const h = item.h || img.height;
      return {
        frameW: w,
        frameH: h,
        scaleX: img.width / w,
        scaleY: img.height / h,
      };
    }

    // if there is an existing crop reconstruct the full-frame size at current scale
    const c = item.crop;
    if (!c.width || !c.height) {
      const w = item.w || img.width;
      const h = item.h || img.height;
      return {
        frameW: w,
        frameH: h,
        scaleX: img.width / w,
        scaleY: img.height / h,
      };
    }

    const sX = (item.w || 0) / c.width || 0;
    const sY = (item.h || 0) / c.height || 0;
    let s = sX || sY || 1;
    if (sX && sY) s = (sX + sY) / 2;

    const frameW = img.width * s;
    const frameH = img.height * s;

    return {
      frameW,
      frameH,
      scaleX: img.width / frameW,
      scaleY: img.height / frameH,
    };
  }, [img, item.w, item.h, item.crop]);

  // start from existing crop, expressed in full-frame canvas coords
  const initBox = useMemo(() => {
    const w = frameW;
    const h = frameH;
    if (!img) return { x: 0, y: 0, w, h };
    if (!item.crop) return { x: 0, y: 0, w, h };

    const c = item.crop;
    const sx = w / img.width;
    const sy = h / img.height;
    const boxW = c.width * sx;
    const boxH = c.height * sy;
    const xCanvas = item.flipX ? w - (c.x + c.width) * sx : c.x * sx;
    const yCanvas = c.y * sy;
    return { x: xCanvas, y: yCanvas, w: boxW, h: boxH };
  }, [img, frameW, frameH, item.crop, item.flipX]);

  const [box, setBox] = useState(initBox);
  useEffect(() => setBox(initBox), [initBox]);

  // keep box within the item bounds
  const maxW = frameW;
  const maxH = frameH;
  const clamp = (b) => {
    const minW = 6 / scaleX;
    const minH = 6 / scaleY;
    const x = Math.max(0, Math.min(b.x, maxW));
    const y = Math.max(0, Math.min(b.y, maxH));
    const w = Math.max(minW, Math.min(b.w, maxW - x));
    const h = Math.max(minH, Math.min(b.h, maxH - y));
    return { x, y, w, h };
  };

  // where would the top-left of the uncropped image be on the canvas?
  const fullOrigin = useMemo(() => {
    if (!img) return { x: item.x, y: item.y };

    // no prior crop -> current position is already the full origin
    if (!item.crop) return { x: item.x, y: item.y };

    const prevBox = initBox;

    const toRad = (d) => (d * Math.PI) / 180;
    const theta = toRad(item.rot || 0);

    const dxLocal = prevBox.x;
    const dyLocal = prevBox.y;
    const dx = dxLocal * Math.cos(theta) - dyLocal * Math.sin(theta);
    const dy = dxLocal * Math.sin(theta) + dyLocal * Math.cos(theta);

    return {
      x: item.x - dx,
      y: item.y - dy,
    };
  }, [img, item.x, item.y, item.rot, item.flipX, item.crop, initBox]);


  const setL = (x) => setBox(b => clamp({ ...b, w: b.w + (b.x - x), x }));
  const setR = (x) => setBox(b => clamp({ ...b, w: x - b.x }));
  const setT = (y) => setBox(b => clamp({ ...b, h: b.h + (b.y - y), y }));
  const setB = (y) => setBox(b => clamp({ ...b, h: y - b.y }));

  // compute crop in source pixels and pass the canvas-local box
  const handleApply = React.useCallback(() => {
    if (!img) return;

    // crop rectangle in source pixels
    const xPxRaw = box.x * scaleX;
    const xPx = item.flipX ? img.width - xPxRaw - box.w * scaleX : xPxRaw;
    const cropPx = {
      x: Math.round(xPx),
      y: Math.round(box.y * scaleY),
      width: Math.round(box.w * scaleX),
      height: Math.round(box.h * scaleY),
    };

    // new frame in canvas coordinates, computed from the full-origin
    const toRad = (d) => (d * Math.PI) / 180;
    const theta = toRad(item.rot || 0);
    const dxLocal = box.x;
    const dyLocal = box.y;
    const dx = dxLocal * Math.cos(theta) - dyLocal * Math.sin(theta);
    const dy = dxLocal * Math.sin(theta) + dyLocal * Math.cos(theta);

    const nextFrame = {
      x: fullOrigin.x + dx,
      y: fullOrigin.y + dy,
      w: box.w,
      h: box.h,
    };

    onApply(cropPx, nextFrame);
  }, [img, box, scaleX, scaleY, item.flipX, item.rot, fullOrigin, onApply]);

  // enter / esc shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") handleApply();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, handleApply]);

  // stage-level pointer capture for smooth dragging
  useEffect(() => {
    if (!cornerDrag) return;
    const stage = hudRef.current.getStage();

    const onMove = () => {
      const p = toLocalPoint();
      cornerDrag.drag(p.x, p.y); 
    };
    const end = () => setCornerDrag(null);

    stage.on('mousemove touchmove', onMove);
    stage.on('mouseup touchend', end);

    return () => {
      stage.off('mousemove touchmove', onMove);
      stage.off('mouseup touchend', end);
    };
  }, [cornerDrag]);

  const HANDLE_FILL = "#555";
  const hit = 28;
  const knob = 22;
  const k = 6;
  const arm = 22
  const EPS = 1;
  const inset = 1;

  // helper to get HUD-local coords from current pointer
  const toLocalPoint = () => {
    const stage = hudRef.current.getStage();
    const pt = stage.getPointerPosition();
    const inv = hudRef.current.getAbsoluteTransform().copy().invert();
    return inv.point(pt);
  };
  
  // L-shaped corner
  const Corner = ({ getCorner, dirX, dirY, drag }) => {
    const { cx, cy } = getCorner();
    const sx = Math.round(cx);
    const sy = Math.round(cy);

    const isRight  = dirX < 0; 
    const isBottom = dirY < 0; 

    // horizontal arm
    const horizX = isRight ? sx - (arm + EPS) : sx;
    const horizY = isBottom ? sy - k : sy;      
    const horizW = arm + EPS;

    // vertical arm
    const vertX  = isRight ? sx - k : sx;   
    const vertY  = isBottom ? sy - (arm + EPS) : sy; 
    const vertH  = arm + EPS;

    return (
      <Group>
        <Rect x={horizX} y={horizY} width={horizW} height={k} fill={HANDLE_FILL} listening={false}/>
        <Rect x={vertX}  y={vertY}  width={k}      height={vertH} fill={HANDLE_FILL} listening={false}/>

        {/* hit area to start continuous drag */}
        <Rect
          x={sx - 16} y={sy - 16} width={32} height={32}
          opacity={0}
          onMouseDown={(e)=>{ e.cancelBubble = true; setCornerDrag({ drag }); }}
          onTouchStart={(e)=>{ e.cancelBubble = true; setCornerDrag({ drag }); }}
        />
      </Group>
    );
  };

  const gridX = [box.x + box.w/3, box.x + (2*box.w)/3];
  const gridY = [box.y + box.h/3, box.y + (2*box.h)/3];

  return (
    <Group
      ref={hudRef}
      x={fullOrigin.x}
      y={fullOrigin.y}
      rotation={item.rot}
    >
      {/* the full, uncropped image at the reconstructed frame size */}
      {img && (
        <KImage
          image={img}
          x={0}
          y={0}
          width={frameW}
          height={frameH}
          scaleX={item.flipX ? -1 : 1}
          offsetX={item.flipX ? frameW : 0}
          listening={false}
        />
      )}

      {/* Dim area outside the crop box */}
      {/* Top */}
      <Rect
        x={0}
        y={0}
        width={frameW}
        height={box.y}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />
      {/* Bottom */}
      <Rect
        x={0}
        y={box.y + box.h}
        width={frameW}
        height={Math.max(0, frameH - (box.y + box.h))}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />
      {/* Left */}
      <Rect
        x={0}
        y={box.y}
        width={box.x}
        height={box.h}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />
      {/* Right */}
      <Rect
        x={box.x + box.w}
        y={box.y}
        width={Math.max(0, frameW - (box.x + box.w))}
        height={box.h}
        fill="rgba(0,0,0,0.35)"
        listening={false}
      />

      {/* Outline */}
      <Rect 
        x={box.x} 
        y={box.y}
        width={box.w} 
        height={box.h} 
        stroke="#20A4F3" 
        strokeWidth={2} 
        listening={false} 
      />

      {/* 3x3 grid */}
      {gridX.map((gx,i)=>(
        <Line key={`gx${i}`} points={[gx, box.y, gx, box.y + box.h]} stroke="rgba(255,255,255)" strokeWidth={1}/>
      ))}
      {gridY.map((gy,i)=>(
        <Line key={`gy${i}`} points={[box.x, gy, box.x + box.w, gy]} stroke="rgba(255,255,255)" strokeWidth={1}/>
      ))}
      
      {/* Edge controls */}
      {/* Top */}
      <Group>
        <Rect
          x={box.x} y={box.y - hit/2} width={box.w} height={hit}
          opacity={0} draggable
          dragBoundFunc={(pos)=>({ x: box.x, y: pos.y })}
          onDragMove={(e)=>{ e.cancelBubble = true; const p = toLocalPoint(e); setT(p.y); }}
          onDragEnd={(e)=>{ e.cancelBubble = true; e.target.position({ x: box.x, y: box.y - hit/2 }); }}
        />
        <Rect
          x={box.x + box.w/2 - knob/2}
          y={box.y + inset}
          width={knob}
          height={k}
          fill={HANDLE_FILL}
          listening={false}
        />
      </Group>
      {/* Bottom */}
      <Group>
        <Rect
          x={box.x} y={box.y + box.h - hit/2} width={box.w} height={hit}
          opacity={0} draggable
          dragBoundFunc={(pos)=>({ x: box.x, y: pos.y })}
          onDragMove={(e)=>{ e.cancelBubble = true; const p = toLocalPoint(e); setB(p.y); }}
          onDragEnd={(e)=>{ e.cancelBubble = true; e.target.position({ x: box.x, y: box.y + box.h - hit/2 }); }}
        />
        <Rect
          x={box.x + box.w/2 - knob/2}
          y={box.y + box.h - k - inset}
          width={knob}
          height={k}
          fill={HANDLE_FILL}
          listening={false}
        />
      </Group>
      {/* Left */}
      <Group>
        <Rect
          x={box.x - hit/2} y={box.y} width={hit} height={box.h}
          opacity={0} draggable
          dragBoundFunc={(pos)=>({ x: pos.x, y: box.y })}
          onDragMove={(e)=>{ e.cancelBubble = true; const p = toLocalPoint(e); setL(p.x); }}
          onDragEnd={(e)=>{ e.cancelBubble = true; e.target.position({ x: box.x - hit/2, y: box.y }); }}
        />
        <Rect
          x={box.x + inset}
          y={box.y + box.h/2 - knob/2}
          width={k}
          height={knob}
          fill={HANDLE_FILL}
          listening={false}
        />
      </Group>
      {/* Right */}
      <Group>
        <Rect
          x={box.x + box.w - hit/2} y={box.y} width={hit} height={box.h}
          opacity={0} draggable
          dragBoundFunc={(pos)=>({ x: pos.x, y: box.y })}
          onDragMove={(e)=>{ e.cancelBubble = true; const p = toLocalPoint(e); setR(p.x); }}
          onDragEnd={(e)=>{ e.cancelBubble = true; e.target.position({ x: box.x + box.w - hit/2, y: box.y }); }}
        />
        <Rect
          x={box.x + box.w - k - inset}
          y={box.y + box.h/2 - knob/2}
          width={k}
          height={knob}
          fill={HANDLE_FILL}
          listening={false}
        />
      </Group>

      {/* Corners */}
      <Corner getCorner={()=>({cx: box.x,           cy: box.y         })} dirX={+1} dirY={+1} drag={(x,y)=>{ setL(x); setT(y); }} />
      <Corner getCorner={()=>({cx: box.x + box.w,   cy: box.y         })} dirX={-1} dirY={+1} drag={(x,y)=>{ setR(x); setT(y); }} />
      <Corner getCorner={()=>({cx: box.x,           cy: box.y + box.h })} dirX={+1} dirY={-1} drag={(x,y)=>{ setL(x); setB(y); }} />
      <Corner getCorner={()=>({cx: box.x + box.w,   cy: box.y + box.h })} dirX={-1} dirY={-1} drag={(x,y)=>{ setR(x); setB(y); }} />

      {/* Apply button */}
      <Group
        x={box.x + box.w + 8}
        y={box.y - 4}
        onClick={handleApply}
      >
        <Rect
          width={28}
          height={28}
          cornerRadius={16}
          fill="#22C55E" 
          opacity={0.95}
        />

        {checkIcon && (
          <KImage
            image={checkIcon}
            x={5}
            y={4}
            width={18}
            height={18}
            listening={false}
          />
        )}
      </Group>

      {/* Cancel button */}
      <Group
        x={box.x - 8 - 28} 
        y={box.y - 4}
        onClick={onCancel}
      >
        <Rect
          width={28}
          height={28}
          cornerRadius={16}
          fill="#EF4444"  
          opacity={0.95}
        />

        {crossIcon && (
          <KImage
            image={crossIcon}
            x={7}
            y={7}
            width={14}
            height={14}
            listening={false}
          />
        )}
      </Group>

    </Group>
  );
}

// HUD component for crop mode on text/drawing items
function CropHUDShape({ item, onApply, onCancel }) {
  const hudRef = useRef(null);
  const [cornerDrag, setCornerDrag] = React.useState(null);
  const [checkIcon] = useImage("/icons/check-white.svg");
  const [crossIcon] = useImage("/icons/cross-white.svg");

  // original frame size — stored on first crop, falls back to current size
  const frameW = item._origW ?? item.w ?? 1;
  const frameH = item._origH ?? item.h ?? 1;

  const cX = item._cropOffsetX || 0;
  const cY = item._cropOffsetY || 0;
  const visOffsetX =
    item.flipX && item.kind === "drawing"
      ? frameW - cX - (item.w || 0)
      : cX;

  // reconstruct the original item's world origin 
  const fullOrigin = useMemo(() => {
    const theta = ((item.rot || 0) * Math.PI) / 180;
    const dx = visOffsetX * Math.cos(theta) - cY * Math.sin(theta);
    const dy = visOffsetX * Math.sin(theta) + cY * Math.cos(theta);
    return { x: item.x - dx, y: item.y - dy };
  }, [item.x, item.y, item.rot, visOffsetX, cY]);

  // show existing crop region inside the full frame
  const initBox = useMemo(
    () => ({ x: visOffsetX, y: cY, w: item.w || 1, h: item.h || 1 }),
    [visOffsetX, cY, item.w, item.h]
  );
  const [box, setBox] = useState(initBox);
  useEffect(() => setBox(initBox), [initBox]);

  const clamp = useCallback((b) => {
    const x = Math.max(0, Math.min(b.x, frameW));
    const y = Math.max(0, Math.min(b.y, frameH));
    const w = Math.max(6, Math.min(b.w, frameW - x));
    const h = Math.max(6, Math.min(b.h, frameH - y));
    return { x, y, w, h };
  }, [frameW, frameH]);

  const setL = (x) => setBox((b) => clamp({ ...b, w: b.w + (b.x - x), x }));
  const setR = (x) => setBox((b) => clamp({ ...b, w: x - b.x }));
  const setT = (y) => setBox((b) => clamp({ ...b, h: b.h + (b.y - y), y }));
  const setB = (y) => setBox((b) => clamp({ ...b, h: y - b.y }));

  const handleApply = React.useCallback(() => {
    onApply(box);
  }, [box, onApply]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") handleApply();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, handleApply]);

  const toLocalPoint = () => {
    const stage = hudRef.current.getStage();
    const pt = stage.getPointerPosition();
    const inv = hudRef.current.getAbsoluteTransform().copy().invert();
    return inv.point(pt);
  };

  useEffect(() => {
    if (!cornerDrag) return;
    const stage = hudRef.current.getStage();
    const onMove = () => {
      const p = toLocalPoint();
      cornerDrag.drag(p.x, p.y);
    };
    const end = () => setCornerDrag(null);
    stage.on("mousemove touchmove", onMove);
    stage.on("mouseup touchend", end);
    return () => {
      stage.off("mousemove touchmove", onMove);
      stage.off("mouseup touchend", end);
    };
  }, [cornerDrag]);

  const HANDLE_FILL = "#555";
  const hit = 28;
  const knob = 22;
  const k = 6;
  const arm = 22;
  const EPS = 1;
  const inset = 1;

  const Corner = ({ getCorner, dirX, dirY, drag }) => {
    const { cx, cy } = getCorner();
    const sx = Math.round(cx);
    const sy = Math.round(cy);
    const isRight  = dirX < 0;
    const isBottom = dirY < 0;
    const horizX = isRight ? sx - (arm + EPS) : sx;
    const horizY = isBottom ? sy - k : sy;
    const vertX  = isRight ? sx - k : sx;
    const vertY  = isBottom ? sy - (arm + EPS) : sy;
    return (
      <Group>
        <Rect x={horizX} y={horizY} width={arm + EPS} height={k} fill={HANDLE_FILL} listening={false} />
        <Rect x={vertX}  y={vertY}  width={k} height={arm + EPS} fill={HANDLE_FILL} listening={false} />
        <Rect
          x={sx - 16} y={sy - 16} width={32} height={32}
          opacity={0}
          onMouseDown={(e) => { e.cancelBubble = true; setCornerDrag({ drag }); }}
          onTouchStart={(e) => { e.cancelBubble = true; setCornerDrag({ drag }); }}
        />
      </Group>
    );
  };

  const gridX = [box.x + box.w / 3, box.x + (2 * box.w) / 3];
  const gridY = [box.y + box.h / 3, box.y + (2 * box.h) / 3];

  return (
    <Group ref={hudRef} x={fullOrigin.x} y={fullOrigin.y} rotation={item.rot || 0}>
      <Group clipX={0} clipY={0} clipWidth={frameW} clipHeight={frameH} listening={false}>
        {item.kind === "drawing" && (
          <Group
            scaleX={item.flipX ? -1 : 1}
            offsetX={item.flipX ? frameW : 0}
          >
            <Line
              points={item.points || []}
              stroke="#000"
              strokeWidth={item.strokeWidth || 5}
              lineCap="round"
              lineJoin="round"
              tension={0.22}
              perfectDrawEnabled={false}
            />
          </Group>
        )}
        {item.kind === "text" && (
          <KText
            text={item.text || ""}
            x={0}
            y={0}
            width={Math.max(TEXT_MIN_W, frameW)}
            fontSize={item.fontSize || 28}
            fontFamily={item.fontFamily || "Arial"}
            lineHeight={item.lineHeight || TEXT_LINE_HEIGHT}
            wrap="char"
            fill="#000"
          />
        )}
      </Group>

      {/* Dim overlays outside the crop box */}
      <Rect x={0} y={0} width={frameW} height={box.y} fill="rgba(0,0,0,0.35)" listening={false} />
      <Rect x={0} y={box.y + box.h} width={frameW} height={Math.max(0, frameH - (box.y + box.h))} fill="rgba(0,0,0,0.35)" listening={false} />
      <Rect x={0} y={box.y} width={box.x} height={box.h} fill="rgba(0,0,0,0.35)" listening={false} />
      <Rect x={box.x + box.w} y={box.y} width={Math.max(0, frameW - (box.x + box.w))} height={box.h} fill="rgba(0,0,0,0.35)" listening={false} />

      {/* Crop box outline */}
      <Rect x={box.x} y={box.y} width={box.w} height={box.h} stroke="#20A4F3" strokeWidth={2} listening={false} />

      {/* 3x3 grid */}
      {gridX.map((gx, i) => (
        <Line key={`gx${i}`} points={[gx, box.y, gx, box.y + box.h]} stroke="rgba(255,255,255)" strokeWidth={1} />
      ))}
      {gridY.map((gy, i) => (
        <Line key={`gy${i}`} points={[box.x, gy, box.x + box.w, gy]} stroke="rgba(255,255,255)" strokeWidth={1} />
      ))}

      {/* Edge controls */}
      <Group>
        <Rect x={box.x} y={box.y - hit / 2} width={box.w} height={hit} opacity={0} draggable
          dragBoundFunc={(pos) => ({ x: box.x, y: pos.y })}
          onDragMove={(e) => { e.cancelBubble = true; const p = toLocalPoint(); setT(p.y); }}
          onDragEnd={(e) => { e.cancelBubble = true; e.target.position({ x: box.x, y: box.y - hit / 2 }); }}
        />
        <Rect x={box.x + box.w / 2 - knob / 2} y={box.y + inset} width={knob} height={k} fill={HANDLE_FILL} listening={false} />
      </Group>
      <Group>
        <Rect x={box.x} y={box.y + box.h - hit / 2} width={box.w} height={hit} opacity={0} draggable
          dragBoundFunc={(pos) => ({ x: box.x, y: pos.y })}
          onDragMove={(e) => { e.cancelBubble = true; const p = toLocalPoint(); setB(p.y); }}
          onDragEnd={(e) => { e.cancelBubble = true; e.target.position({ x: box.x, y: box.y + box.h - hit / 2 }); }}
        />
        <Rect x={box.x + box.w / 2 - knob / 2} y={box.y + box.h - k - inset} width={knob} height={k} fill={HANDLE_FILL} listening={false} />
      </Group>
      <Group>
        <Rect x={box.x - hit / 2} y={box.y} width={hit} height={box.h} opacity={0} draggable
          dragBoundFunc={(pos) => ({ x: pos.x, y: box.y })}
          onDragMove={(e) => { e.cancelBubble = true; const p = toLocalPoint(); setL(p.x); }}
          onDragEnd={(e) => { e.cancelBubble = true; e.target.position({ x: box.x - hit / 2, y: box.y }); }}
        />
        <Rect x={box.x + inset} y={box.y + box.h / 2 - knob / 2} width={k} height={knob} fill={HANDLE_FILL} listening={false} />
      </Group>
      <Group>
        <Rect x={box.x + box.w - hit / 2} y={box.y} width={hit} height={box.h} opacity={0} draggable
          dragBoundFunc={(pos) => ({ x: pos.x, y: box.y })}
          onDragMove={(e) => { e.cancelBubble = true; const p = toLocalPoint(); setR(p.x); }}
          onDragEnd={(e) => { e.cancelBubble = true; e.target.position({ x: box.x + box.w - hit / 2, y: box.y }); }}
        />
        <Rect x={box.x + box.w - k - inset} y={box.y + box.h / 2 - knob / 2} width={k} height={knob} fill={HANDLE_FILL} listening={false} />
      </Group>

      {/* Corners */}
      <Corner getCorner={() => ({ cx: box.x,          cy: box.y         })} dirX={+1} dirY={+1} drag={(x, y) => { setL(x); setT(y); }} />
      <Corner getCorner={() => ({ cx: box.x + box.w,  cy: box.y         })} dirX={-1} dirY={+1} drag={(x, y) => { setR(x); setT(y); }} />
      <Corner getCorner={() => ({ cx: box.x,          cy: box.y + box.h })} dirX={+1} dirY={-1} drag={(x, y) => { setL(x); setB(y); }} />
      <Corner getCorner={() => ({ cx: box.x + box.w,  cy: box.y + box.h })} dirX={-1} dirY={-1} drag={(x, y) => { setR(x); setB(y); }} />

      {/* Apply button */}
      <Group x={box.x + box.w + 8} y={box.y - 4} onClick={handleApply}>
        <Rect width={28} height={28} cornerRadius={16} fill="#22C55E" opacity={0.95} />
        {checkIcon && <KImage image={checkIcon} x={5} y={4} width={18} height={18} listening={false} />}
      </Group>

      {/* Cancel button */}
      <Group x={box.x - 8 - 28} y={box.y - 4} onClick={onCancel}>
        <Rect width={28} height={28} cornerRadius={16} fill="#EF4444" opacity={0.95} />
        {crossIcon && <KImage image={crossIcon} x={7} y={7} width={14} height={14} listening={false} />}
      </Group>
    </Group>
  );
}


function BoardCanvas({ moodboardId, backgroundColor, onSceneReady }, ref) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);

  const [editingTextId, setEditingTextId] = useState(null);
  const textTransformHistoryRef = useRef(new Set());
  const textEditorRef = useRef(null);

  const drawingRef = useRef(null);

  const { items, setItems, selectedId, setSelected, deleteSelected, copySelected, pasteClipboard, applyCrop, applyShapeCrop, cancelCrop, pushHistory, undoAction, redoAction, setMode } = useBoardStore();
  const mode = useBoardStore((s) => s.mode);

  // compute intital canvas size for when switching back to board view
  const getInitialCanvasSize = () => {
    if (typeof window === "undefined") {
      return { w: BASE.w, h: BASE.h, scale: 1 };
    }

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxH = vh * 0.8;
    let h = Math.round(maxH);
    let w = Math.round((h * BASE.w) / BASE.h);

    const maxW = vw * 0.96;
    if (w > maxW) {
      w = Math.round(maxW);
      h = Math.round((w * BASE.h) / BASE.w);
    }

    return { w, h, scale: w / BASE.w };
  };

  const [size, setSize] = useState(getInitialCanvasSize);

  // wait for items to exist in store
  useEffect(() => {
    if (typeof onSceneReady !== "function") return;
    if (!items || items.length === 0) return;

    const imageItems = items.filter((it) => it.kind === "image");

    const waitForImages = async () => {
      await Promise.all(
        imageItems.map(
          (item) =>
            new Promise((resolve) => {
              const src = toMoodboardDisplaySrc(item?.src, moodboardId);
              if (!src) return resolve();

              const img = new window.Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = src;
            })
        )
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onSceneReady();
        });
      });
    };

    waitForImages();
  }, [items, moodboardId, onSceneReady]);

  // expose a thumbnail exporter to the parent
  useImperativeHandle(
    ref,
    () => ({
      exportThumbnail() {
        if (!stageRef.current) return null;
        const ratio = size.w ? BASE.w / size.w : 1;
        return stageRef.current.toDataURL({
          pixelRatio: ratio,
          mimeType: "image/jpeg",
          quality: 0.8,
        });
      },
      exportImage() {
        if (!stageRef.current) return null;

        return stageRef.current.toDataURL({
          pixelRatio: 2,
          mimeType: "image/png",
        });
      },
    }),
    [size.w]
  );

  // scale canvas to fit window (height-driven, falls back to width-driven on narrow viewports)
  const compute = useCallback(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxH = vh * 0.8;
    let h = Math.round(maxH);
    let w = Math.round((h * BASE.w) / BASE.h);

    const maxW = vw * 0.96;
    if (w > maxW) {
      w = Math.round(maxW);
      h = Math.round((w * BASE.h) / BASE.w);
    }

    setSize({ w, h, scale: w / BASE.w });
  }, []);

  // resize window dynamically
  useEffect(() => {
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [compute]);

  // delete key item removal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected]);

  // ctrl c + v duplicate
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      if (key === "c") {
        e.preventDefault();
        copySelected();
      }

      if (key === "v") {
        e.preventDefault();
        pasteClipboard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copySelected, pasteClipboard]);

  // ctrl + z undo, ctrl + shift + z redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable
      ) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redoAction();
        } 
        else {
          undoAction();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoAction, redoAction]);

  // cleanup text editor on unmount
  useEffect(() => {
    return () => {
      if (textEditorRef.current) {
        textEditorRef.current.remove();
        textEditorRef.current = null;
      }
    };
  }, []);

  // esc exits draw mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable
      ) return;

      const { mode } = useBoardStore.getState();
      if (e.key === "Escape" && (mode === "draw" || mode === "text")) {
        e.preventDefault();
        setMode("idle");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setMode]);

  // normalize old/invalid text widths so store matches render
  useEffect(() => {
    const hasBad = items.some(
      (it) => it.kind === "text" && (it.w ?? 0) < TEXT_MIN_W
    );
    if (!hasBad) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.kind !== "text") return it;
        const w = Math.max(TEXT_MIN_W, it.w ?? TEXT_MIN_W);
        return w === it.w ? it : { ...it, w };
      })
    );
  }, [items, setItems]);

  // find new coords of draggables
  const onMove = (id, x, y) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.locked) return;

    pushHistory();
    setItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, x, y } : entry))
    );
  };

  // update store with transformed item
  const onTransform = (id, group) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.locked) {
      group.scaleX(1);
      group.scaleY(1);
      group.getLayer()?.batchDraw();
      return;
    }

    const scaleX = group.scaleX();
    const scaleY = group.scaleY();

    pushHistory();

    const newW = Math.max(5, (target.w ?? 0) * Math.abs(scaleX));
    const newH = Math.max(5, (target.h ?? 0) * Math.abs(scaleY));

    if (target.kind === "drawing" && Array.isArray(target.points)) {
      const nextPoints = target.points.map((p, idx) =>
        idx % 2 === 0 ? p * Math.abs(scaleX) : p * Math.abs(scaleY)
      );

      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      const nextStrokeWidth = Math.max(1, (target.strokeWidth || 3) * avgScale);

      const hitbox = group.findOne(".drawingHitbox");
      const line = group.findOne(".drawingLine");

      hitbox?.setAttrs({
        width: newW,
        height: newH,
      });

      line?.setAttrs({
        points: nextPoints,
        strokeWidth: nextStrokeWidth,
      });

      group.scaleX(1);
      group.scaleY(1);
      group.getLayer()?.batchDraw();

      setItems((prev) =>
        prev.map((item) =>
          item.id !== id
            ? item
            : {
                ...item,
                x: group.x(),
                y: group.y(),
                rot: group.rotation(),
                w: newW,
                h: newH,
                points: nextPoints,
                strokeWidth: nextStrokeWidth,
                // scale crop metadata proportionally so re-crop HUD stays accurate
                ...(item._cropOffsetX !== undefined
                  ? { _cropOffsetX: item._cropOffsetX * Math.abs(scaleX) }
                  : {}),
                ...(item._cropOffsetY !== undefined
                  ? { _cropOffsetY: item._cropOffsetY * Math.abs(scaleY) }
                  : {}),
                ...(item._origW !== undefined
                  ? { _origW: item._origW * Math.abs(scaleX) }
                  : {}),
                ...(item._origH !== undefined
                  ? { _origH: item._origH * Math.abs(scaleY) }
                  : {}),
              }
        )
      );

      return;
    }

    // pre-apply new dimensions to KImage to prevent flicker on resize
    group.find("Image").forEach((img) => {
      img.width(newW);
      img.height(newH);
      if (target.flipX && img.offsetX() !== 0) img.offsetX(newW);
    });

    group.scaleX(1);
    group.scaleY(1);
    group.getLayer()?.batchDraw();

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // text has custom transform logic
        if (item.kind === "text") return item;

        return {
          ...item,
          x: group.x(),
          y: group.y(),
          rot: group.rotation(),
          w: newW,
          h: newH,
        };
      })
    );
  };  

  // push text tranform to history stack
  const onTextTransformStart = useCallback((id) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.locked) return;

    if (!textTransformHistoryRef.current.has(id)) {
      pushHistory();
      textTransformHistoryRef.current.add(id);
    }
  }, [items, pushHistory]);

  // update store with transformed text item
  const onTextTransformLive = useCallback((id, group) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.locked) {
      group.scaleX(1);
      group.scaleY(1);
      group.getLayer()?.batchDraw();
      return;
    }

    const sx = Math.abs(group.scaleX()) || 1;
    const sy = Math.abs(group.scaleY()) || 1;

    const tr = group.getLayer()?.findOne("Transformer");
    const activeAnchor = tr?.getActiveAnchor?.() || "";

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.kind !== "text") return item;

        const lineHeight = item.lineHeight || TEXT_LINE_HEIGHT;
        const fontFamily = item.fontFamily || "Arial";
        const baseFont = item.fontSize || 28;

        const baseW = Math.max(TEXT_MIN_W, item.w ?? TEXT_MIN_W);
        const baseNeededH = getWrappedTextHeightForWidth(item.text || "", baseW, baseFont, fontFamily, lineHeight);
        const baseH = Math.max(1, item.h ?? 0, baseNeededH);

        const minH = typeof item.minH === "number" ? item.minH : null;
        
        let nextW = baseW;
        let nextH = baseH;
        let nextFont = baseFont;

        if (TEXT_CORNER_ANCHORS.has(activeAnchor)) {
          // corner drag
          nextW = Math.max(TEXT_MIN_W, baseW * sx);
          nextH = Math.max(5, baseH * sy);
          nextFont = clampNum(baseFont * sy, 8, 240);
        } 
        else if (TEXT_HSIDE_ANCHORS.has(activeAnchor)) {
          // left/right sides
          nextW = Math.max(TEXT_MIN_W, baseW * sx);
        } 
        else if (TEXT_VSIDE_ANCHORS.has(activeAnchor)) {
          // top/bottom sides
          nextH = Math.max(5, baseH * sy);
        }

        const neededH = getWrappedTextHeightForWidth(item.text || "", nextW, nextFont, fontFamily, lineHeight);

        if (TEXT_HSIDE_ANCHORS.has(activeAnchor)) {
          nextH = Math.max(neededH, minH ?? 0);
        } 
        else {
          nextH = Math.max(nextH, neededH);
        }

        const isHeightAnchor = TEXT_VSIDE_ANCHORS.has(activeAnchor) || TEXT_CORNER_ANCHORS.has(activeAnchor);
        const nextMinH = isHeightAnchor && nextH > neededH ? nextH : null;

        return {
          ...item,
          x: group.x(),
          y: group.y(),
          rot: group.rotation(),
          w: nextW,
          h: nextH,
          fontSize: nextFont,
          ...(isHeightAnchor
            ? (nextMinH != null ? { minH: nextMinH } : { minH: undefined })
            : {}),
        };
      })
    );

    group.scaleX(1);
    group.scaleY(1);
    group.getLayer()?.batchDraw();
  }, [items, setItems]);

  // finalize text transform and reset scale
  const onTextTransformEnd = useCallback((id, group) => {
    group.scaleX(1);
    group.scaleY(1);
    group.getLayer()?.batchDraw();
    textTransformHistoryRef.current.delete(id);
  }, []);
  
  // text editor
  const beginTextEdit = useCallback((item) => {
    if (!stageRef.current || !wrapRef.current) return;

    // remove any existing editor
    if (textEditorRef.current) {
      textEditorRef.current.remove();
      textEditorRef.current = null;
    }

    const stage = stageRef.current;
    const rect = stage.container().getBoundingClientRect();

    const wrapRect = wrapRef.current.getBoundingClientRect();
    const sx = (rect.left - wrapRect.left) + item.x * size.scale;
    const sy = (rect.top  - wrapRect.top)  + item.y * size.scale;
    const rot = item.rot || 0;
    const lineHeight = item.lineHeight || TEXT_LINE_HEIGHT;
    const fontSize = item.fontSize || 28;
    const fontFamily = item.fontFamily || "Arial";
    const w = Math.max(TEXT_MIN_W, item.w ?? 1);
    const neededH0 = getWrappedTextHeightForWidth(item.text || "", w, fontSize, fontFamily, lineHeight);
    const boxH = Math.max(1, item.h ?? 0, neededH0);

    setEditingTextId(item.id);

    const ta = document.createElement("textarea");
    ta.value = item.text || "";

    ta.style.position = "absolute";
    ta.style.left = `${sx}px`;
    ta.style.top = `${sy}px`;
    ta.style.width = `${w * size.scale}px`;
    ta.style.height = `${boxH * size.scale}px`;

    ta.style.fontSize = `${fontSize * size.scale}px`;
    ta.style.fontFamily = fontFamily || "Arial";
    ta.style.lineHeight = String(lineHeight);

    ta.style.transformOrigin = "top left";
    ta.style.transform = `rotate(${rot}deg)`;

    ta.style.border = "0.5px solid rgba(0,0,0,0.25)";
    ta.style.outline = "none";
    
    ta.style.whiteSpace = "pre-wrap";
    ta.style.wordBreak = "break-all";
    ta.style.overflowWrap = "anywhere";

    ta.style.padding = "0px";
    ta.style.margin = "0";
    ta.style.resize = "none";
    ta.style.background = "rgba(255,255,255,0.18)";
    ta.style.color = "#000";
    ta.style.zIndex = 2;
    ta.style.boxSizing = "border-box";
    ta.style.overflow = "hidden";

    ta.rows = 1; 
    ta.style.minHeight = "0px";

    wrapRef.current.appendChild(ta);
    ta.focus();
    ta.select();

    const originalText = item.text || "";
    const originalH = Math.max(1, item.h ?? 0, neededH0);
    const minH = typeof item.minH === "number" ? item.minH : 0;

    let pushedEditHistory = false;

    const ensureEditHistory = () => {
      if (pushedEditHistory) return;
      pushHistory();
      pushedEditHistory = true;
    };

    const measureAutoH = () => {
      ta.style.height = "0px";
      const px = ta.scrollHeight;
      return Math.max(1, Math.ceil(px / size.scale));
    };

    const syncLive = () => {
      const value = ta.value;

      const autoH = measureAutoH();
      const nextH = Math.max(autoH, minH);

      ta.style.height = `${nextH * size.scale}px`;

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, text: value, h: nextH } : it
        )
      );
    };

    syncLive();

    let closed = false;

    const cleanupOnly = () => {
      if (closed) return false;
      closed = true;
      if (ta.parentNode) ta.remove();
      if (textEditorRef.current === ta) textEditorRef.current = null;
      setEditingTextId(null);
      return true;
    };

    const commit = () => {
      const value = ta.value;

      if (value.trim() === "") {
        if (pushedEditHistory) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, text: originalText, h: originalH } : it
            )
          );
        }
        cleanupOnly();
        return;
      }

      if (pushedEditHistory) syncLive();
      cleanupOnly();
    };

    const cancel = () => {
      if (pushedEditHistory) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, text: originalText, h: originalH } : it
          )
        );
      }
      cleanupOnly();
    };    

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
    });

    ta.addEventListener("input", () => {
      ensureEditHistory();  
      syncLive();
      requestAnimationFrame(syncLive);
    });
    
    ta.addEventListener("blur", commit);

    textEditorRef.current = ta;
  }, [pushHistory, setItems, size.scale]);

  // start a new drawing item
  const startDrawing = useCallback((px, py) => {
    pushHistory();

    setItems((prev) => {
      const maxZ = prev.reduce((m, it) => Math.max(m, it.z ?? 0), 0);
      const id = crypto.randomUUID();

      const item = {
        id,
        kind: "drawing",
        x: px,
        y: py,
        w: 1,
        h: 1,
        rot: 0,
        z: maxZ + 1,
        points: [0, 0],
        strokeWidth: 5,
        description: "",
        url: "",
        quantity: 1,
        cost: "",
        locked: false,
        hidden: false,
      };

      drawingRef.current = { id };

      return [...prev, item];
    });
  }, [pushHistory, setItems]);

  // add points to current drawing item and update bounding box
  const extendDrawing = useCallback((px, py) => {
    const cur = drawingRef.current;
    if (!cur) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== cur.id) return it;

        const localX = px - it.x;
        const localY = py - it.y;

        const existing = it.points || [];
        const lastX = existing.length >= 2 ? existing[existing.length - 2] : 0;
        const lastY = existing.length >= 2 ? existing[existing.length - 1] : 0;

        const dx = localX - lastX;
        const dy = localY - lastY;
        const dist = Math.hypot(dx, dy);

        const STEP = 2.5;
        const inserts = Math.max(1, Math.ceil(dist / STEP));

        const interpolated = [];
        for (let i = 1; i <= inserts; i++) {
          const t = i / inserts;
          interpolated.push(lastX + dx * t, lastY + dy * t);
        }

        const rawPoints = [...existing, ...interpolated];
        
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < rawPoints.length; i += 2) {
          const x = rawPoints[i];
          const y = rawPoints[i + 1];
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        // pad on drawing bounding box to prevent clipping of stroke edges on crop
        const PAD = Math.ceil((it.strokeWidth || 5) / 2) + 12;

        const normalizedPoints = rawPoints.map((p, idx) =>
          idx % 2 === 0 ? p - minX + PAD : p - minY + PAD
        );

        return {
          ...it,
          x: it.x + minX - PAD,
          y: it.y + minY - PAD,
          points: normalizedPoints,
          w: Math.max(1, maxX - minX + PAD * 2),
          h: Math.max(1, maxY - minY + PAD * 2),
        };
      })
    );
  }, [setItems]);
  
  // finish drawing and select the new item
  const stopDrawing = useCallback(() => {
    const cur = drawingRef.current;
    if (!cur) return;

    drawingRef.current = null;

    let shouldSelect = false;

    setItems((prev) => {
      const drawn = prev.find((it) => it.id === cur.id);
      if (!drawn) return prev;

      const hasEnoughPoints = Array.isArray(drawn.points) && drawn.points.length >= 4;
      const hasVisibleSize = (drawn.w ?? 0) > 4 || (drawn.h ?? 0) > 4;

      if (!hasEnoughPoints || !hasVisibleSize) {
        return prev.filter((it) => it.id !== cur.id);
      }

      shouldSelect = true;
      return prev;
    });

    if (shouldSelect) {
      setSelected(cur.id);
    }
  }, [setItems, setSelected]);

  // sort board items by z-index
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [items]
  );

  // filter out hidden items
  const visibleItems = useMemo(
    () => sorted.filter((item) => !item.hidden),
    [sorted]
  );

  return (
    <div ref={wrapRef} className={styles.boardStageWrap}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={size.scale}
        scaleY={size.scale}
        className={styles.boardStage}
        onMouseDown={() => {
          if (mode !== "draw") return;
          if (!stageRef.current) return;
          const p = stageRef.current.getPointerPosition();
          if (!p) return;
          startDrawing(p.x / size.scale, p.y / size.scale);
        }}
        onMouseMove={() => {
          if (mode !== "draw") return;
          if (!stageRef.current) return;
          const p = stageRef.current.getPointerPosition();
          if (!p) return;
          extendDrawing(p.x / size.scale, p.y / size.scale);
        }}
        onMouseUp={() => {
          if (mode !== "draw") return;
          stopDrawing();
        }}
      >
        <Layer>
          <Rect 
            x={0} 
            y={0} 
            width={BASE.w} 
            height={BASE.h} 
            fill={backgroundColor || "#ffffff"}
            onMouseDown={() => { 
              const currentMode = useBoardStore.getState().mode;
              if (currentMode === "crop") {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
              }
              if (currentMode === "bg") {
                return;
              }
              setSelected(null);
            }}
            onTap={() => { 
              const currentMode = useBoardStore.getState().mode;
              if (currentMode === "crop") {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
              }
              if (currentMode === "bg") {
                return;
              }
              setSelected(null);
            }}
          />
          {visibleItems.map((item) => {
            if (item.kind === "image") {
              return (
                <ItemImage
                  key={item.id}
                  item={item}
                  moodboardId={moodboardId}
                  onSelect={setSelected}
                  onMove={onMove}
                  onTransform={onTransform}
                />
              );
            }

            if (item.kind === "text") {
              return (
                <ItemText
                  key={item.id}
                  item={item}
                  onSelect={setSelected}
                  onMove={onMove}
                  onTransformStart={onTextTransformStart}
                  onTransformLive={onTextTransformLive}
                  onTransformEnd={onTextTransformEnd}
                  onEdit={(it) => beginTextEdit(it)}
                  isEditing={editingTextId === item.id}
                />
              );
            }

            if (item.kind === "drawing") {
              return (
                <ItemDrawing
                  key={item.id}
                  item={item}
                  onSelect={setSelected}
                  onMove={onMove}
                  onTransform={onTransform}
                />
              );
            }

            return null;
          })}
          <SelectionTransformer selectedId={selectedId} mode={mode} />
        </Layer>

        {mode === 'crop' && selectedId && (() => {
          const selected = items.find((i) => i.id === selectedId && !i.hidden);
          if (!selected) return null;

          if (selected.kind === 'image') {
            return (
              <Layer listening>
                <CropHUD
                  item={selected}
                  moodboardId={moodboardId}
                  onApply={applyCrop}
                  onCancel={cancelCrop}
                />
              </Layer>
            );
          }

          if (selected.kind === 'text' || selected.kind === 'drawing') {
            return (
              <Layer listening>
                <CropHUDShape
                  item={selected}
                  onApply={applyShapeCrop}
                  onCancel={cancelCrop}
                />
              </Layer>
            );
          }

          return null;
        })()}
      </Stage>
    </div>
  );
}

export default forwardRef(BoardCanvas);
