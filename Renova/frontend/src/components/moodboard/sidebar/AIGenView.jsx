"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Upload,
  Input,
  Button,
  Modal,
  Tooltip,
  Spin,
  Image,
  message,
} from "antd";
import { useBoardStore } from "@/contexts/boardStore";
import { toMoodboardDisplaySrc } from "@/utils/moodboardMedia";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const { Dragger } = Upload;
const MAX_SELECTED = 5;

const MODEL_OPTIONS = [
  {
    value: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream v4.5",
    vendor: "ByteDance",
    logo: "/icons/bytedance.svg",
    description: "Bytedance's advanced image model",
  },
  {
    value: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream v5 Lite",
    vendor: "ByteDance",
    logo: "/icons/bytedance.svg",
    description: "Bytedance's lightweight 5.0 image model",
  },
  {
    value: "fal-ai/bytedance/seedream/v4/edit",
    label: "Seedream v4",
    vendor: "ByteDance",
    logo: "/icons/bytedance.svg",
    description: "Bytedance's standard image model",
  },
  {
    value: "fal-ai/nano-banana-pro/edit",
    label: "Nano Banana Pro",
    vendor: "Google",
    logo: "/icons/google.svg",
    description: "Google's premium image model",
  },
  {
    value: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2",
    vendor: "Google",
    logo: "/icons/google.svg",
    description: "Google's Gemini 3.1 Flash image model",
  },
];

const DEFAULT_MODEL_KEY = "fal-ai/bytedance/seedream/v4/edit";

function getApiBaseUrl() {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (env) return env;
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

export default function AIGenView({ moodboardId, onGenerationCreated }) {
  const { items } = useBoardStore();

  const imageItems = useMemo(() => {
    return (items || []).filter(
      (item) => item && typeof item.src === "string" && item.src.length > 0
    );
  }, [items]);

  const [selectedItems, setSelectedItems] = useState([]);
  const [roomImage, setRoomImage] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_KEY);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSelection, setModalSelection] = useState([]);
  const [maxWarning, setMaxWarning] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usage, setUsage] = useState(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const [denyMsg, setDenyMsg] = useState("");
  const [denyShake, setDenyShake] = useState(false);
  const denyWrapRef = useRef(null);
  const API_BASE_URL = useMemo(() => getApiBaseUrl(), []);
  const hasImagesOnBoard = imageItems.length > 0;

  const selectedModelMeta = useMemo(() => {
    return (
      MODEL_OPTIONS.find((model) => model.value === selectedModel) ||
      MODEL_OPTIONS[0]
    );
  }, [selectedModel]);

  async function refreshUsage() {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_BASE_URL}/api/plans/usage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsage(data?.usage || null);
    } catch {
      // ignore; backend still enforces
    }
  }

  useEffect(() => {
    refreshUsage();
  }, []);

  useEffect(() => {
    setSelectedItems([]);
    setModalSelection([]);
    setDenyOpen(false);
    setDenyMsg("");
    setPrompt("");
    setRoomImage(null);
    setSelectedModel(DEFAULT_MODEL_KEY);
    setIsModelMenuOpen(false);
  }, [moodboardId]);

  useEffect(() => {
    if (!isModelMenuOpen) return;

    function onDocMouseDown(e) {
      if (!modelMenuRef.current) return;
      if (!modelMenuRef.current.contains(e.target)) {
        setIsModelMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isModelMenuOpen]);

  // click outside closes deny popover
  useEffect(() => {
    if (!denyOpen) return;

    function onDocMouseDown(e) {
      if (!denyWrapRef.current) return;
      if (!denyWrapRef.current.contains(e.target)) setDenyOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [denyOpen]);

  useEffect(() => {
    function onFocus() {
      refreshUsage();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const generationsLimit = Number(usage?.generationsLimit ?? 0);
  const generationsUsed = Number(usage?.generationsUsed ?? 0);

  const bankedGenRemaining = Number(
    usage?.bankedGenerationsRemaining ??
      usage?.bankedGenRemaining ??
      usage?.addonGenerationsRemaining ??
      0
  );

  const atGenLimit =
    generationsLimit > 0 &&
    generationsUsed >= generationsLimit &&
    bankedGenRemaining <= 0;

  function triggerDeny(msg) {
    setDenyMsg(msg);
    setDenyOpen(true);

    // retrigger shake every click
    setDenyShake(false);
    requestAnimationFrame(() => setDenyShake(true));
    window.setTimeout(() => setDenyShake(false), 480);
  }

  const selectedItemsForDisplay = selectedItems.filter(
    (it) => it && typeof it.src === "string" && it.src.length > 0
  );

  const openSelectModal = () => {
    if (!hasImagesOnBoard) return;
    setModalSelection(selectedItems);
    setMaxWarning(false);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setMaxWarning(false);
  };

  const handleModalConfirm = () => {
    setSelectedItems(modalSelection);
    setIsModalOpen(false);
    setMaxWarning(false);
  };

  const toggleModalItem = (item) => {
    const exists = modalSelection.some((it) => it.id === item.id);

    if (exists) {
      setModalSelection((prev) => prev.filter((it) => it.id !== item.id));
      setMaxWarning(false);
      return;
    }

    if (modalSelection.length >= MAX_SELECTED) {
      setMaxWarning(true);
      return;
    }

    setModalSelection((prev) => [...prev, { id: item.id, src: item.src }]);
    setMaxWarning(false);
  };

  const handleRemoveSelectedItem = (id) => {
    setSelectedItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handlePreviewSelectedItem = (item) => {
    setPreviewItem(item);
  };

  const roomImageUrl = roomImage?.thumbUrl || roomImage?.url;

  const handleRoomChange = ({ file }) => {
    const rawFile = file?.originFileObj || file;

    const next = {
      uid: file?.uid || String(Date.now()),
      name: file?.name || rawFile?.name || "base-image",
      status: "done",
      originFileObj: rawFile,
      thumbUrl:
        rawFile instanceof File ? URL.createObjectURL(rawFile) : undefined,
    };

    setRoomImage(next);
  };

  const handleRoomRemove = () => setRoomImage(null);

  const handleRoomPreview = () => {
    if (!roomImageUrl) return;
    setPreviewItem({ id: "room-image", src: roomImageUrl });
  };

  // Generate handler
  const handleGenerate = async () => {
    if (isGenerating) return;

    if (!moodboardId || moodboardId === "new") {
      message.error("Save the moodboard first.");
      return;
    }

    // Front-end limiter (UX)
    if (atGenLimit) {
      triggerDeny(
        `You’re out of generation tokens (${generationsUsed}/${generationsLimit}). ` +
          `Buy an add-on or upgrade to generate more.`
      );
      return;
    }

    const validSelected = selectedItems.filter(
      (sel) => sel && typeof sel.src === "string" && sel.src.length > 0
    );

    if (validSelected.length === 0) {
      message.error("Please select at least one item from the board.");
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append("moodboardId", String(moodboardId));
      formData.append("modelKey", selectedModel);

      if (prompt.trim()) formData.append("prompt", prompt.trim());
      if (roomImage?.originFileObj) {
        formData.append("baseImage", roomImage.originFileObj);
      }

      const inputFiles = await Promise.all(
        validSelected.map(async (sel, index) => {
          const item = imageItems.find((it) => it.id === sel.id);
          const src = item?.src || sel.src;

          const res = await fetch(toMoodboardDisplaySrc(src, moodboardId));
          if (!res.ok) {
            throw new Error(`Failed to fetch item image ${index + 1}`);
          }

          const blob = await res.blob();
          const ext = (blob.type && blob.type.split("/")[1]) || "png";
          return new File([blob], `item-${sel.id || index}.${ext}`, {
            type: blob.type || "image/png",
          });
        })
      );

      inputFiles.forEach((file) => formData.append("inputItems", file));

      const token = localStorage.getItem("accessToken");

      const res = await fetch(`${API_BASE_URL}/api/generation`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      // backend limiter
      if (res.status === 403) {
        let msg = "You're out of generation tokens. Upgrade to generate more.";
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {}
        triggerDeny(msg);
        await refreshUsage();
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Generation failed");
      }

      const data = await res.json();

      if (onGenerationCreated && data?.generation) {
        onGenerationCreated(data.generation);
      }

      message.success("Generation successful! Check the Generations tab.");
      await refreshUsage();
    } catch (err) {
      console.error("Generation error:", err);
      message.error(err?.message || "Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const disabledForOtherReasons = selectedItemsForDisplay.length === 0 || isGenerating;
  const looksDisabled = disabledForOtherReasons || atGenLimit;

  return (
    <div className={styles.aiGenWrap}>
      <style jsx global>{`
        @keyframes denyShake {
          0% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
          100% { transform: translateX(0); }
        }

        .gen-shake-wrap {
          display: inline-block;           /* so transform works */
          animation: denyShake 0.45s ease;
          will-change: transform;
        }

        .gen-pop {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 320px;
          max-width: 90vw;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(239,68,68,0.25);
          box-shadow: 0 14px 40px rgba(0,0,0,0.12);
          z-index: 9999;
        }
        .gen-pop-title { font-weight: 900; margin-bottom: 6px; color: rgb(127,29,29); }
        .gen-pop-body { font-size: 13px; line-height: 1.35; color: rgba(127,29,29,0.9); }
        .gen-pop-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
        .gen-pop-primary {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 8px 10px; border-radius: 10px; text-decoration: none;
          font-weight: 800; background: #3aa7ff; color: #fff;
        }
        .gen-pop-ghost {
          padding: 8px 10px; border-radius: 10px; font-weight: 800;
          background: transparent; border: 1px solid rgba(0,0,0,0.12); cursor: pointer;
        }
      `}</style>

      {isGenerating && (
        <div className={styles.aiGenOverlay}>
          <Spin size="large" />
          <p className={styles.aiGenOverlayText}>
            Generating… this can take up to a minute.
          </p>
        </div>
      )}

      <div className={`${styles.aiGenInner} ${isGenerating ? styles.aiGenBlurred : ""}`}>
        {/* Selected Model */}
        <h3 className={styles.sectionTitle}>Model</h3>
        <div className={styles.modelPickerSection} ref={modelMenuRef}>
          <button
            type="button"
            className={styles.modelPickerButton}
            onClick={() => !isGenerating && setIsModelMenuOpen((prev) => !prev)}
            disabled={isGenerating}
            aria-haspopup="listbox"
            aria-expanded={isModelMenuOpen}
          >
            <div className={styles.modelPickerLeft}>
              <div className={styles.modelLogoWrap}>
                <img
                  src={selectedModelMeta.logo}
                  alt={selectedModelMeta.vendor}
                  className={styles.modelLogo}
                />
              </div>

              <div className={styles.modelPickerText}>
                <span className={styles.modelPickerValue}>{selectedModelMeta.label}</span>
                <span className={styles.modelPickerDescription}>
                  {selectedModelMeta.description}
                </span>
              </div>
            </div>

            <span
              className={`${styles.modelPickerChevron} ${
                isModelMenuOpen ? styles.modelPickerChevronOpen : ""
              }`}
              aria-hidden="true"
            >
              ›
            </span>
          </button>

          {isModelMenuOpen ? (
            <div className={styles.modelMenu} role="listbox">
              {MODEL_OPTIONS.map((model) => {
                const active = model.value === selectedModel;

                return (
                  <button
                    key={model.value}
                    type="button"
                    className={`${styles.modelMenuItem} ${
                      active ? styles.modelMenuItemActive : ""
                    }`}
                    onClick={() => {
                      setSelectedModel(model.value);
                      setIsModelMenuOpen(false);
                    }}
                    role="option"
                    aria-selected={active}
                  >
                    <div className={styles.modelMenuItemLeft}>
                      <div className={styles.modelLogoWrap}>
                        <img
                          src={model.logo}
                          alt={model.vendor}
                          className={styles.modelLogo}
                        />
                      </div>

                      <div className={styles.modelMenuItemText}>
                        <span className={styles.modelMenuItemLabel}>{model.label}</span>
                        <span className={styles.modelMenuItemDescription}>
                          {model.description}
                        </span>
                      </div>
                    </div>

                    {active ? (
                      <span className={styles.modelMenuItemCheck}>✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className={styles.sectionSpacer} />
        
        {/* Selected Items */}
        <h3 className={styles.sectionTitle}>Select Items</h3>
        {selectedItemsForDisplay.length > 0 && (
          <div className={styles.selectedItemsGrid}>
            {selectedItemsForDisplay.map((it) => (
              <div key={it.id} className={styles.itemCard}>
                <div className={styles.itemThumb}>
                  <img
                    src={toMoodboardDisplaySrc(it.src, moodboardId)}
                    alt=""
                    className={styles.itemThumbImage}
                  />
                  <div className={styles.itemThumbOverlay}>
                    <button
                      type="button"
                      className={styles.itemThumbAction}
                      onClick={() => handlePreviewSelectedItem(it)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className={styles.itemThumbAction}
                      onClick={() => handleRemoveSelectedItem(it.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Tooltip
          title="Add at least one image to the moodboard first"
          open={!hasImagesOnBoard ? undefined : false}
        >
          <button
            type="button"
            className={styles.selectItemsBtn}
            onClick={openSelectModal}
            disabled={!hasImagesOnBoard || isGenerating}
          >
            + Select Items
          </button>
        </Tooltip>

        <div className={styles.sectionSpacer} />

        {/* Upload Base Image */}
        <h3 className={styles.sectionTitle}>Upload Base Image</h3>
        <Dragger
          className={styles.uploadDragger}
          multiple={false}
          accept="image/*"
          beforeUpload={() => false}
          fileList={roomImage ? [roomImage] : []}
          showUploadList={false}
          onChange={handleRoomChange}
          openFileDialogOnClick={!roomImage && !isGenerating}
          disabled={isGenerating}
        >
          {roomImage && roomImageUrl ? (
            <div className={styles.roomImageThumb}>
              <img
                src={roomImageUrl}
                alt="Room"
                className={styles.roomImageThumbImage}
              />
              <div className={styles.itemThumbOverlay}>
                <button
                  type="button"
                  className={styles.itemThumbAction}
                  onClick={handleRoomPreview}
                >
                  View
                </button>
                <button
                  type="button"
                  className={styles.itemThumbAction}
                  onClick={handleRoomRemove}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.uploadInner}>
              <img
                src="/icons/upload.svg"
                alt="Upload"
                className={styles.uploadArrow}
              />
              <div className={styles.uploadText}>
                Drop an image here or click to upload
              </div>
            </div>
          )}
        </Dragger>

        <div className={styles.sectionSpacer} />

        {/* Custom Prompt */}
        <h3 className={styles.sectionTitle}>Custom Prompt</h3>
        <Input.TextArea
          className={styles.promptArea}
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Direct the AI's design choices..."
          disabled={isGenerating}
          onKeyDown={(e) => {
            if (
              e.metaKey &&
              (e.key === "z" || e.key === "Z" || e.key === "v" || e.key === "V")
            ) {
              e.stopPropagation();
            }
          }}
        />

        {/* Tokens display */}
        {generationsLimit > 0 ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              opacity: 0.85,
              color: atGenLimit ? "#ef4444" : "inherit",
            }}
          >
            Tokens: <strong>{generationsUsed}</strong> / {generationsLimit}
          </div>
        ) : null}

        {bankedGenRemaining > 0 ? (
          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
            Add-on tokens: <strong>{bankedGenRemaining}</strong>
          </div>
        ) : null}

        {/* Generate */}
        <div
          className={styles.generateRow}
          style={{ position: "relative", overflow: "visible" }}
          ref={denyWrapRef}
        >
          <Tooltip
            title={
              isGenerating
                ? "Generation in progress..."
                : selectedItemsForDisplay.length === 0
                  ? "Select at least one item to generate"
                  : atGenLimit
                    ? `Out of tokens (${generationsUsed}/${generationsLimit})`
                    : ""
            }
          >
            <span
              style={{ display: "inline-block" }}
              onClick={(e) => {
                if (atGenLimit) {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerDeny(
                    `You’re out of generation tokens (${generationsUsed}/${generationsLimit}). Upgrade to generate more.`
                  );
                }
              }}
            >
              <span className={denyShake ? "gen-shake-wrap" : ""}>
                <Button
                  type="default"
                  className={styles.generateBtn}
                  icon={<img src="/icons/wand.svg" alt="" width={18} height={18} />}
                  onClick={!atGenLimit ? handleGenerate : undefined}
                  disabled={disabledForOtherReasons}
                  style={looksDisabled ? { opacity: 0.6 } : undefined}
                >
                  {isGenerating ? "Generating…" : "Generate"}
                </Button>
              </span>
            </span>
          </Tooltip>

          {denyOpen ? (
            <div className="gen-pop" role="status" aria-live="polite">
              <div className="gen-pop-title">Out of tokens</div>
              <div className="gen-pop-body">{denyMsg}</div>
              <div className="gen-pop-actions">
                <Link className="gen-pop-primary" href="/account?tab=plan">
                  Upgrade plan
                </Link>
                <button
                  type="button"
                  className="gen-pop-ghost"
                  onClick={() => setDenyOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Select Items Modal */}
        <Modal
          open={isModalOpen}
          title="Select up to 5 items"
          onCancel={handleModalClose}
          onOk={handleModalConfirm}
          okText="Confirm"
          cancelText="Cancel"
        >
          <div className={styles.modalItemsGrid}>
            {imageItems.map((item) => {
              const isSelected = modalSelection.some((it) => it.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.modalItemCard} ${isSelected ? styles.modalItemCardSelected : ""}`}
                  onClick={() => toggleModalItem(item)}
                >
                  <img
                    src={toMoodboardDisplaySrc(item.src, moodboardId)}
                    alt=""
                    className={styles.modalItemImage}
                  />
                </button>
              );
            })}
          </div>

          <div className={styles.modalFooterInfo}>
            <span>
              Selected {modalSelection.length} / {MAX_SELECTED}
            </span>
            {maxWarning ? (
              <span className={styles.modalWarning}>
                You can select at most {MAX_SELECTED} items.
              </span>
            ) : null}
          </div>
        </Modal>

        {/* Preview */}
        <Image
          src={
            previewItem?.src
              ? previewItem.id === "room-image"
                ? previewItem.src
                : toMoodboardDisplaySrc(previewItem.src, moodboardId)
              : undefined
          }
          style={{ display: "none" }}
          preview={{
            visible: !!previewItem,
            src:
              previewItem?.src
                ? previewItem.id === "room-image"
                  ? previewItem.src
                  : toMoodboardDisplaySrc(previewItem.src, moodboardId)
                : undefined,
            onVisibleChange: (vis) => {
              if (!vis) setPreviewItem(null);
            },
          }}
        />
      </div>
    </div>
  );
}
