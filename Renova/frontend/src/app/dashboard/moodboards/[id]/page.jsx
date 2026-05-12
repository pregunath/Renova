"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Modal, Input, Switch, Button, message, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import BoardCanvas from "@/components/moodboard/BoardCanvas";
import Toolbar from "@/components/moodboard/Toolbar";
import Sidebar from "@/components/moodboard/Sidebar";
import BoardActions from "@/components/moodboard/BoardActions";
import BoardList from "@/components/moodboard/BoardList";
import { useBoardStore } from "@/contexts/boardStore";
import { toMoodboardDisplaySrc } from "@/utils/moodboardMedia";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const BASE = { w: 900, h: 600 };
const AUTOSAVE_DEBOUNCE_MS = 3000;
const THUMBNAIL_AUTOSAVE_DEBOUNCE_MS = 30000;
const MAX_IMAGE_RATIO = 0.5;

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

async function preloadSceneImages(items, moodboardId) {
  const urls =
    (items || [])
      .filter((it) => it?.kind === "image" && typeof it?.src === "string")
      .map((it) => toMoodboardDisplaySrc(it.src, moodboardId));

  await Promise.all(urls.map(preloadImage));
}

function buildScenePayload(items) {
  return {
    items: (items || []).map(({ displaySrc, ...rest }) => rest),
  };
}

function buildThumbnailSnapshot(items, background) {
  return JSON.stringify({ background: background ?? null, scene: buildScenePayload(items) });
}

function buildBoardSnapshot({ title, items, isPublic, background }) {
  return JSON.stringify({
    title: (title || "").trim(),
    isPublic: !!isPublic,
    background: background ?? null,
    width: BASE.w,
    height: BASE.h,
    scene: buildScenePayload(items),
  });
}

function getApiBaseUrl() {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const host = hostname.includes(":")
    ? hostname.startsWith("[")
      ? hostname
      : `[${hostname}]`
    : hostname;
  return `${protocol}//${host}:8080`;
}

export default function MoodboardPage() {
  const router = useRouter();
  const params = useParams();
  const moodboardId = params?.id;
  const resolvedApiBaseUrl = getApiBaseUrl();

  const canvasRef = useRef(null);
  const loadSeqRef = useRef(0);
  const saveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef("");
  const saveSeqRef = useRef(0);
  const isHydratingRef = useRef(false);
  const thumbTimerRef = useRef(null);
  const lastSavedThumbnailSnapshotRef = useRef("");

  const { items, setItems, pushHistory, setMode } = useBoardStore();

  const [viewMode, setViewMode] = useState("board");
  const [projectName, setProjectName] = useState("Untitled Moodboard");
  const [isPublic, setIsPublic] = useState(true);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [pendingImageCount, setPendingImageCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth <= 767;
    return false;
  });

  const [generationResults, setGenerationResults] = useState([]);
  const [otherMoodboards, setOtherMoodboards] = useState([]);
  const [isLoadingOtherMoodboards, setIsLoadingOtherMoodboards] = useState(false);

  const [background, setBackground] = useState("#ffffff");
  const [bgDraft, setBgDraft] = useState("#ffffff");
  const [isBgEditing, setIsBgEditing] = useState(false);

  useEffect(() => {
    document.body.classList.add(styles.moodboardPageBody);
    return () => document.body.classList.remove(styles.moodboardPageBody);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isBgEditing ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isBgEditing]);

  useEffect(() => {
    setViewMode("board");
  }, [moodboardId]);

  useEffect(() => {
    if (!moodboardId) return;

    const seq = ++loadSeqRef.current;
    const ac = new AbortController();
    let alive = true;
    let cancelled = false;

    const cleanup = () => {
      alive = false;
      cancelled = true;
      ac.abort();
    };

    isHydratingRef.current = true;
    setIsSceneReady(false);
    setItems([]);
    setProjectName("");
    setIsPublic(true);
    setBackground("#ffffff");
    setBgDraft("#ffffff");
    setIsBgEditing(false);

    if (moodboardId === "new") {
      (async () => {
        try {
          const token =
            typeof window !== "undefined"
              ? window.localStorage.getItem("accessToken")
              : null;

          const usageRes = await fetch(`${resolvedApiBaseUrl}/api/plans/usage`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: "no-store",
          });

          if (cancelled) return;

          if (usageRes.ok) {
            const usageJson = await usageRes.json();
            const used = Number(usageJson?.usage?.moodboardsUsed ?? 0);
            const limit = Number(usageJson?.usage?.moodboardsLimit ?? 0);
            const atLimit = limit > 0 && used >= limit;

            if (cancelled) return;

            if (atLimit) {
              message.error(
                `Moodboard limit reached (${used}/${limit}). Upgrade to create more.`
              );
              router.replace("/dashboard/moodboards?limit=1");
              return;
            }
          }

          setIsBoardLoading(false);
          setProjectName("Untitled Moodboard");
          setItems([]);
          lastSavedSnapshotRef.current = buildBoardSnapshot({
            title: "Untitled Moodboard",
            items: [],
            isPublic: true,
            background: "#ffffff",
          });
          isHydratingRef.current = false;
          setIsSceneReady(true);
        } catch (err) {
          if (cancelled) return;

          setIsBoardLoading(false);
          setProjectName("Untitled Moodboard");
          setItems([]);
          lastSavedSnapshotRef.current = buildBoardSnapshot({
            title: "Untitled Moodboard",
            items: [],
            isPublic: true,
            background: "#ffffff",
          });
          isHydratingRef.current = false;
          setIsSceneReady(true);
        }
      })();

      return cleanup;
    }

    setIsBoardLoading(true);

    (async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("accessToken")
            : null;

        const res = await fetch(`${resolvedApiBaseUrl}/api/moodboard/${moodboardId}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: ac.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load moodboard.");
        }

        const board = await res.json();
        if (!alive || seq !== loadSeqRef.current) return;

        const nextProjectName = board.title || "Untitled Moodboard";
        const nextIsPublic = typeof board.isPublic === "boolean" ? board.isPublic : true;
        const nextBackground = typeof board.background === "string" && board.background.trim() ? board.background : "#ffffff";

        let nextItems = [];
        if (board.scene && board.scene !== "null" && board.scene !== "") {
          try {
            const parsed = typeof board.scene === "string" ? JSON.parse(board.scene) : board.scene;
            nextItems = Array.isArray(parsed.items) ? parsed.items : [];
          } catch (err) {
            console.error("Failed to parse board scene", err);
            nextItems = [];
          }
        }

        await preloadSceneImages(nextItems, moodboardId);
        if (!alive || seq !== loadSeqRef.current) return;

        setProjectName(nextProjectName);
        setIsPublic(nextIsPublic);
        setBackground(nextBackground);
        setBgDraft(nextBackground);
        setItems(nextItems);

        if (nextItems.length === 0) {
          requestAnimationFrame(() => {
            if (!alive || seq !== loadSeqRef.current) return;
            setIsSceneReady(true);
          });
        }

        requestAnimationFrame(() => {
          if (!alive || seq !== loadSeqRef.current) return;

          lastSavedSnapshotRef.current = buildBoardSnapshot({
            title: nextProjectName,
            items: nextItems,
            isPublic: nextIsPublic,
            background: nextBackground,
          });
          lastSavedThumbnailSnapshotRef.current = buildThumbnailSnapshot(nextItems, nextBackground);
        });
      } catch (err) {
        if (!alive || seq !== loadSeqRef.current) return;
        console.error("Error loading moodboard", err);
        message.error(err?.message || "Failed to load moodboard.");
        setItems([]);
        setProjectName("");
        setIsPublic(true);
        setBackground("#ffffff");
        setBgDraft("#ffffff");
        setIsBgEditing(false);
        setIsBoardLoading(false);
        isHydratingRef.current = false;
      }
    })();

    return cleanup;
  }, [moodboardId, setItems, router]);

  useEffect(() => {
    if (!isBoardLoading) return;
    if (!isSceneReady) return;

    const id = requestAnimationFrame(() => {
      isHydratingRef.current = false;
      setIsBoardLoading(false);
    });

    return () => cancelAnimationFrame(id);
  }, [isBoardLoading, isSceneReady]);

  const saveBoardPatch = async ({ quiet = false } = {}) => {
    if (!moodboardId || moodboardId === "new") return false;
    if (isHydratingRef.current) return false;

    const title = projectName.trim();
    if (!title) return false;

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null;

    if (!token) return false;

    const snapshot = buildBoardSnapshot({
      title,
      items,
      isPublic,
      background,
    });

    if (snapshot === lastSavedSnapshotRef.current) return false;

    const seq = ++saveSeqRef.current;

    try {
      setIsAutosaving(true);

      const payload = JSON.parse(snapshot);

      const res = await fetch(`${resolvedApiBaseUrl}/api/moodboard/${moodboardId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to autosave moodboard");
      }

      if (seq === saveSeqRef.current) {
        lastSavedSnapshotRef.current = snapshot;
      }

      return true;
    } catch (err) {
      console.error("Autosave failed", err);
      if (!quiet) {
        message.error(err?.message || "Failed to autosave moodboard.");
      }
      return false;
    } finally {
      if (seq === saveSeqRef.current) {
        setIsAutosaving(false);
      }
    }
  };

  const saveThumbnailPatch = async () => {
    if (!moodboardId || moodboardId === "new") return;
    if (isHydratingRef.current) return;
    if (!canvasRef.current?.exportThumbnail) return;

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null;
    if (!token) return;

    const snapshot = buildThumbnailSnapshot(items, background);
    if (snapshot === lastSavedThumbnailSnapshotRef.current) return;

    const thumbDataUrl = canvasRef.current.exportThumbnail();
    if (!thumbDataUrl) return;

    try {
      const res = await fetch(thumbDataUrl);
      const blob = await res.blob();
      const file = new File([blob], "thumbnail.jpg", { type: blob.type || "image/jpeg" });

      const fd = new FormData();
      fd.append("thumbnail", file);

      const patchRes = await fetch(`${resolvedApiBaseUrl}/api/moodboard/${moodboardId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
        keepalive: true,
      });

      if (patchRes.ok) {
        lastSavedThumbnailSnapshotRef.current = snapshot;
      }
    } catch (err) {
      console.error("Thumbnail autosave failed", err);
    }
  };

  useEffect(() => {
    if (!moodboardId || moodboardId === "new") return;
    if (isBoardLoading) return;
    if (isHydratingRef.current) return;

    const snapshot = buildThumbnailSnapshot(items, background);
    if (snapshot === lastSavedThumbnailSnapshotRef.current) return;

    if (thumbTimerRef.current) clearTimeout(thumbTimerRef.current);

    thumbTimerRef.current = setTimeout(() => {
      saveThumbnailPatch();
    }, THUMBNAIL_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (thumbTimerRef.current) {
        clearTimeout(thumbTimerRef.current);
        thumbTimerRef.current = null;
      }
    };
  }, [items, background, moodboardId, isBoardLoading]);

  useEffect(() => {
    if (!moodboardId || moodboardId === "new") return;
    if (isBoardLoading) return;
    if (isHydratingRef.current) return;

    const title = projectName.trim();
    if (!title) return;

    const snapshot = buildBoardSnapshot({
      title,
      items,
      isPublic,
      background,
    });

    if (snapshot === lastSavedSnapshotRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveBoardPatch({ quiet: true });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [items, projectName, isPublic, background, moodboardId, isBoardLoading]);

  useEffect(() => {
    if (!moodboardId || moodboardId === "new") return;

    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveBoardPatch({ quiet: true });
    };

    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [moodboardId, items, projectName, isPublic, background]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;

    if (!token) return;
    if (!moodboardId || moodboardId === "new") {
      setOtherMoodboards([]);
      return;
    }

    let isCancelled = false;

    const fetchMoodboards = async () => {
      try {
        setIsLoadingOtherMoodboards(true);

        const res = await fetch(`${resolvedApiBaseUrl}/api/moodboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          if (!isCancelled) setOtherMoodboards([]);
          return;
        }

        const list = await res.json().catch(() => []);
        const filtered = (Array.isArray(list) ? list : []).filter((mb) => {
          const id = String(mb?.id || "");
          return id && id !== String(moodboardId);
        });

        if (!isCancelled) {
          setOtherMoodboards(filtered);
        }
      } catch (err) {
        console.error("Failed to fetch other moodboards:", err);
        if (!isCancelled) setOtherMoodboards([]);
      } finally {
        if (!isCancelled) setIsLoadingOtherMoodboards(false);
      }
    };

    fetchMoodboards();

    return () => {
      isCancelled = true;
    };
  }, [moodboardId]);

  const handleViewModeChange = (nextView) => {
    if (nextView === viewMode) return;

    if (isBgEditing) {
      setBgDraft(background || "#ffffff");
      setIsBgEditing(false);
    }

    setMode("idle");
    setViewMode(nextView);
  };

  const handleGenerationCreated = (gen) => {
    setGenerationResults((prev) => [gen, ...prev]);
  };

  const openBackgroundEditor = () => {
    const next = background || "#ffffff";
    setBgDraft(next);
    setIsBgEditing(true);
    setMode("bg");
  };

  const handleBackgroundDone = () => {
    setBackground(bgDraft || "#ffffff");
    setIsBgEditing(false);
    setMode("idle");
  };

  const handleBackgroundCancel = () => {
    setBgDraft(background || "#ffffff");
    setIsBgEditing(false);
    setMode("idle");
  };

  const handleBoardAction = (key) => {
    if (key === "save") {
      setIsSaveModalOpen(true);
    }

    if (key === "export") {
      const dataUrl = canvasRef.current?.exportImage?.();
      if (!dataUrl) {
        message.error("Failed to export moodboard.");
        return;
      }

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(projectName || "moodboard").trim() || "moodboard"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    if (key === "bg") {
      openBackgroundEditor();
      return;
    }    
  };

  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0) return;

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null;

    if (!token) {
      message.error("You need to be logged in to add images.");
      return;
    }

    if (!moodboardId || moodboardId === "new") {
      message.error("Save the moodboard first, then add images.");
      return;
    }

    pushHistory();

    for (const file of files) {
      setPendingImageCount((prev) => prev + 1);
      try {
        const fd = new FormData();
        fd.append("file", file);

        const uploadRes = await fetch(`${resolvedApiBaseUrl}/api/moodboard/${moodboardId}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });

        const uploadJson = await uploadRes.json().catch(() => null);
        const rawSrc = uploadJson?.src;

        if (!uploadRes.ok || !rawSrc) {
          throw new Error(uploadJson?.error || "Failed to upload image.");
        }

        const loadSrc = toMoodboardDisplaySrc(rawSrc, moodboardId);

        const img = new window.Image();
        img.crossOrigin = "anonymous";

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = loadSrc;
        });

        let w = img.naturalWidth || img.width || 300;
        let h = img.naturalHeight || img.height || 300;

        const maxW = BASE.w * MAX_IMAGE_RATIO;
        const maxH = BASE.h * MAX_IMAGE_RATIO;
        const scale = Math.min(1, maxW / w, maxH / h);

        w *= scale;
        h *= scale;

        const x = (BASE.w - w) / 2;
        const y = (BASE.h - h) / 2;

        setItems((prev) => {
          const maxZ = prev.reduce((m, it) => Math.max(m, it.z ?? 0), 0);

          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              kind: "image",
              src: rawSrc,
              x,
              y,
              w,
              h,
              z: maxZ + 1,
              description: "",
              url: "",
              quantity: 1,
              cost: "",
              locked: false,
              hidden: false,
            }
          ];
        });
      } catch (err) {
        console.error(err);
        message.error(err?.message || "Failed to add image.");
      } finally {
        setPendingImageCount((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const handleRemoveBg = async () => {
    const { selectedId, items: currentItems, pushHistory, setItems } = useBoardStore.getState();

    const item = currentItems.find((i) => i.id === selectedId);
    if (!item || item.kind !== "image") return;

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null;

    if (!token) {
      message.error("You need to be logged in.");
      return;
    }

    try {
      const res = await fetch(
        `${resolvedApiBaseUrl}/api/moodboard/${moodboardId}/remove-bg`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ src: item.src }),
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to remove background");
      }

      await preloadImage(toMoodboardDisplaySrc(json.src, moodboardId));

      pushHistory();

      setItems((prev) =>
        prev.map((i) =>
          i.id === selectedId
            ? {
                ...i,
                src: json.src,
                crop: undefined,
              }
            : i
        )
      );
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to remove background");
    }
  };
  
  const handleSaveBoard = async (e) => {
    e.preventDefault();

    const title = projectName.trim();
    if (!title) {
      message.error("Please enter a project name.");
      return;
    }

    try {
      setIsSaving(true);

      // store board items as scene JSON
      const scene = {
        items: (items || []).map(({ displaySrc, ...rest }) => rest),
      };

      const formData = new FormData();
      formData.append("title", title);
      formData.append("scene", JSON.stringify(scene));
      formData.append("width", String(BASE.w));
      formData.append("height", String(BASE.h));
      formData.append("isPublic", String(isPublic));
      formData.append("background", background || "#ffffff");

      // add thumbnail
      if (canvasRef.current && typeof canvasRef.current.exportThumbnail === "function") {
        const thumbDataUrl = canvasRef.current.exportThumbnail();
        if (thumbDataUrl) {
          const res = await fetch(thumbDataUrl);
          const blob = await res.blob();
          const file = new File([blob], "thumbnail.jpg", {
            type: blob.type || "image/jpeg",
          });
          formData.append("thumbnail", file);
        }
      }

      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;

      const isNew = moodboardId === "new";
      const endpoint = isNew
        ? `${resolvedApiBaseUrl}/api/moodboard`
        : `${resolvedApiBaseUrl}/api/moodboard/${moodboardId}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(endpoint, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save moodboard");
      }

      const board = await res.json();
      const boardId = board.id;

      lastSavedSnapshotRef.current = buildBoardSnapshot({
        title,
        items,
        isPublic,
        background,
      });
      lastSavedThumbnailSnapshotRef.current = buildThumbnailSnapshot(items, background);

      // attach pending generations with null moodboardId
      const pending = generationResults.filter(
        (g) => g.moodboardId == null
      );

      if (pending.length > 0) {
        const attachRes = await fetch(
          `${resolvedApiBaseUrl}/api/generation/attach-to-board`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            },
            body: JSON.stringify({
              moodboardId: boardId,
              generationIds: pending.map((g) => g.id),
            }),
          }
        );

        if (!attachRes.ok) {
          const text = await attachRes.text();
          throw new Error(text || "Failed to attach generations to board");
        }

        const pendingIds = new Set(pending.map((g) => g.id));
        setGenerationResults((prev) =>
          prev.map((g) =>
            pendingIds.has(g.id) ? { ...g, moodboardId: boardId } : g
          )
        );
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      message.success("Moodboard saved.");
      setIsSaveModalOpen(false);

      if (moodboardId === "new") {
        router.push(`/dashboard/moodboards/${boardId}`);
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to save moodboard");
    } finally {
      setIsSaving(false);
    }
  };

  const renderOtherMoodboards = () => {
    if (moodboardId === "new") return null;

    if (isLoadingOtherMoodboards) {
      return (
        <div className={styles.otherMoodboardsSection}>
          <h2 className={styles.otherMoodboardsTitle}>My Other Moodboards</h2>
          <div className={styles.otherMoodboardsLoading}>
            <Spin />
          </div>
        </div>
      );
    }

    if (!otherMoodboards.length) return null;

    return (
      <div className={styles.otherMoodboardsSection}>
        <h2 className={styles.otherMoodboardsTitle}>My Other Moodboards</h2>
        <div className={styles.otherMoodboardsGrid}>
          {otherMoodboards.map((moodboard) => {
            const key = moodboard?.id;
            if (!key) return null;

            return (
              <div
                key={key}
                className={styles.otherMoodboardCard}
                onClick={() => router.push(`/dashboard/moodboards/${key}`)}
              >
                <div className={styles.otherMoodboardThumbWrap}>
                  {moodboard.thumbnailUrl ? (
                    <img
                      src={`${resolvedApiBaseUrl}${moodboard.thumbnailUrl}?v=${encodeURIComponent(
                        moodboard.updatedAt || ""
                      )}`}
                      alt={moodboard.title || "Moodboard"}
                      className={styles.otherMoodboardThumb}
                    />
                  ) : (
                    <div className={styles.otherMoodboardThumbSkeleton} />
                  )}
                </div>

                <div className={styles.otherMoodboardMeta}>
                  <span className={styles.otherMoodboardName}>
                    {moodboard.title || "Untitled Moodboard"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.pageRoot} ${isBgEditing ? styles.bgFocusModeRoot : ""}`}>
      {isBgEditing && (
        <>
          <button type="button" className={styles.bgModeCancelBtn} onClick={handleBackgroundCancel}>Cancel</button>
          <button type="button" className={styles.bgModeDoneBtn} onClick={handleBackgroundDone}>Done</button>
        </>
      )}

      <div className={styles.mobileTopBar}>
        <Link href="/dashboard/moodboards" className={styles.backLink}>
          <ArrowLeftOutlined />
          <span>Back to dashboard</span>
        </Link>

        <div className={styles.mobileViewToggle}>
          <div className={styles.viewModeSwitch}>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === "board" ? styles.viewModeBtnActive : ""}`}
              onClick={() => handleViewModeChange("board")}
            >
              <img src="/icons/board.svg" alt="" className={styles.viewModeIcon} />
              <span className={styles.viewModeLabel}>Board</span>
            </button>
            <button
              type="button"
              className={`${styles.viewModeBtn} ${viewMode === "list" ? styles.viewModeBtnActive : ""}`}
              onClick={() => handleViewModeChange("list")}
            >
              <img src="/icons/list.svg" alt="" className={styles.viewModeIcon} />
              <span className={styles.viewModeLabel}>List</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.mobileSidebarBtn}
        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
        aria-label={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
      >
        {isSidebarCollapsed ? "☰" : "✕"}
      </button>

      <div className={styles.editorPageContent}>
        <div
          className={`${styles.layout} ${
            isSidebarCollapsed ? styles.layoutSidebarCollapsed : ""
          }`}
        >
          <div
            className={`${styles.sidebarWrap} ${
              isSidebarCollapsed ? styles.sidebarWrapCollapsed : ""
            }`}
          >
            <button
              type="button"
              className={styles.sidebarCollapseButton}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={isSidebarCollapsed ? "Open sidebar" : "Collapse sidebar"}
            >
              <span
                className={`${styles.sidebarCollapseChevron} ${
                  isSidebarCollapsed
                    ? styles.sidebarCollapseChevronCollapsed
                    : styles.sidebarCollapseChevronOpen
                }`}
              >
                {isSidebarCollapsed ? "›" : "‹"}
              </span>
            </button>

            <div className={styles.sidebarViewport}>
              <aside
                className={`${styles.sidebar} ${
                  isSidebarCollapsed ? styles.sidebarCollapsed : ""
                }`}
              >
                <Sidebar
                  moodboardId={moodboardId}
                  generationResults={generationResults}
                  setGenerationResults={setGenerationResults}
                  onGenerationCreated={handleGenerationCreated}
                />
              </aside>
            </div>
          </div>

          <main className={styles.main}>
            <div className={styles.canvasCardWrap}>
              {isBoardLoading && moodboardId !== "new" && (
                <div className={styles.boardLoadingOverlay}>
                  <Spin size="large" />
                </div>
              )}
              {pendingImageCount > 0 && (
                <div className={styles.boardImageLoadingOverlay}>
                  <Spin size="large" />
                </div>
              )}

              <div
                className={`${styles.canvasCard} ${
                  isBoardLoading && moodboardId !== "new" ? styles.isLoading : ""
                }`}
              >
                <div className={styles.canvasHeader}>
                  <div className={styles.projectNameBox}>
                    <span className={styles.projectLabel}>Project Name :</span>

                    <input
                      className={styles.projectValue}
                      value={projectName}
                      readOnly
                      aria-label="Project name"
                    />

                    <div className={styles.viewModeSwitchWrap}>
                      <div className={styles.viewModeSwitch}>
                        <button
                          type="button"
                          className={`${styles.viewModeBtn} ${
                            viewMode === "board" ? styles.viewModeBtnActive : ""
                          }`}
                          onClick={() => handleViewModeChange("board")}
                        >
                          <img
                            src="/icons/board.svg"
                            alt=""
                            className={styles.viewModeIcon}
                          />
                          <span className={styles.viewModeLabel}>Board</span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.viewModeBtn} ${
                            viewMode === "list" ? styles.viewModeBtnActive : ""
                          }`}
                          onClick={() => handleViewModeChange("list")}
                        >
                          <img
                            src="/icons/list.svg"
                            alt=""
                            className={styles.viewModeIcon}
                          />
                          <span className={styles.viewModeLabel}>List</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {viewMode === "board" && (
                    <div className={styles.canvasActions}>
                      <BoardActions
                        onAction={handleBoardAction}
                        onFilesSelected={handleFilesSelected}
                        disabled={
                          isBgEditing
                            ? {
                                save: true,
                                image: true,
                                export: true,
                                text: true,
                                pen: true,
                              }
                            : {}
                        }
                      />
                    </div>
                  )}
                </div>

                {viewMode === "board" ? (
                  <>
                    <BoardCanvas
                      ref={canvasRef}
                      moodboardId={moodboardId}
                      backgroundColor={isBgEditing ? bgDraft : background}
                      onSceneReady={
                        isBoardLoading ? () => setIsSceneReady(true) : undefined
                      }
                    />

                    {isBgEditing ? (
                      <div className={styles.bgPickerDock}>
                        <label className={styles.bgPickerSwatch}>
                          <input
                            type="color"
                            value={bgDraft || "#ffffff"}
                            onChange={(e) => setBgDraft(e.target.value)}
                            className={styles.bgColorInput}
                          />
                        </label>
                        <input
                          type="text"
                          value={bgDraft || "#ffffff"}
                          onChange={(e) => setBgDraft(e.target.value)}
                          className={styles.bgHexInput}
                          maxLength={7}
                        />
                      </div>
                    ) : (
                      <div className={styles.canvasToolbar}>
                        <Toolbar onRemoveBg={handleRemoveBg} />
                      </div>
                    )}
                  </>
                ) : (
                  <BoardList moodboardId={moodboardId} />
                )}
              </div>
            </div>
          </main>
        </div>

        {renderOtherMoodboards()}
      </div>

      <Modal
        key={isSaveModalOpen ? "open" : "closed"}
        title="Save moodboard"
        open={isSaveModalOpen}
        onCancel={() => !isSaving && setIsSaveModalOpen(false)}
        footer={null}
      >
        <form onSubmit={handleSaveBoard}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="project-name-input"
              style={{
                display: "block",
                marginTop: 20,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              Name
            </label>
            <Input
              id="project-name-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <Switch
              checked={isPublic}
              onChange={(checked) => setIsPublic(checked)}
            />
            <span style={{ fontSize: 13 }}>
              {isPublic ? "Public board" : "Private board"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <Button onClick={() => setIsSaveModalOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}