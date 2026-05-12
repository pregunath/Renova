"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Image as AntImage } from "antd";
import Sidebar from "@/components/boards/Sidebar";
import "../../../styles/boards.css";

const ITEMS_PER_PAGE = 6;

function getApiUrl() {
  if (typeof window === "undefined") return "";

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const host = hostname.includes(":")
    ? hostname.startsWith("[")
      ? hostname
      : `[${hostname}]`
    : hostname;

  return (
    process.env.NEXT_PUBLIC_API_BASE_URL || `${protocol}//${host}:8080`
  );
}

function toAbsoluteUrl(baseUrl, value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${baseUrl}${path}`;
}

function formatCategoryLabel(value) {
  if (!value) return "Uncategorized";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ExplorePage() {
  const [tab, setTab] = useState("moodboards");
  const [category, setCategory] = useState("all");
  const [activeTag, setActiveTag] = useState(null);
  const [search, setSearch] = useState("");

  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [previewItem, setPreviewItem] = useState(null);
  const [cloningId, setCloningId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const router = useRouter();

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, category, activeTag, search]);

  useEffect(() => {
    let cancelled = false;

    async function loadBoards() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const baseUrl = getApiUrl();
        const token = localStorage.getItem("accessToken");

        const res = await fetch(`${baseUrl}/api/moodboard/public`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load public boards.");
        }

        const json = await res.json();
        const rawBoards = Array.isArray(json?.boards) ? json.boards : [];

        const boardsEnhanced = await Promise.all(
          rawBoards.map(async (b) => {
            const board = {
              ...b,
              category: b.category || "uncategorized",
              tags: Array.isArray(b.tags) ? b.tags : [],
            };

            try {
              const genRes = await fetch(
                `${baseUrl}/api/generation/board/${b.id}`,
                {
                  headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : {},
                  cache: "no-store",
                }
              );

              if (!genRes.ok) {
                return {
                  ...board,
                  generations: [],
                  fullThumbnailUrl: b.thumbnailUrl
                    ? toAbsoluteUrl(baseUrl, b.thumbnailUrl)
                    : "/feat-room.jpg",
                };
              }

              const genJson = await genRes.json();

              const genArr = Array.isArray(genJson)
                ? genJson
                : Array.isArray(genJson.generations)
                ? genJson.generations
                : Array.isArray(genJson.data)
                ? genJson.data
                : [];

              const generationUrls = genArr
                .map((g) =>
                  g?.id
                    ? `${baseUrl}/api/media/generation/${g.id}`
                    : ""
                )
                .filter(Boolean);

              return {
                ...board,
                generations: generationUrls,
                fullThumbnailUrl: b.thumbnailUrl
                  ? toAbsoluteUrl(baseUrl, b.thumbnailUrl)
                  : generationUrls[0] || "/feat-room.jpg",
              };
            } catch (err) {
              console.error("Generation error:", err);
              return {
                ...board,
                generations: [],
                fullThumbnailUrl: b.thumbnailUrl
                  ? toAbsoluteUrl(baseUrl, b.thumbnailUrl)
                  : "/feat-room.jpg",
              };
            }
          })
        );

        if (!cancelled) {
          setBoards(boardsEnhanced);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setErrorMsg(err.message || "Unexpected error loading boards.");
          setBoards([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBoards();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const all = new Set();
    boards.forEach((b) => {
      if (b.category) all.add(b.category);
    });
    return ["all", ...Array.from(all)];
  }, [boards]);

  const tags = useMemo(() => {
    const all = new Set();
    boards.forEach((b) => {
      (b.tags || []).forEach((tag) => all.add(tag));
    });
    return Array.from(all);
  }, [boards]);

  const flattenedGenerations = useMemo(() => {
    return boards.flatMap((b) =>
      (b.generations || []).map((url, index) => ({
        id: `${b.id}-${index}`,
        parentId: b.id,
        parentTitle: b.title,
        category: b.category,
        tags: b.tags || [],
        url,
      }))
    );
  }, [boards]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredMoodboards = useMemo(() => {
    return boards.filter((b) => {
      const categoryMatch = category === "all" || b.category === category;
      const tagMatch = !activeTag || (b.tags || []).includes(activeTag);

      const searchMatch =
        !normalizedSearch ||
        (b.title || "").toLowerCase().includes(normalizedSearch) ||
        (b.category || "").toLowerCase().includes(normalizedSearch) ||
        (b.tags || []).some((tag) =>
          String(tag).toLowerCase().includes(normalizedSearch)
        );

      return categoryMatch && tagMatch && searchMatch;
    });
  }, [boards, category, activeTag, normalizedSearch]);

  const filteredGenerations = useMemo(() => {
    return flattenedGenerations.filter((g) => {
      const categoryMatch = category === "all" || g.category === category;
      const tagMatch = !activeTag || (g.tags || []).includes(activeTag);

      const searchMatch =
        !normalizedSearch ||
        (g.parentTitle || "").toLowerCase().includes(normalizedSearch) ||
        (g.category || "").toLowerCase().includes(normalizedSearch) ||
        (g.tags || []).some((tag) =>
          String(tag).toLowerCase().includes(normalizedSearch)
        );

      return categoryMatch && tagMatch && searchMatch;
    });
  }, [flattenedGenerations, category, activeTag, normalizedSearch]);

  const visibleItems =
    tab === "moodboards" ? filteredMoodboards : filteredGenerations;

  const totalPages = Math.max(
    1,
    Math.ceil(visibleItems.length / ITEMS_PER_PAGE)
  );

  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const pagedItems = visibleItems.slice(pageStart, pageEnd);

  const pageLabel = useMemo(() => {
    if (!visibleItems.length) return "0 of 0";
    const start = pageStart + 1;
    const end = Math.min(pageEnd, visibleItems.length);
    return `${start}-${end} of ${visibleItems.length}`;
  }, [visibleItems.length, pageStart, pageEnd]);

  const stats = useMemo(() => {
    return {
      boards: boards.length,
      renders: flattenedGenerations.length,
      categories: Math.max(categories.length - 1, 0),
    };
  }, [boards.length, flattenedGenerations.length, categories.length]);

  const handleClone = async (boardId) => {
    if (cloningId) return;

    const token = localStorage.getItem("accessToken");

    if (!token) {
      setErrorMsg("Please log in to use this template.");
      router.push("/login");
      return;
    }

    try {
      setErrorMsg(null);
      setCloningId(boardId);

      const res = await fetch(`${getApiUrl()}/api/moodboard/${boardId}/clone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 403) throw new Error("This moodboard is not public.");
      if (res.status === 404) throw new Error("Moodboard not found.");
      if (!res.ok || !data?.id) {
        throw new Error(data?.message || "Failed to clone moodboard.");
      }

      router.push(`/dashboard/moodboards/${data.id}`);
    } catch (err) {
      console.error("Clone error:", err);
      setErrorMsg(err.message || "Failed to clone moodboard.");
    } finally {
      setCloningId(null);
    }
  };

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
                <div className="boards-kicker">Community</div>
                <div className="boards-heading-row">
                  <h1 className="boards-title boards-title--compact">Explore</h1>
                </div>
                <p className="boards-subtitle">
                  Browse public moodboards and community AI outputs for ideas you
                  can remix into your own renovation projects.
                </p>
              </div>
            </div>

            <div className="boards-cta boards-cta--hero explore-hero">
              <div className="cta-copy">
                <h2>Discover inspiration from the Renova community</h2>
                <p>
                  Explore room concepts, compare styles, and clone public
                  moodboards into your own workspace when you find a direction
                  worth building on.
                </p>

                <div className="boards-summary">
                  <div className="boards-summary-card">
                    <span className="boards-summary-label">Public boards</span>
                    <strong className="boards-summary-value">{stats.boards}</strong>
                  </div>

                  <div className="boards-summary-card">
                    <span className="boards-summary-label">Categories</span>
                    <strong className="boards-summary-value">{stats.categories}</strong>
                  </div>
                </div>
              </div>

              <div className="explore-hero-note">
                <div className="explore-hero-note-title">Quick idea</div>
                <div className="explore-hero-note-text">
                  When you find a board you like, clone it first, then tweak one
                  room, one material, or one lighting choice at a time.
                </div>
              </div>
            </div>

            {errorMsg ? (
              <div className="explore-error-banner">{errorMsg}</div>
            ) : null}

            <div className="explore-v2-tabs">
              <button
                type="button"
                className={`explore-v2-tab ${
                  tab === "moodboards" ? "explore-v2-tab--active" : ""
                }`}
                onClick={() => setTab("moodboards")}
              >
                Moodboards
              </button>

              <button
                type="button"
                className={`explore-v2-tab ${
                  tab === "generations" ? "explore-v2-tab--active" : ""
                }`}
                onClick={() => setTab("generations")}
              >
                AI Generations
              </button>
            </div>

            <div className="explore-v2-filters">
              <div className="explore-v2-search-wrap">
                <input
                  type="text"
                  className="explore-v2-search"
                  placeholder={
                    tab === "moodboards"
                      ? "Search boards, categories, or tags"
                      : "Search renders by board, category, or tag"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="filter-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "All Categories" : formatCategoryLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            {tags.length ? (
              <div className="filter-tags explore-v2-tags">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-btn ${activeTag === tag ? "active" : ""}`}
                    onClick={() =>
                      setActiveTag(activeTag === tag ? null : tag)
                    }
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="boards-collection-bar">
              <div className="boards-collection-copy">
                <div className="boards-collection-title">
                  {tab === "moodboards" ? "Public moodboards" : "Community renders"}
                </div>
                <div className="boards-collection-subtitle">
                  {loading
                    ? "Loading community content..."
                    : visibleItems.length
                    ? `${visibleItems.length} result${
                        visibleItems.length === 1 ? "" : "s"
                      } found`
                    : "No results match your current filters"}
                </div>
              </div>

              {totalPages > 1 ? (
                <div className="boards-collection-actions">
                  <button
                    type="button"
                    className="toolbar-btn toolbar-btn--ghost"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    ← Previous
                  </button>

                  <div className="generations-page-pill">
                    Page {safePage} of {totalPages}
                  </div>

                  <button
                    type="button"
                    className="toolbar-btn toolbar-btn--ghost"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage === totalPages}
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="boards-loading-state">
                Loading community inspiration...
              </div>
            ) : !visibleItems.length ? (
              <div className="boards-empty">
                <div className="boards-empty-icon" aria-hidden="true">
                  🔎
                </div>
                <h2 className="boards-empty-title">Nothing matched your filters</h2>
                <p className="boards-empty-copy">
                  Try another category, remove a tag, or search with a broader term.
                </p>
              </div>
            ) : tab === "moodboards" ? (
              <div className="explore-v2-grid">
                {pagedItems.map((board) => (
                  <article
                    key={board.id}
                    className="explore-v2-board-card"
                  >
                    <button
                      type="button"
                      className="explore-v2-board-media"
                      onClick={() => setConfirmId(board.id)}
                    >
                      {cloningId === board.id ? (
                        <div className="explore-v2-clone-overlay">
                          Cloning...
                        </div>
                      ) : null}

                      <img
                        src={board.fullThumbnailUrl || "/feat-room.jpg"}
                        alt={board.title || "Public moodboard"}
                        className="explore-v2-board-image"
                        onError={(e) => {
                          e.currentTarget.src = "/feat-room.jpg";
                        }}
                      />

                      <div className="explore-v2-board-overlay">
                        <span>Clone this board</span>
                      </div>
                    </button>

                    <div className="explore-v2-board-body">
                      <div className="explore-v2-board-top">
                        <div className="explore-v2-chip">
                          {formatCategoryLabel(board.category)}
                        </div>
                      </div>

                      <h3 className="explore-v2-board-title">
                        {board.title || "Untitled moodboard"}
                      </h3>

                      <div className="explore-v2-board-tags">
                        {(board.tags || []).slice(0, 3).map((tag) => (
                          <span key={tag} className="explore-v2-mini-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="explore-v2-board-actions">
                        <button
                          type="button"
                          className="generation-action-btn"
                          onClick={() => setConfirmId(board.id)}
                          disabled={cloningId === board.id}
                        >
                          {cloningId === board.id ? "Cloning..." : "Clone moodboard"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="explore-v2-gallery">
                {pagedItems.map((item) => (
                  <article key={item.id} className="explore-v2-gen-card">
                    <button
                      type="button"
                      className="explore-v2-gen-media"
                      onClick={() =>
                        setPreviewItem({
                          src: item.url,
                          title: item.parentTitle || "AI render",
                        })
                      }
                    >
                      <img
                        src={item.url}
                        alt={item.parentTitle || "AI generation"}
                        className="explore-v2-gen-image"
                      />
                      <div className="explore-v2-gen-overlay">
                        <span>Preview</span>
                      </div>
                    </button>

                    <div className="explore-v2-gen-body">
                      <div className="explore-v2-chip">
                        {formatCategoryLabel(item.category)}
                      </div>
                      <h3 className="explore-v2-gen-title">
                        {item.parentTitle || "Untitled board"}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="boards-pagination" aria-label="Explore pages">
                <button
                  type="button"
                  className="boards-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  ← Previous
                </button>

                <div className="boards-page-status">
                  <span className="boards-page-count">
                    Page {safePage} of {totalPages}
                  </span>
                  <span className="boards-page-range">{pageLabel}</span>
                </div>

                <button
                  type="button"
                  className="boards-page-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next →
                </button>
              </div>
            ) : null}

            <footer className="boards-footer">
              <p className="link-muted">
                More community browsing features coming soon.
              </p>
            </footer>
          </div>
        </section>
      </main>

      {confirmId ? (
        <div
          className="confirm-overlay"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Make a copy?</h3>
            <p>
              This public moodboard will be added to your projects so you can
              customize it freely.
            </p>

            <div className="confirm-buttons">
              <button
                className="cancel-btn"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </button>

              <button
                className="confirm-btn"
                onClick={() => {
                  handleClone(confirmId);
                  setConfirmId(null);
                }}
              >
                Clone moodboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewItem ? (
        <AntImage
          src={previewItem.src}
          alt={previewItem.title}
          style={{ display: "none" }}
          preview={{
            visible: true,
            src: previewItem.src,
            onVisibleChange: (visible) => {
              if (!visible) setPreviewItem(null);
            },
          }}
        />
      ) : null}
    </div>
  );
}