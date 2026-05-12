"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/boards/Sidebar";
import "../../../styles/boards.css";

const GENERATIONS_PER_PAGE = 4;

const MODEL_LABELS = {
  "fal-ai/bytedance/seedream/v4.5/edit": "Seedream v4.5",
  "fal-ai/bytedance/seedream/v5/lite/edit": "Seedream v5 Lite",
  "fal-ai/bytedance/seedream/v4/edit": "Seedream v4",
  "fal-ai/nano-banana-pro/edit": "Nano Banana Pro",
  "fal-ai/nano-banana-2/edit": "Nano Banana 2",
};

function getGenerationModelLabel(generation) {
  const raw =
    generation?.modelLabel ||
    generation?.model ||
    generation?.modelKey ||
    generation?.aiModel ||
    generation?.provider ||
    generation?.engine ||
    generation?.metadata?.model ||
    generation?.settings?.model ||
    "";

  return MODEL_LABELS[raw] || raw || "Unknown model";
}

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

function getImageUrl(apiBaseUrl, imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${apiBaseUrl}${path}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function AIGenerationsPage() {
  const [generations, setGenerations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [usage, setUsage] = useState(null);
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const modalBodyRef = useRef(null);

  useEffect(() => {
    setApiBaseUrl(getApiBaseUrl());
  }, []);

  useEffect(() => {
    if (!apiBaseUrl || hasLoaded) return;

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);

        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("accessToken")
            : null;

        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [generationsRes, usageRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/generation`, {
            headers,
            cache: "no-store",
          }),
          fetch(`${apiBaseUrl}/api/plans/usage`, {
            headers,
            cache: "no-store",
          }).catch(() => null),
        ]);

        if (!generationsRes.ok) {
          console.warn(
            "Failed to load generations:",
            await generationsRes.text()
          );
          if (!cancelled) {
            setGenerations([]);
            setHasLoaded(true);
          }
          return;
        }

        const generationsData = await generationsRes.json();

        if (!cancelled) {
          const gens = Array.isArray(generationsData)
            ? generationsData
            : Array.isArray(generationsData.generations)
            ? generationsData.generations
            : Array.isArray(generationsData.data)
            ? generationsData.data
            : [];

          setGenerations(gens);
          setHasLoaded(true);
        }

        if (usageRes && usageRes.ok) {
          const usageData = await usageRes.json();
          if (!cancelled) {
            setUsage(usageData?.usage || null);
          }
        }
      } catch (err) {
        console.error("Failed to load generations:", err);
        if (!cancelled) {
          setGenerations([]);
          setHasLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, hasLoaded]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(generations.length / GENERATIONS_PER_PAGE)
    );
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [generations.length, currentPage]);

  useEffect(() => {
    if (!previewImage) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        setPreviewImage(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  const generationsLimit = Number(usage?.generationsLimit ?? 0);
  const generationsUsed = Math.max(
    Number(usage?.generationsUsed ?? 0),
    generations.length
  );
  const remainingGenerations =
    generationsLimit > 0
      ? Math.max(generationsLimit - generationsUsed, 0)
      : null;

  const totalPages = Math.max(
    1,
    Math.ceil(generations.length / GENERATIONS_PER_PAGE)
  );

  const pageStart = (currentPage - 1) * GENERATIONS_PER_PAGE;
  const pageEnd = pageStart + GENERATIONS_PER_PAGE;

  const visibleGenerations = useMemo(() => {
    return generations.slice(pageStart, pageEnd);
  }, [generations, pageStart, pageEnd]);

  const paginationLabel = useMemo(() => {
    if (generations.length === 0) return "0 of 0";
    const start = pageStart + 1;
    const end = Math.min(pageEnd, generations.length);
    return `${start}-${end} of ${generations.length}`;
  }, [generations.length, pageStart, pageEnd]);

  const usageLabel = useMemo(() => {
    if (generationsLimit <= 0) return "Unlimited generations";
    if (remainingGenerations === 0) return "You’ve used all available generations";
    if (remainingGenerations === 1) return "1 generation remaining";
    return `${remainingGenerations} generations remaining`;
  }, [generationsLimit, remainingGenerations]);

  const truncateText = (text, maxLength = 140) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) : text;
  };

  function togglePromptExpand(id) {
    setExpandedPrompts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function closePreview() {
    setPreviewImage(null);
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
                  <h1 className="boards-title boards-title--compact">
                    AI Generations
                  </h1>
                </div>
                <p className="boards-subtitle">
                  Review your AI-generated designs, revisit strong prompts, and
                  keep your best outputs easy to compare.
                </p>
              </div>
            </div>

            <div className="boards-cta boards-cta--hero ai-hero">
              <div className="cta-copy">
                <h2>Your saved AI design outputs</h2>
                <p>
                  Use this space to compare prompts, spot what worked, and
                  download the renders worth keeping.
                </p>

                <div className="boards-summary">
                  <div className="boards-summary-card">
                    <span className="boards-summary-label">Saved</span>
                    <strong className="boards-summary-value">
                      {generations.length}{" "}
                      {generations.length === 1 ? "render" : "renders"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="ai-hero-side">
                <div className="ai-hero-note">
                  <div className="ai-hero-note-title">Best practice</div>
                  <div className="ai-hero-note-text">
                    Save the renders that get closest, then iterate with small
                    prompt changes instead of starting over.
                  </div>
                </div>
              </div>
            </div>

            {generations.length > 0 ? (
              <div className="boards-collection-bar">
                <div className="boards-collection-copy">
                  <div className="boards-collection-title">All generations</div>
                  <div className="boards-collection-subtitle">
                    Browse your saved renders and open any image at full size.
                  </div>
                </div>

                {totalPages > 1 ? (
                  <div className="boards-collection-actions">
                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn--ghost"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>

                    <div className="generations-page-pill">
                      Page {currentPage} of {totalPages}
                    </div>

                    <button
                      type="button"
                      className="toolbar-btn toolbar-btn--ghost"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next →
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isLoading && !generations.length ? (
              <div className="boards-loading-state">
                Loading your AI generations...
              </div>
            ) : !generations.length ? (
              <div className="boards-empty">
                <div className="boards-empty-icon" aria-hidden="true">
                  ✨
                </div>
                <h2 className="boards-empty-title">No AI generations yet</h2>
                <p className="boards-empty-copy">
                  Your saved renders will appear here once you start generating
                  designs from your projects.
                </p>
                <div className="boards-empty-actions">
                  <Link
                    href="/dashboard/moodboards"
                    className="cta-btn cta-btn--primary"
                  >
                    Go to moodboards
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="generations-list">
                  {visibleGenerations.map((generation) => {
                    const imageSrc = getImageUrl(apiBaseUrl, generation.imageUrl);
                    const prompt =
                      generation.prompt ||
                      generation.title ||
                      "No prompt provided";
                    const isExpanded = expandedPrompts[generation.id];
                    const shouldShowExpand = prompt.length > 140;
                    const displayPrompt = isExpanded
                      ? prompt
                      : truncateText(prompt, 140) +
                        (shouldShowExpand ? "..." : "");

                    const createdAt = formatDate(
                      generation.createdAt ||
                        generation.created_at ||
                        generation.updatedAt ||
                        generation.updated_at
                    );
                    
                    const modelLabel = getGenerationModelLabel(generation);
                    return (
                      <article
                        key={generation.id}
                        className="generation-card-v2"
                      >
                        <button
                          type="button"
                          className="generation-card-media"
                          onClick={() =>
                            setPreviewImage({
                              src: imageSrc,
                              prompt,
                            })
                          }
                        >
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={prompt}
                              className="generation-card-image"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}

                          <div className="generation-card-overlay">
                            <span>Preview image</span>
                          </div>
                        </button>

                        <div className="generation-card-body">
                          <div className="generation-card-top">
                            {createdAt ? (
                              <div className="generation-card-date">
                                {createdAt}
                              </div>
                            ) : null}
                          </div>

                          <div className="generation-card-section">
                            <div className="generation-card-kicker">Prompt</div>
                            <p className="generation-card-prompt">
                              {displayPrompt}
                            </p>
                          </div>

                          <div className="generation-card-section">
                            <div className="generation-card-kicker">Model</div>
                            <div className="generation-card-model-value">
                              {modelLabel}
                            </div>
                          </div>

                          {shouldShowExpand ? (
                            <button
                              type="button"
                              className="generation-inline-action"
                              onClick={() => togglePromptExpand(generation.id)}
                            >
                              {isExpanded ? "Show less" : "Show more"}
                            </button>
                          ) : null}

                          <div className="generation-card-actions">
                            <button
                              type="button"
                              className="generation-action-btn"
                              onClick={() =>
                                setPreviewImage({
                                  src: imageSrc,
                                  prompt,
                                })
                              }
                            >
                              View full image
                            </button>

                            {imageSrc ? (
                              <a
                                href={imageSrc}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="generation-action-btn generation-action-btn--ghost"
                              >
                                Download
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="boards-pagination" aria-label="Generation pages">
                    <button
                      type="button"
                      className="boards-page-btn"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      ← Previous
                    </button>

                    <div className="boards-page-status">
                      <span className="boards-page-count">
                        Page {currentPage} of {totalPages}
                      </span>
                      <span className="boards-page-range">
                        {paginationLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="boards-page-btn"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
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
                Explore community inspiration →
              </Link>
            </footer>
          </div>
        </section>
      </main>

      {previewImage ? (
        <div className="generation-preview-modal" onClick={closePreview}>
          <div
            className="generation-preview-dialog"
            onClick={(e) => e.stopPropagation()}
            ref={modalBodyRef}
          >
            <button
              type="button"
              className="generation-preview-close"
              onClick={closePreview}
              aria-label="Close preview"
            >
              ×
            </button>

            <div className="generation-preview-image-wrap">
              <img
                src={previewImage.src}
                alt={previewImage.prompt}
                className="generation-preview-image"
              />
            </div>

            <div className="generation-preview-copy">
              <div className="generation-preview-title">Prompt</div>
              <p className="generation-preview-text">{previewImage.prompt}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}