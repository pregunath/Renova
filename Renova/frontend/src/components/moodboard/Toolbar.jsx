"use client";
import { useState } from "react";
import Image from "next/image";
import { useBoardStore } from "@/contexts/boardStore";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const TOOLS = [
  { key: "bg",        label: "Remove BG", icon: "/icons/bg.svg" },
  { key: "shadow",    label: "Shadow",    icon: "/icons/shadow.svg" },
  { key: "crop",      label: "Crop",      icon: "/icons/crop.svg" },
  { key: "mirror",    label: "Mirror",    icon: "/icons/mirror.svg" },
  { key: "duplicate", label: "Duplicate", icon: "/icons/duplicate.svg" },
  { key: "forward",   label: "Forward",   icon: "/icons/forward.svg" },
  { key: "backward",  label: "Backward",  icon: "/icons/backward.svg" },
  { key: "delete",    label: "Delete",    icon: "/icons/delete.svg" },
];

export default function Toolbar({ onRemoveBg }) {
  const [isBgProcessing, setIsBgProcessing] = useState(false);

  const {
    duplicateSelected,
    deleteSelected,
    moveForward,
    moveBackward,
    mirrorSelected,
    toggleShadow,
    startCrop,
    selectedId,
    items,
  } = useBoardStore();

  const selectedItem = items.find((i) => i.id === selectedId);
  const kind = selectedItem?.kind;

  const isDisabled = (key) => {
    if (!kind) return false;
    if (key === "bg") return kind === "text" || kind === "drawing";
    if (key === "mirror") return kind === "text";
    return false;
  };

  const handleClick = async (key) => {
    if (key === "bg") {
      if (!onRemoveBg) return;
      setIsBgProcessing(true);
      try { await onRemoveBg(); } finally { setIsBgProcessing(false); }
      return;
    }
    if (key === "mirror") return mirrorSelected();
    if (key === "duplicate") return duplicateSelected();
    if (key === "forward") return moveForward();
    if (key === "backward") return moveBackward();
    if (key === "delete") return deleteSelected();
    if (key === "shadow") return toggleShadow();
    if (key === "crop") return startCrop();
  };

  return (
    <div className={styles.toolbarRow}>
      {TOOLS.map((t) => {
        const disabled = isDisabled(t.key) || (t.key === "bg" && isBgProcessing);
        return (
          <button
            key={t.key}
            type="button"
            className={`${styles.toolBtn}${disabled ? ` ${styles.toolBtnDisabled}` : ""}`}
            onClick={disabled ? undefined : () => handleClick(t.key)}
            title={t.label}
            aria-label={t.label}
            aria-disabled={disabled ? "true" : undefined}
          >
            <span className={styles.toolIcon}>
              <Image src={t.icon} alt={t.label} width={24} height={24} unoptimized />
            </span>
            <span className={styles.toolLabel}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
