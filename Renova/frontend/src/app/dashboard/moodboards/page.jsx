"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/boards/Sidebar";
import "../../../styles/boards.css";

const BOARDS_PER_PAGE = 6;

function getApiBaseUrl() {
  if (typeof window === "undefined") return "";

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const host = hostname.includes(":")
    ? hostname.startsWith("[")
      ? hostname
      : `[${hostname}]`
    : hostname;

  return process.env.NEXT_PUBLIC_API_BASE_URL || `${protocol}//${host}:8080`;
}

function getThumbUrl(apiBaseUrl, thumb) {
  if (!thumb) return "";
  if (thumb.startsWith("http://") || thumb.startsWith("https://")) return thumb;
  const path = thumb.startsWith("/") ? thumb : `/${thumb}`;
  return `${apiBaseUrl}${path}`;
}

export default function MoodboardsHubPage() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [usage, setUsage] = useState(null);
  const [denyShake, setDenyShake] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyMsg, setDenyMsg] = useState("");
  const [brokenThumbIds, setBrokenThumbIds] = useState(() => new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const denyWrapRef = useRef(null);

  const selectedCount = selectedIds.size;
  const boardCount = boards.length;
  const totalPages = Math.max(1, Math.ceil(boardCount / BOARDS_PER_PAGE));
  const startIndex = (currentPage - 1) * BOARDS_PER_PAGE;
  const endIndex = startIndex + BOARDS_PER_PAGE;

  const visibleBoards = useMemo(() => {
    return boards.slice(startIndex, endIndex);
  }, [boards, startIndex, endIndex]);

  useEffect(() => {
    setApiBaseUrl(getApiBaseUrl());
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function fetchBoards() {
    if (!apiBaseUrl) return;

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${apiBaseUrl}/api/moodboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load moodboards");
      const data = await res.json();
      setBoards(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch moodboards:", err);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsage() {
    if (!apiBaseUrl) return;

    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${apiBaseUrl}/api/plans/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load usage");
      const data = await res.json();
      setUsage(data?.usage || null);
    } catch (e) {
      console.error("usage fetch failed:", e);
      setUsage(null);
    }
  }

  useEffect(() => {
    if (!apiBaseUrl) return;
    fetchUsage();
    fetchBoards();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchBoards();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!denyOpen) return;

    function onDocMouseDown(e) {
      if (!denyWrapRef.current) return;
      if (!denyWrapRef.current.contains(e.target)) {
        setDenyOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [denyOpen]);

  const moodboardsLimit = Number(usage?.moodboardsLimit ?? 0);
  const moodboardsUsed = Math.max(Number(usage?.moodboardsUsed ?? 0), boardCount);
  const atLimit = moodboardsLimit > 0 && moodboardsUsed >= moodboardsLimit;
  const remainingBoards =
    moodboardsLimit > 0 ? Math.max(moodboardsLimit - moodboardsUsed, 0) : null;

  const usageLabel = useMemo(() => {
    if (moodboardsLimit <= 0) return "Unlimited moodboards";
    if (remainingBoards === 0) return "You’ve used all available moodboards";
    if (remainingBoards === 1) return "1 moodboard remaining";
    return `${remainingBoards} moodboards remaining`;
  }, [moodboardsLimit, remainingBoards]);

  const paginationLabel = useMemo(() => {
    if (boardCount === 0) return "0 of 0";
    const start = startIndex + 1;
    const end = Math.min(endIndex, boardCount);
    return `${start}-${end} of ${boardCount}`;
  }, [boardCount, startIndex, endIndex]);

  function toggleSelectMode() {
    setSelectMode((value) => {
      const next = !value;
      if (!next) setSelectedIds(new Set());
      return next;
    });
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markThumbBroken(id) {
    setBrokenThumbIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedCount === 0) return;

    const ok = window.confirm(
      `Delete ${selectedCount} moodboard${
        selectedCount === 1 ? "" : "s"
      }? This cannot be undone.`
    );
    if (!ok) return;

    try {
      const token = localStorage.getItem("accessToken");
      const ids = Array.from(selectedIds);

      const results = await Promise.all(
        ids.map((id) =>
          fetch(`${apiBaseUrl}/api/moodboard/${id}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
        )
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        throw new Error(`Failed to delete ${failed.length} moodboard(s).`);
      }

      setBoards((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      fetchUsage();
    } catch (e) {
      alert(e?.message || "Could not delete selected moodboards.");
    }
  }

  function denyCreate(e) {
    e.preventDefault();
    e.stopPropagation();

    setDenyShake(false);
    requestAnimationFrame(() => setDenyShake(true));
    window.setTimeout(() => setDenyShake(false), 480);

    setDenyMsg(
      `You’ve reached your moodboard limit (${moodboardsUsed}/${moodboardsLimit}). Upgrade to create more.`
    );
    setDenyOpen(true);
  }

  if (loading) {
    return (
      <div className="boards-theme">
        <main className="boards-shell">
          <aside className="boards-sidebar">
            <Sidebar />
          </aside>
          <section className="boards-content">
            <div className="boards-panel">
              <div className="boards-loading-state">Loading your moodboards...</div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="boards-theme">
      <main className="boards-shell">
        <aside className="boards-sidebar">
          <Sidebar />
        </aside>

        <section className="boards-content">
          <div className="boards-panel">
            <div className="boards-toolbar">
              <div className="boards-toolbar-copy">
                <div className="boards-kicker">Workspace</div>
                <div className="boards-heading-row">
                  <h1 className="boards-title boards-title--compact">Moodboards</h1>
                </div>
                <p className="boards-subtitle">
                  Keep your renovation ideas, references, and room directions organized in one place.
                </p>
              </div>
            </div>

            <div className="boards-cta boards-cta--hero">
              <div className="cta-copy">
                <h2>Create moodboards for your renovation projects</h2>
                <p>
                  Start new concepts, compare directions, and keep room inspiration grouped by project.
                </p>

                <div className="boards-summary">
                  <div className="boards-summary-card">
                    <span className="boards-summary-label">Usage</span>
                    <strong
                      className={
                        atLimit
                          ? "boards-summary-value boards-summary-value--danger"
                          : "boards-summary-value"
                      }
                    >
                      {moodboardsLimit > 0 ? `${moodboardsUsed} / ${moodboardsLimit}` : "Unlimited"}
                    </strong>
                  </div>

                  <div className="boards-summary-card">
                    <span className="boards-summary-label">Status</span>
                    <strong
                      className={
                        atLimit
                          ? "boards-summary-value boards-summary-value--danger"
                          : "boards-summary-value"
                      }
                    >
                      {usageLabel}
                    </strong>
                  </div>
                </div>
              </div>

              <div
                className={`cta-btn-wrap ${denyOpen ? "cta-btn-wrap--open" : ""}`}
                ref={denyWrapRef}
              >
                <Link
                  href="/dashboard/moodboards/new"
                  className={`cta-btn cta-btn--primary ${atLimit ? "cta-btn--disabled" : ""} ${
                    denyShake ? "cta-btn--shake" : ""
                  }`}
                  onClick={atLimit ? denyCreate : undefined}
                  aria-disabled={atLimit ? "true" : "false"}
                  title={
                    atLimit
                      ? `Limit reached (${moodboardsUsed}/${moodboardsLimit})`
                      : "Create a new moodboard"
                  }
                >
                  Create New Moodboard
                </Link>

                {denyOpen && atLimit ? (
                  <div className="deny-pop" role="status" aria-live="polite">
                    <div className="deny-pop-title">Moodboard limit reached</div>
                    <div className="deny-pop-body">{denyMsg}</div>
                    <div className="deny-pop-actions">
                      <Link className="deny-pop-primary" href="/account?tab=plans">
                        Upgrade plan
                      </Link>
                      <button
                        type="button"
                        className="deny-pop-ghost"
                        onClick={() => setDenyOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {boardCount > 0 ? (
              <div className="boards-collection-bar">
                <div className="boards-collection-copy">
                  <div className="boards-collection-title">All moodboards</div>
                  <div className="boards-collection-subtitle">
                    {selectMode
                      ? selectedCount > 0
                        ? `${selectedCount} selected`
                        : "Select the moodboards you want to manage"
                      : `${boardCount} saved ${boardCount === 1 ? "board" : "boards"}`}
                  </div>
                </div>

                <div className="boards-collection-actions">
                  {selectMode ? (
                    <>
                      <button
                        type="button"
                        onClick={deleteSelected}
                        disabled={selectedCount === 0}
                        className="toolbar-btn toolbar-btn--danger"
                        title={selectedCount ? "Delete selected" : "Select moodboards first"}
                      >
                        Delete selected{selectedCount ? ` (${selectedCount})` : ""}
                      </button>

                      <button
                        type="button"
                        onClick={toggleSelectMode}
                        className="toolbar-btn toolbar-btn--ghost"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleSelectMode}
                      disabled={boardCount === 0}
                      className="toolbar-btn toolbar-btn--ghost"
                    >
                      Select boards
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {boardCount === 0 ? (
              <div className="boards-empty">
                <div className="boards-empty-icon" aria-hidden="true">
                  ✨
                </div>
                <h2 className="boards-empty-title">No moodboards yet</h2>
                <p className="boards-empty-copy">
                  Create your first board to start collecting room inspiration, layout ideas, and material directions.
                </p>
                <div className="boards-empty-actions">
                  <Link
                    href="/dashboard/moodboards/new"
                    className={`cta-btn cta-btn--primary ${atLimit ? "cta-btn--disabled" : ""}`}
                    onClick={atLimit ? denyCreate : undefined}
                    aria-disabled={atLimit ? "true" : "false"}
                  >
                    Create your first moodboard
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="boards-grid">
                  {visibleBoards.map((board) => {
                    const isSelected = selectedIds.has(board.id);
                    const thumbUrl =
                      board.thumbnailUrl && !brokenThumbIds.has(board.id)
                        ? `${getThumbUrl(apiBaseUrl, board.thumbnailUrl)}?v=${encodeURIComponent(
                            board.updatedAt || ""
                          )}`
                        : "";

                    const cardInner = (
                      <>
                        <div className="board-card-media">
                          {selectMode ? (
                            <span
                              className={`board-select-chip ${
                                isSelected ? "board-select-chip--selected" : ""
                              }`}
                              aria-hidden="true"
                            >
                              {isSelected ? "✓" : "○"}
                            </span>
                          ) : null}

                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={board.title || "Moodboard thumbnail"}
                              className="thumb-img"
                              loading="lazy"
                              decoding="async"
                              onError={() => markThumbBroken(board.id)}
                            />
                          ) : (
                            <div className="thumb-skeleton board-thumb-placeholder">
                              <span>No preview yet</span>
                            </div>
                          )}
                        </div>

                        <div className="board-meta board-meta--rich">
                          <h3>{board.title || "Untitled Moodboard"}</h3>
                          <p className="board-meta-note">
                            {selectMode
                              ? isSelected
                                ? "Selected for bulk actions"
                                : "Tap to add this board to your selection"
                              : "Open board →"}
                          </p>
                        </div>
                      </>
                    );

                    if (selectMode) {
                      return (
                        <div
                          key={board.id}
                          className={`board-card board-card--button board-card--rich ${
                            isSelected ? "board-card--selected" : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleSelected(board.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleSelected(board.id);
                            }
                          }}
                        >
                          {cardInner}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={board.id}
                        href={`/dashboard/moodboards/${board.id}`}
                        className="board-card board-card--rich"
                      >
                        {cardInner}
                      </Link>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="boards-pagination" aria-label="Moodboard pages">
                    <button
                      type="button"
                      className="boards-page-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>

                    <div className="boards-page-status">
                      <span className="boards-page-count">
                        Page {currentPage} of {totalPages}
                      </span>
                      <span className="boards-page-range">{paginationLabel}</span>
                    </div>

                    <button
                      type="button"
                      className="boards-page-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                ) : null}
              </>
            )}

            <footer className="boards-footer">
              <Link href="/dashboard/explore" className="link-muted">
                Explore community boards →
              </Link>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}