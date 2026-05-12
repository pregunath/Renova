import { useBoardStore } from '../boardStore';

const reset = () =>
  useBoardStore.setState({
    items: [],
    selectedId: null,
    clipboard: null,
    mode: 'idle',
    historyPast: [],
    historyFuture: [],
  });

const get = () => useBoardStore.getState();

const imageItem = (overrides = {}) => ({
  id: 'img-1',
  kind: 'image',
  x: 100,
  y: 100,
  w: 200,
  h: 150,
  z: 1,
  flipX: false,
  shadow: false,
  ...overrides,
});

const textItem = (overrides = {}) => ({
  id: 'txt-1',
  kind: 'text',
  x: 50,
  y: 50,
  w: 260,
  h: 34,
  z: 2,
  text: 'Hello',
  ...overrides,
});

beforeEach(reset);

// ─── setItems ────────────────────────────────────────────────────────────────

describe('setItems', () => {
  it('replaces items when given an array', () => {
    const items = [imageItem()];
    get().setItems(items);
    expect(get().items).toEqual(items);
  });

  it('replaces items when given an updater function', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().setItems((prev) => [...prev, textItem()]);
    expect(get().items).toHaveLength(2);
  });
});

// ─── setSelected ─────────────────────────────────────────────────────────────

describe('setSelected', () => {
  it('sets selectedId to the given id', () => {
    get().setSelected('img-1');
    expect(get().selectedId).toBe('img-1');
  });

  it('can clear selection by setting null', () => {
    useBoardStore.setState({ selectedId: 'img-1' });
    get().setSelected(null);
    expect(get().selectedId).toBeNull();
  });
});

// ─── setMode ─────────────────────────────────────────────────────────────────

describe('setMode', () => {
  it('updates mode', () => {
    get().setMode('draw');
    expect(get().mode).toBe('draw');
  });

  it('can set mode back to idle', () => {
    useBoardStore.setState({ mode: 'crop' });
    get().setMode('idle');
    expect(get().mode).toBe('idle');
  });
});

// ─── pushHistory ─────────────────────────────────────────────────────────────

describe('pushHistory', () => {
  it('saves current items and selectedId as a snapshot', () => {
    const items = [imageItem()];
    useBoardStore.setState({ items, selectedId: 'img-1' });
    get().pushHistory();
    const { historyPast } = get();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0].items).toEqual(items);
    expect(historyPast[0].selectedId).toBe('img-1');
  });

  it('clears historyFuture when a new snapshot is pushed', () => {
    useBoardStore.setState({ historyFuture: [{ items: [], selectedId: null }] });
    get().pushHistory();
    expect(get().historyFuture).toHaveLength(0);
  });

  it('accumulates multiple snapshots', () => {
    get().pushHistory();
    get().pushHistory();
    expect(get().historyPast).toHaveLength(2);
  });
});

// ─── undoAction ──────────────────────────────────────────────────────────────

describe('undoAction', () => {
  it('restores the previous state', () => {
    const original = [imageItem()];
    useBoardStore.setState({ items: original, selectedId: 'img-1' });
    get().pushHistory();
    get().setItems([textItem()]);
    get().setSelected('txt-1');

    get().undoAction();

    expect(get().items).toEqual(original);
    expect(get().selectedId).toBe('img-1');
  });

  it('moves current state into historyFuture', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().pushHistory();
    get().undoAction();
    expect(get().historyFuture).toHaveLength(1);
  });

  it('resets mode to idle', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().pushHistory();
    useBoardStore.setState({ mode: 'draw' });
    get().undoAction();
    expect(get().mode).toBe('idle');
  });

  it('does nothing when history is empty', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().undoAction();
    expect(get().items).toHaveLength(1);
  });
});

// ─── redoAction ──────────────────────────────────────────────────────────────

describe('redoAction', () => {
  it('restores the next state after undo', () => {
    const after = [textItem()];
    useBoardStore.setState({ items: [imageItem()] });
    get().pushHistory();
    get().setItems(after);
    get().setSelected('txt-1');
    get().undoAction();

    get().redoAction();

    expect(get().items).toEqual(after);
    expect(get().selectedId).toBe('txt-1');
  });

  it('moves current state into historyPast', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().pushHistory();
    get().undoAction();
    get().redoAction();
    expect(get().historyPast).toHaveLength(1);
  });

  it('resets mode to idle', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().pushHistory();
    get().undoAction();
    useBoardStore.setState({ mode: 'draw' });
    get().redoAction();
    expect(get().mode).toBe('idle');
  });

  it('does nothing when there is nothing to redo', () => {
    useBoardStore.setState({ items: [imageItem()] });
    get().redoAction();
    expect(get().items).toHaveLength(1);
  });
});

// ─── deleteSelected ───────────────────────────────────────────────────────────

describe('deleteSelected', () => {
  it('removes the selected item', () => {
    useBoardStore.setState({ items: [imageItem(), textItem()], selectedId: 'img-1' });
    get().deleteSelected();
    expect(get().items).toHaveLength(1);
    expect(get().items[0].id).toBe('txt-1');
  });

  it('clears selectedId after deletion', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().deleteSelected();
    expect(get().selectedId).toBeNull();
  });

  it('pushes history before deleting', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().deleteSelected();
    expect(get().historyPast).toHaveLength(1);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().deleteSelected();
    expect(get().items).toHaveLength(1);
  });
});

// ─── duplicateSelected ────────────────────────────────────────────────────────

describe('duplicateSelected', () => {
  it('adds a new item to the list', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().duplicateSelected();
    expect(get().items).toHaveLength(2);
  });

  it('offsets the clone by 25px', () => {
    useBoardStore.setState({ items: [imageItem({ x: 100, y: 100 })], selectedId: 'img-1' });
    get().duplicateSelected();
    const clone = get().items.find((i) => i.id !== 'img-1');
    expect(clone.x).toBe(125);
    expect(clone.y).toBe(125);
  });

  it('gives the clone a higher z than all existing items', () => {
    useBoardStore.setState({ items: [imageItem({ z: 5 })], selectedId: 'img-1' });
    get().duplicateSelected();
    const clone = get().items.find((i) => i.id !== 'img-1');
    expect(clone.z).toBe(6);
  });

  it('selects the clone after duplication', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().duplicateSelected();
    const cloneId = get().items.find((i) => i.id !== 'img-1').id;
    expect(get().selectedId).toBe(cloneId);
  });

  it('pushes history before duplicating', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().duplicateSelected();
    expect(get().historyPast).toHaveLength(1);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().duplicateSelected();
    expect(get().items).toHaveLength(1);
  });
});

// ─── copySelected / pasteClipboard ───────────────────────────────────────────

describe('copySelected / pasteClipboard', () => {
  it('copies the selected item to clipboard', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().copySelected();
    expect(get().clipboard).toMatchObject({ id: 'img-1', kind: 'image' });
  });

  it('paste adds a new item offset by 25px', () => {
    useBoardStore.setState({
      items: [imageItem({ x: 100, y: 100 })],
      selectedId: 'img-1',
      clipboard: imageItem({ x: 100, y: 100 }),
    });
    get().pasteClipboard();
    expect(get().items).toHaveLength(2);
    const pasted = get().items.find((i) => i.id !== 'img-1');
    expect(pasted.x).toBe(125);
    expect(pasted.y).toBe(125);
  });

  it('paste selects the new item', () => {
    useBoardStore.setState({
      items: [imageItem()],
      clipboard: imageItem({ x: 50, y: 50 }),
    });
    get().pasteClipboard();
    const pasted = get().items.find((i) => i.id !== 'img-1');
    expect(get().selectedId).toBe(pasted.id);
  });

  it('paste pushes history', () => {
    useBoardStore.setState({ clipboard: imageItem() });
    get().pasteClipboard();
    expect(get().historyPast).toHaveLength(1);
  });

  it('paste does nothing when clipboard is empty', () => {
    useBoardStore.setState({ items: [imageItem()], clipboard: null });
    get().pasteClipboard();
    expect(get().items).toHaveLength(1);
  });

  it('copy does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().copySelected();
    expect(get().clipboard).toBeNull();
  });
});

// ─── moveForward ──────────────────────────────────────────────────────────────

describe('moveForward', () => {
  it('swaps z with the item above', () => {
    const a = imageItem({ id: 'a', z: 1 });
    const b = imageItem({ id: 'b', z: 2 });
    useBoardStore.setState({ items: [a, b], selectedId: 'a' });
    get().moveForward();
    const updated = get().items;
    expect(updated.find((i) => i.id === 'a').z).toBe(2);
    expect(updated.find((i) => i.id === 'b').z).toBe(1);
  });

  it('does nothing when item is already at the top', () => {
    const a = imageItem({ id: 'a', z: 1 });
    const b = imageItem({ id: 'b', z: 2 });
    useBoardStore.setState({ items: [a, b], selectedId: 'b' });
    get().moveForward();
    expect(get().items.find((i) => i.id === 'b').z).toBe(2);
    expect(get().historyPast).toHaveLength(0);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().moveForward();
    expect(get().historyPast).toHaveLength(0);
  });
});

// ─── moveBackward ─────────────────────────────────────────────────────────────

describe('moveBackward', () => {
  it('swaps z with the item below', () => {
    const a = imageItem({ id: 'a', z: 1 });
    const b = imageItem({ id: 'b', z: 2 });
    useBoardStore.setState({ items: [a, b], selectedId: 'b' });
    get().moveBackward();
    const updated = get().items;
    expect(updated.find((i) => i.id === 'b').z).toBe(1);
    expect(updated.find((i) => i.id === 'a').z).toBe(2);
  });

  it('does nothing when item is already at the bottom', () => {
    const a = imageItem({ id: 'a', z: 1 });
    const b = imageItem({ id: 'b', z: 2 });
    useBoardStore.setState({ items: [a, b], selectedId: 'a' });
    get().moveBackward();
    expect(get().items.find((i) => i.id === 'a').z).toBe(1);
    expect(get().historyPast).toHaveLength(0);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().moveBackward();
    expect(get().historyPast).toHaveLength(0);
  });
});

// ─── mirrorSelected ───────────────────────────────────────────────────────────

describe('mirrorSelected', () => {
  it('toggles flipX on an image item', () => {
    useBoardStore.setState({ items: [imageItem({ flipX: false })], selectedId: 'img-1' });
    get().mirrorSelected();
    expect(get().items[0].flipX).toBe(true);
  });

  it('toggles flipX back when called again', () => {
    useBoardStore.setState({ items: [imageItem({ flipX: true })], selectedId: 'img-1' });
    get().mirrorSelected();
    expect(get().items[0].flipX).toBe(false);
  });

  it('does not mirror a text item', () => {
    useBoardStore.setState({ items: [textItem()], selectedId: 'txt-1' });
    get().mirrorSelected();
    expect(get().items[0]).not.toHaveProperty('flipX', true);
    expect(get().historyPast).toHaveLength(0);
  });

  it('pushes history when mirroring an image', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().mirrorSelected();
    expect(get().historyPast).toHaveLength(1);
  });
});

// ─── toggleShadow ─────────────────────────────────────────────────────────────

describe('toggleShadow', () => {
  it('turns shadow on when it is off', () => {
    useBoardStore.setState({ items: [imageItem({ shadow: false })], selectedId: 'img-1' });
    get().toggleShadow();
    expect(get().items[0].shadow).toBe(true);
  });

  it('turns shadow off when it is on', () => {
    useBoardStore.setState({ items: [imageItem({ shadow: true })], selectedId: 'img-1' });
    get().toggleShadow();
    expect(get().items[0].shadow).toBe(false);
  });

  it('pushes history', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().toggleShadow();
    expect(get().historyPast).toHaveLength(1);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().toggleShadow();
    expect(get().historyPast).toHaveLength(0);
  });
});

// ─── startCrop ────────────────────────────────────────────────────────────────

describe('startCrop', () => {
  it('sets mode to crop for an image item', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().startCrop();
    expect(get().mode).toBe('crop');
  });

  it('does not enter crop mode for a text item', () => {
    useBoardStore.setState({ items: [textItem()], selectedId: 'txt-1' });
    get().startCrop();
    expect(get().mode).toBe('idle');
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().startCrop();
    expect(get().mode).toBe('idle');
  });
});

// ─── applyCrop ────────────────────────────────────────────────────────────────

describe('applyCrop', () => {
  it('updates the item frame with the new dimensions', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1', mode: 'crop' });
    const cropPx = { x: 10, y: 10, w: 80, h: 60 };
    const nextFrame = { x: 110, y: 110, w: 180, h: 130 };
    get().applyCrop(cropPx, nextFrame);
    const updated = get().items[0];
    expect(updated.x).toBe(110);
    expect(updated.y).toBe(110);
    expect(updated.w).toBe(180);
    expect(updated.h).toBe(130);
  });

  it('stores the crop data on the item', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    const cropPx = { x: 5, y: 5, w: 90, h: 70 };
    get().applyCrop(cropPx, { x: 100, y: 100, w: 200, h: 150 });
    expect(get().items[0].crop).toEqual(cropPx);
  });

  it('resets mode to idle after applying', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1', mode: 'crop' });
    get().applyCrop({}, { x: 0, y: 0, w: 100, h: 100 });
    expect(get().mode).toBe('idle');
  });

  it('pushes history', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: 'img-1' });
    get().applyCrop({}, { x: 0, y: 0, w: 100, h: 100 });
    expect(get().historyPast).toHaveLength(1);
  });

  it('does nothing when nothing is selected', () => {
    useBoardStore.setState({ items: [imageItem()], selectedId: null });
    get().applyCrop({}, { x: 0, y: 0, w: 100, h: 100 });
    expect(get().historyPast).toHaveLength(0);
  });
});

// ─── cancelCrop ───────────────────────────────────────────────────────────────

describe('cancelCrop', () => {
  it('resets mode to idle', () => {
    useBoardStore.setState({ mode: 'crop' });
    get().cancelCrop();
    expect(get().mode).toBe('idle');
  });
});
