import { create } from "zustand";

const initialMode = 'idle';
const deepClone = (v) => JSON.parse(JSON.stringify(v));

export const useBoardStore = create((set, get) => ({
  items: [],
  selectedId: null,
  clipboard: null,
  mode: initialMode,

  historyPast: [],
  historyFuture: [],

  setItems: (next) => set((s) => ({
    items: Array.isArray(next) ? next : next(s.items),
  })),

  setSelected: (id) => set({ selectedId: id }),

  setMode: (mode) => set({ mode }),

  pushHistory: () => {
    const { items, selectedId, historyPast } = get();
    const snapshot = deepClone({ items, selectedId });
    set({
      historyPast: [...historyPast, snapshot],
      historyFuture: [], 
    });
  },

  undoAction: () => {
    const { historyPast, historyFuture, items, selectedId } = get();
    if (!historyPast.length) return;

    const prev = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    const newFuture = [
      ...historyFuture,
      deepClone({ items, selectedId }),
    ];

    set({
      items: prev.items,
      selectedId: prev.selectedId,
      historyPast: newPast,
      historyFuture: newFuture,
      mode: initialMode, 
    });
  },

  redoAction: () => {
    const { historyPast, historyFuture, items, selectedId } = get();
    if (!historyFuture.length) return;

    const next = historyFuture[historyFuture.length - 1];
    const newFuture = historyFuture.slice(0, -1);
    const newPast = [
      ...historyPast,
      deepClone({ items, selectedId }),
    ];

    set({
      items: next.items,
      selectedId: next.selectedId,
      historyPast: newPast,
      historyFuture: newFuture,
      mode: initialMode,
    });
  },

  deleteSelected: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    pushHistory();

    set({
      items: items.filter((i) => i.id !== selectedId),
      selectedId: null,
    });
  },
  
  duplicateSelected: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    const original = items.find((i) => i.id === selectedId);
    if (!original) return;

    pushHistory();

    const maxZ = items.reduce((m, item) => Math.max(m, item.z ?? 0), 0);
    const clone = {
      ...original,
      id: crypto.randomUUID(),
      x: original.x + 25,
      y: original.y + 25,
      z: maxZ + 1,
    };

    set({
      items: [...items, clone],
      selectedId: clone.id,
      mode: initialMode,
    });
  },

  copySelected: () => set((s) => {
    if (!s.selectedId) return s;
    const original = s.items.find((i) => i.id === s.selectedId);
    if (!original) return s;
    return { clipboard: { ...original } };
  }),

  pasteClipboard: () => {
    const { clipboard, items, pushHistory } = get();
    if (!clipboard) return;

    pushHistory();

    const maxZ = items.reduce((m, item) => Math.max(m, item.z ?? 0), 0);
    const base = clipboard;

    const clone = {
      ...base,
      id: crypto.randomUUID(),
      x: base.x + 25,
      y: base.y + 25,
      z: maxZ + 1,
    };

    set({
      items: [...items, clone],
      selectedId: clone.id,
      mode: initialMode,
    });
  },

  moveForward: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    const sorted = [...items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    const idx = sorted.findIndex((i) => i.id === selectedId);
    if (idx === -1 || idx === sorted.length - 1) return;

    pushHistory();

    const a = sorted[idx];
    const b = sorted[idx + 1];

    const nextItems = items.map((item) => {
      if (item.id === a.id) return { ...item, z: b.z };
      if (item.id === b.id) return { ...item, z: a.z };
      return item;
    });

    set({ items: nextItems });
  },

  moveBackward: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    const sorted = [...items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    const idx = sorted.findIndex((i) => i.id === selectedId);
    if (idx <= 0) return;

    pushHistory();

    const a = sorted[idx];
    const b = sorted[idx - 1];

    const nextItems = items.map((item) => {
      if (item.id === a.id) return { ...item, z: b.z };
      if (item.id === b.id) return { ...item, z: a.z };
      return item;
    });

    set({ items: nextItems });
  },

  mirrorSelected: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    const item = items.find((i) => i.id === selectedId);
    if (!item) return;
    
    if (item.kind === "text") return;

    pushHistory();

    set({
      items: items.map((item) =>
        item.id === selectedId ? { ...item, flipX: !item.flipX } : item
      ),
    });
  },

  toggleShadow: () => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    pushHistory();

    set({
      items: items.map((item) =>
        item.id === selectedId
          ? { ...item, shadow: !item.shadow }
          : item
      ),
    });
  },

  setItemCrop: (id, crop) => set((s) => ({
    items: s.items.map((item) => (item.id === id ? { ...item, crop } : item)),
  })),

  startCrop: () => {
    const { selectedId, items } = get();
    const item = items.find((x) => x.id === selectedId);
    if (!item || item.locked || item.hidden) return;
    if (item.kind !== "image" && item.kind !== "text" && item.kind !== "drawing") return;
    set({ mode: "crop" });
  },

  applyCrop: (cropPx, nextFrame) => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;

    const item = items.find((i) => i.id === selectedId);
    if (!item || item.locked || item.hidden) return;

    pushHistory();

    get().setItemCrop(selectedId, cropPx);

    set((s) => ({
      items: s.items.map((n) =>
        n.id !== selectedId
          ? n
          : {
              ...n,
              x: nextFrame.x,
              y: nextFrame.y,
              w: nextFrame.w,
              h: nextFrame.h,
            }
      ),
      mode: 'idle',
    }));
  },

  cancelCrop: () => set({ mode: 'idle' }),

  applyShapeCrop: (box) => {
    const { selectedId, items, pushHistory } = get();
    if (!selectedId) return;
    const item = items.find((i) => i.id === selectedId);
    if (!item || item.locked || item.hidden) return;
    if (item.kind !== "text" && item.kind !== "drawing") return;

    pushHistory();

    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== selectedId) return it;

        const theta = ((it.rot || 0) * Math.PI) / 180;
        const origW = it._origW ?? it.w;

        const cX = it._cropOffsetX || 0;
        const cY = it._cropOffsetY || 0;
        const visOffsetX =
          it.kind === "drawing" && it.flipX
            ? origW - cX - (it.w || 0)
            : cX;

        const origDx = visOffsetX * Math.cos(theta) - cY * Math.sin(theta);
        const origDy = visOffsetX * Math.sin(theta) + cY * Math.cos(theta);
        const origX = it.x - origDx;
        const origY = it.y - origDy;

        const newDx = box.x * Math.cos(theta) - box.y * Math.sin(theta);
        const newDy = box.x * Math.sin(theta) + box.y * Math.cos(theta);

        const newCropOffsetX =
          it.kind === "drawing" && it.flipX
            ? origW - (box.x + box.w)
            : box.x;

        return {
          ...it,
          x: origX + newDx,
          y: origY + newDy,
          w: box.w,
          h: box.h,
          _origW: origW,
          _origH: it._origH ?? it.h,
          _cropOffsetX: newCropOffsetX,
          _cropOffsetY: box.y,
        };
      }),
      mode: "idle",
    }));
  },
}));
