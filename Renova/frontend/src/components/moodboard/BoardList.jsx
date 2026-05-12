"use client";

import { useRef, useMemo } from "react";
import { useBoardStore } from "@/contexts/boardStore";
import { toMoodboardDisplaySrc } from "@/utils/moodboardMedia";
import styles from "@/styles/moodboard/Moodboard.module.scss";

function TextThumbnail({ item }) {
  const fontSize = Math.max(10, Math.min((item.fontSize || 28) * 0.34, 16));
  const lineHeight = item.lineHeight || 1.2;
  const fontFamily = item.fontFamily || "Arial";
  const text = item.text?.trim() || "Empty text box";

  return (
    <div className={styles.listTextThumbWrap}>
      <div
        className={styles.listTextThumbInner}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight,
          fontFamily,
          transform: item.rot ? `rotate(${item.rot}deg)` : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function DrawingThumbnail({ item }) {
  const points = Array.isArray(item.points) ? item.points : [];

  const view = useMemo(() => {
    if (points.length < 4) {
      return {
        path: "",
        minX: 0,
        minY: 0,
        width: 100,
        height: 100,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    let path = "";
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i] - minX;
      const y = points[i + 1] - minY;
      path += `${i === 0 ? "M" : "L"} ${x} ${y} `;
    }

    return { path, minX, minY, width, height };
  }, [points]);

  return (
    <div className={styles.listDrawingThumbWrap}>
      <svg
        className={styles.listDrawingThumbSvg}
        viewBox={`0 0 ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {view.path ? (
          <path
            d={view.path}
            fill="none"
            stroke="#222"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}

function ItemPreview({ item, moodboardId }) {
  if (item.kind === "image" && item.src) {
    return (
      <div className={styles.listThumbWrap}>
        <img
          src={toMoodboardDisplaySrc(item.src, moodboardId)}
          alt=""
          className={styles.listThumbImage}
        />
      </div>
    );
  }

  if (item.kind === "text") {
    return <TextThumbnail item={item} />;
  }

  if (item.kind === "drawing") {
    return <DrawingThumbnail item={item} />;
  }

  return (
    <div className={styles.listPreviewFallback}>
      <span className={styles.listPreviewTypeBadge}>Drawing</span>
      <span className={styles.listPreviewSnippet}>Freehand drawing</span>
    </div>
  );
}

export default function BoardList({ moodboardId }) {
  const editKeyRef = useRef("");

  const {
    items,
    selectedId,
    setSelected,
    setItems,
    pushHistory,
  } = useBoardStore();

  const rows = useMemo(
    () => [...items].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [items]
  );

  const updateItem = (id, patch) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextPatch = typeof patch === "function" ? patch(item) : patch;
        return { ...item, ...nextPatch };
      })
    );
  };

  const beginFieldEdit = (id, field) => {
    const nextKey = `${id}:${field}`;
    setSelected(id);

    if (editKeyRef.current === nextKey) return;

    pushHistory();
    editKeyRef.current = nextKey;
  };

  const endFieldEdit = () => {
    editKeyRef.current = "";
  };

  const toggleLocked = (id) => {
    pushHistory();
    setSelected(id);
    updateItem(id, (item) => ({ locked: !item.locked }));
  };

  const toggleHidden = (id) => {
    pushHistory();

    let nextHidden = false;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        nextHidden = !item.hidden;
        return { ...item, hidden: nextHidden };
      })
    );

    if (nextHidden && selectedId === id) {
      setSelected(null);
    } else {
      setSelected(id);
    }
  };

  if (!rows.length) {
    return (
      <div className={styles.boardListCard}>
        <div className={styles.boardListEmpty}>
          No items on this moodboard yet.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.boardListCard}>
      <div className={styles.boardListScroll}>
        <table className={styles.boardListTable}>
          <thead>
            <tr>
              <th className={styles.listIndexHead}>#</th>
              <th className={styles.listPreviewHead}>Item</th>
              <th>Description</th>
              <th>URL</th>
              <th className={styles.listQtyHead}>Qty</th>
              <th className={styles.listCostHead}>Cost</th>
              <th className={styles.listActionHead}>Lock</th>
              <th className={styles.listActionHead}>Hide</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((item, index) => {
              const isSelected = selectedId === item.id;
              const isHidden = !!item.hidden;
              const isLocked = !!item.locked;

              return (
                <tr
                  key={item.id}
                  className={[
                    styles.boardListRow,
                    isSelected ? styles.boardListRowSelected : "",
                    isHidden ? styles.boardListRowHidden : "",
                  ].join(" ")}
                  onClick={() => setSelected(item.id)}
                >
                  <td className={styles.listIndexCell}>{index + 1}</td>

                  <td className={styles.listPreviewCell}>
                    <ItemPreview item={item} moodboardId={moodboardId} />
                  </td>

                  <td>
                    <input
                      className={styles.listFieldInput}
                      type="text"
                      value={item.description ?? ""}
                      placeholder="Add description"
                      onClick={(e) => e.stopPropagation()}
                      onFocus={() => beginFieldEdit(item.id, "description")}
                      onBlur={endFieldEdit}
                      onChange={(e) =>
                        updateItem(item.id, { description: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <div className={styles.listUrlFieldWrap}>
                      <button
                        type="button"
                        className={styles.listUrlIconBtn}
                        onClick={(e) => {
                          e.stopPropagation();

                          const raw = (item.url || "").trim();
                          if (!raw) return;

                          const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                          window.open(href, "_blank", "noopener,noreferrer");
                        }}
                        aria-label="Open URL"
                        title="Open URL"
                      >
                        <img
                          src="/icons/link.svg"
                          alt=""
                          className={styles.listUrlIcon}
                        />
                      </button>

                      <input
                        className={`${styles.listFieldInput} ${styles.listUrlInput}`}
                        type="text"
                        value={item.url ?? ""}
                        placeholder="Paste URL"
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => beginFieldEdit(item.id, "url")}
                        onBlur={endFieldEdit}
                        onChange={(e) =>
                          updateItem(item.id, { url: e.target.value })
                        }
                      />
                    </div>
                  </td>

                  <td className={styles.listQtyCell}>
                    <input
                      className={`${styles.listFieldInput} ${styles.listQtyInput}`}
                      type="number"
                      min="0"
                      value={item.quantity ?? 1}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={() => beginFieldEdit(item.id, "quantity")}
                      onBlur={endFieldEdit}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        updateItem(item.id, {
                          quantity:
                            Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
                        });
                      }}
                    />
                  </td>

                  <td className={styles.listCostCell}>
                    <input
                      className={`${styles.listFieldInput} ${styles.listCostInput}`}
                      type="text"
                      value={item.cost ?? ""}
                      placeholder="$0.00"
                      onClick={(e) => e.stopPropagation()}
                      onFocus={() => beginFieldEdit(item.id, "cost")}
                      onBlur={endFieldEdit}
                      onChange={(e) =>
                        updateItem(item.id, { cost: e.target.value })
                      }
                    />
                  </td>

                  <td className={styles.listActionCell}>
                    <button
                      type="button"
                      className={`${styles.listToggleBtn} ${
                        isLocked ? styles.listToggleBtnLocked : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLocked(item.id);
                      }}
                    >
                      {isLocked ? "Locked" : "Lock"}
                    </button>
                  </td>

                  <td className={styles.listActionCell}>
                    <button
                      type="button"
                      className={`${styles.listToggleBtn} ${
                        isHidden ? styles.listToggleBtnHidden : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHidden(item.id);
                      }}
                    >
                      {isHidden ? "Hidden" : "Hide"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}