"use client";

import { useState } from "react";
import styles from "@/styles/moodboard/Moodboard.module.scss";
import PinterestView from "./sidebar/PinterestView";
import AIGenView from "./sidebar/AIGenView";
import GenerationsView from "./sidebar/GenerationsView";

const TABS = ["Pinterest", "AI Gen", "Generations"];

export default function Sidebar({ moodboardId, generationResults, setGenerationResults, onGenerationCreated }) {
  const [tab, setTab] = useState("AI Gen");
  
  return (
    <>
      <nav className={styles.sidebarTabs} role="tablist" aria-label="Sidebar modes">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className={styles.sidebarBody}>
        <div
          className={
            tab === "Pinterest"
              ? styles.sidebarPanelActive
              : styles.sidebarPanelHidden
          }
        >
          <PinterestView />
        </div>

        <div
          className={
            tab === "AI Gen"
              ? styles.sidebarPanelActive
              : styles.sidebarPanelHidden
          }
        >
          <AIGenView 
            moodboardId={moodboardId}
            onGenerationCreated={onGenerationCreated} 
          />
        </div>

        <div
          className={
            tab === "Generations"
              ? styles.sidebarPanelActive
              : styles.sidebarPanelHidden
          }
        >
          <GenerationsView
            generationResults={generationResults}
            setGenerationResults={setGenerationResults}
          />
        </div>
      </div>
    </>
  );
}
