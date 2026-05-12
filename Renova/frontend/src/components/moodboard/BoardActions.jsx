"use client";

import { useRef } from "react";
import Image from "next/image";
import { useBoardStore } from "@/contexts/boardStore";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const ACTIONS = [
  { key: "save",   icon: "/icons/check.svg",  label: "Save" },
  { key: "image",  icon: "/icons/image.svg",  label: "Add image" },
  { key: "export", icon: "/icons/export.svg", label: "Export" },
  { key: "bg",     icon: "/icons/grid.svg",   label: "Background" },
  { key: "text",   icon: "/icons/text.svg",   label: "Add text" },
  { key: "pen",    icon: "/icons/pen.svg",    label: "Add drawing" },
];

const BASE = { w: 900, h: 600 };

export default function BoardActions({ onAction, onFilesSelected, disabled = {} }) {
  const fileInputRef = useRef(null);
  const { setItems, pushHistory, setMode, mode } = useBoardStore();

  const handleClick = (key) => {
    if (key === "image") {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
      return;
    }

    if (key === "text") {
      pushHistory();
      setMode("idle");

      setItems((prev) => {
        const maxZ = prev.reduce((m, it) => Math.max(m, it.z ?? 0), 0);
        const id = crypto.randomUUID();

        const w = 260;
        const fontSize = 28;
        const lineHeight = 1.2;
        const h = Math.ceil(fontSize * lineHeight);
        const x = (BASE.w - w) / 2;
        const y = (BASE.h - h) / 2;

        return [
          ...prev,
          {
            id,
            kind: "text",
            text: "Double-click to edit",
            x,
            y,
            w,
            h,
            rot: 0,
            z: maxZ + 1,
            fontSize,
            fontFamily: "Arial",
            description: "",
            url: "",
            quantity: 1,
            cost: "",
            locked: false,
            hidden: false,
          }
        ];
      });

      return;
    }

    if (key === "pen") {
      const current = useBoardStore.getState().mode;
      setMode(current === "draw" ? "idle" : "draw");
      return;
    }

    if (key === "bg") {
      setMode("bg");
      if (typeof onAction === "function") {
        onAction(key);
      }
      return;
    }

    if (typeof onAction === "function") {
      onAction(key);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (typeof onFilesSelected === "function") {
      onFilesSelected(files);
    }
  };

  return (
    <div className={styles.actionsRow}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      {ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`${styles.actionBtn} ${
            a.key === "pen" && mode === "draw" ? styles.actionBtnActive : ""
          }`}
          onClick={() => handleClick(a.key)}
          disabled={!!disabled[a.key]}
          aria-label={a.label}
        >
          <Image src={a.icon} alt="" width={20} height={20} unoptimized />
        </button>
      ))}
    </div>
  );
}