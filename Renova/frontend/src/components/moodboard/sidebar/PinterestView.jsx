"use client";

import { useEffect, useState, useCallback } from "react";
import { Button, Spin, message, Tooltip } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useBoardStore } from "@/contexts/boardStore";
import styles from "@/styles/moodboard/Moodboard.module.scss";

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const API = {
  status: `${BACKEND_BASE}/api/integrations/pinterest/status`,
  connect: `${BACKEND_BASE}/api/integrations/pinterest/auth-url`,
  disconnect: `${BACKEND_BASE}/api/integrations/pinterest/disconnect`,
  boards: `${BACKEND_BASE}/api/integrations/pinterest/boards`,
  pins: (boardId) => `${BACKEND_BASE}/api/integrations/pinterest/boards/${boardId}/pins`,
  allPins: `${BACKEND_BASE}/api/integrations/pinterest/pins`,
};

export default function PinterestView() {
  const { items, setItems, pushHistory } = useBoardStore();
  const [view, setView] = useState("loading");  // "loading" | "disconnected" | "boards" | "pins"
  const [boards, setBoards] = useState([]);
  const [pins, setPins] = useState([]);
  const [activeBoard, setActiveBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [integrationData, setIntegrationData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [boardThumbnails, setBoardThumbnails] = useState({});

  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  };

  const fetchJSON = async (url, init = {}) => {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...init.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { 
      ...init, 
      headers,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Request failed: ${res.status} - ${errorText}`);
    }
    return res.json();
  };

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchJSON(API.status);
      setIntegrationData(data.integration);
      setView(data.connected ? "boards" : "disconnected");
    } catch (error) {
      console.error('Status check failed:', error);
      setView("disconnected");
    }
  }, []);

  const loadBoards = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchJSON(API.boards);
      setBoards(data.boards ?? []);
    } catch (error) {
      console.error('Failed to load boards:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPins = useCallback(async (boardId) => {
    try {
      setIsLoading(true);
      const data = await fetchJSON(API.pins(boardId));
      setPins(data.pins ?? []);
    } catch (error) {
      console.error('Failed to load pins:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBoardThumbnail = useCallback(async (boardId, boardName) => {
    try {
      const data = await fetchJSON(API.pins(boardId));
      const firstPin = data.pins?.[0];
      if (firstPin && firstPin.image_url) {
        setBoardThumbnails(prev => ({
          ...prev,
          [boardId]: firstPin.image_url
        }));
      }
    } catch (error) {
      console.error(`Failed to load thumbnail for board ${boardName}:`, error);
    }
  }, []);

  const loadAllPins = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchJSON(API.allPins);
      setPins(data.pins ?? []);
      setActiveBoard({ id: 'all', name: 'All Pins' });
      setCurrentPage(1);
      setView("pins");
    } catch (error) {
      console.error('Failed to load all pins:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const pinterestStatus = urlParams.get('pinterest');

    // Check if we are in a popup
    const isPopup = window.opener && window.opener !== window;

    if (isPopup && (code || pinterestStatus === 'success')) {
      // We are in the popup, notify opener and close
      window.opener.postMessage({ type: 'PINTEREST_AUTH_SUCCESS', code, status: pinterestStatus }, window.location.origin);
      window.close();
      return; // Stop further execution
    }

    if (code) {
      // Handle OAuth callback - clean URL and refresh status
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      message.success('Pinterest connected successfully!');
      loadStatus();
    } else if (pinterestStatus === 'success') {
      // Handle backend redirect success
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      message.success('Pinterest connected successfully!');
      loadStatus();
    } else if (pinterestStatus === 'error') {
      // Handle backend redirect error
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      message.error('Pinterest connection failed');
    }

    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (view === "boards") {
      loadBoards();
    }
  }, [view, loadBoards]);

  useEffect(() => {
    if (view === "boards" && boards.length > 0) {
      // Load thumbnails for all boards
      boards.forEach(board => {
        if (!boardThumbnails[board.id]) {
          loadBoardThumbnail(board.id, board.name);
        }
      });
    }
  }, [view, boards, boardThumbnails, loadBoardThumbnail]);

  // Actions
  const addPinToMoodboard = async (pin) => {
    try {
      // Backend dependency check: Only allow adding if backend is reachable
      try {
        await fetchJSON(API.status);
      } catch (err) {
        throw new Error("Backend offline - cannot add image");
      }

      const pinUrl = pin.image_url;
      if (!pinUrl) return;

      const proxyUrl = `/api/proxy/media/pinterest?url=${encodeURIComponent(pinUrl)}`;
      const img = new Image();
      
      img.onload = () => {
        let w = img.naturalWidth || img.width || 300;
        let h = img.naturalHeight || img.height || 300;

        // Apply sizing logic (same as file upload)
        const BASE_W = 900;
        const BASE_H = 600;
        const maxW = BASE_W * 0.5;
        const maxH = BASE_H * 0.5;
        const scale = Math.min(1, maxW / w, maxH / h);
        
        w *= scale;
        h *= scale;

        const x = (BASE_W - w) / 2;
        const y = (BASE_H - h) / 2;

        pushHistory();
        
        setItems((prev) => {
          const maxZ = prev.reduce((m, item) => Math.max(m, item.z ?? 0), 0);
          const newId = crypto.randomUUID ? crypto.randomUUID() : `pin-${Date.now()}`;

          return [...prev, {
            id: newId,
            kind: "image",
            src: pinUrl, // Store original Pinterest URL
            x,
            y,
            w,
            h,
            z: maxZ + 1,
            rot: 0,
            opacity: 1,
          }];
        });
      };

      img.onerror = () => {
        console.error("Failed to load image for sizing");
        message.error("Image failed to load");
        // Dynamic update: Remove the broken pin from the list
        setPins((prev) => prev.filter((p) => p.id !== pin.id));
      };

      img.src = proxyUrl;
    } catch (err) {
      console.error(err);
      message.error("Failed to add image");
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const data = await fetchJSON(API.connect);

      if (data.authUrl) {
        // Try to open a popup first to preserve current page state
        const width = 600;
        const height = 750;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.authUrl,
          "PinterestAuth",
          `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`
        );

        if (popup) {
          let timer;
          // Listen for message from popup
          const messageHandler = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'PINTEREST_AUTH_SUCCESS') {
              popup.close();
              if (timer) clearInterval(timer);
              window.removeEventListener('message', messageHandler);
              message.success("Pinterest connected successfully!");
              loadStatus();
              setIsLoading(false);
            }
          };
          window.addEventListener('message', messageHandler);

          timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              window.removeEventListener('message', messageHandler);
              setIsLoading(false);
              loadStatus();
              return;
            }
            try {
              // Will throw if cross-origin
              const url = new URL(popup.location.href);
              const code = url.searchParams.get("code");
              const status = url.searchParams.get("pinterest");

              if (code || status === "success") {
                popup.close();
                clearInterval(timer);
                window.removeEventListener('message', messageHandler);
                message.success("Pinterest connected successfully!");
                loadStatus();
                // We keep isLoading true until loadStatus finishes updating the view usually, 
                // but here we can just unset it as the view change will happen.
              } else if (status === "error") {
                popup.close();
                clearInterval(timer);
                window.removeEventListener('message', messageHandler);
                message.error("Connection failed");
                setIsLoading(false);
              }
            } catch (e) {
              // Cross-origin: user is still on Pinterest login
            }
          }, 1000);
        } else {
          // Fallback if popup blocked
          window.location.href = data.authUrl;
        }
      } else {
        throw new Error('No authentication URL received');
      }
    } catch (error) {
      console.error('Connect failed:', error);
      message.error(`Connect failed: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      await fetchJSON(API.disconnect, { method: "POST" });
      setActiveBoard(null);
      setPins([]);
      setBoards([]);
      setIntegrationData(null);
      await loadStatus();
      message.success("Pinterest disconnected successfully");
    } catch (error) {
      console.error('Disconnect failed:', error);
      message.error("Disconnect failed");
    } finally {
      setIsLoading(false);
    }
  };

  const openBoard = async (board) => {
    try {
      setActiveBoard(board);
      await loadPins(board.id);
      setCurrentPage(1);
      setView("pins");
    } catch (error) {
      console.error("Could not load pins:", error);
      message.error("Board not found");
      // Dynamic update: Refresh the boards list to remove invalid entries
      await loadBoards();
      setActiveBoard(null);
      setView("boards");
    }
  };

  const goBackToBoards = () => {
    setView("boards");
    setActiveBoard(null);
    setPins([]);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    try {
      if (view === "boards") {
        await loadBoards();
        message.success("Refreshed boards");
      }
      
      if (view === "pins" && activeBoard) {
        try {
          if (activeBoard.id === 'all') {
            await loadAllPins();
          } else {
            // Check status before loading pins (backend dependency)
            // If backend is offline, this will throw
            const status = await fetchJSON(API.status);
            if (!status.connected) {
               throw new Error("Backend offline or disconnected");
            }
            
            await loadPins(activeBoard.id);
          }
          message.success("Refreshed pins");
        } catch (pinError) {
          // Check for 404 (likely deleted board) or other critical errors
          if (pinError.message && (pinError.message.includes("404") || pinError.message.includes("not found"))) {
             console.error("Board refresh failed - likely deleted:", pinError);
             message.error("Board no longer available");
             setActiveBoard(null);
             setView("boards");
             // Refresh boards list to reflect deletion
             try { await loadBoards(); } catch(e) {}
          } else {
             throw pinError;
          }
        }
      }
    } catch (error) {
      console.error("Refresh failed:", error);
      message.error("Refresh failed - Backend may be offline");
    }
  };

  const showAllPins = async () => {
    try {
      await loadAllPins();
    } catch (error) {
      message.error("Could not load all pins");
    }
  };

  // Disconnected view
  if (view === "disconnected") {
    return (
      <div className={styles.pinterestConnect}>
        <img src="/icons/pinterest.svg" alt="Pinterest" className={styles.pinterestLogo} />
        <h3 className={styles.pinterestTitle} style={{ color: 'black' }}>
          Connect to Pinterest to access your Pins and Boards!
        </h3>
        <Button
          type="default"
          size="large"
          className={styles.pinterestBtn}
          onClick={handleConnect}
          loading={isLoading}
        >
          Connect
        </Button>
        {integrationData && (
          <div className={styles.integrationInfo} style={{ color: 'black' }}>
            <p style={{ color: 'black' }}>Connected as: {integrationData.username}</p>
            <p style={{ color: 'black' }}>Since: {new Date(integrationData.createdAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>
    );
  }

  // Loading view
  if (view === "loading") {
    return (
      <div className={styles.pinterestConnect} aria-busy="true">
        <Spin size="large" />
        <p style={{ marginTop: '16px', color: 'black' }}>Loading Pinterest...</p>
      </div>
    );
  }

  // Header (shared for boards/pins)
  const Header = (
    <div className={styles.pHeader} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div className={styles.pUser} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className={styles.pAvatar}>
          <img
            src="/icons/pinterest.svg"
            alt="Pinterest"
            className={styles.avatarImg}
          />
        </div>
        <div className={styles.pUserInfo}>
          <span className={styles.pUsername} style={{ color: 'black', fontWeight: 600 }}>
            {integrationData?.username || 'Pinterest User'}
          </span>
        </div>
      </div>
      <div className={styles.pActions} style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Button
          type="text"
          onClick={handleRefresh}
          loading={isLoading}
          className={styles.refreshBtn}
        >
          Refresh
        </Button>
        <Button
          type="link"
          onClick={handleDisconnect}
          disabled={isLoading}
          style={{ padding: 0 }}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );

  // Boards view
  if (view === "boards") {
    return (
      <div className={styles.pBoardsWrap}>
        {Header}

        <div className={styles.pBoardTitleBar}>
          <h2 style={{ color: 'black' }}>Pinterest Boards</h2>
        </div>

        {isLoading && boards.length === 0 ? (
          <div className={styles.loadingContainer}>
            <Spin size="large" />
            <p style={{ color: 'black' }}>Loading boards...</p>
          </div>
        ) : (
          <div className={styles.pBoardsList}>
            {boards.map((board) => (
              <div 
                key={board.id} 
                className={styles.pBoardItem}
                onClick={() => openBoard(board)}
                style={{ cursor: 'pointer' }}
              >
                {boardThumbnails[board.id] && (
                  <div style={{ marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', height: '120px' }}>
                    <img 
                      src={boardThumbnails[board.id]} 
                      alt={board.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = '/icons/image-placeholder.svg';
                      }}
                    />
                  </div>
                )}
                <div style={{ color: 'black', fontWeight: '500' }}>
                  {board.name}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>
                  {board.pin_count || 0} pins
                </div>
              </div>
            ))}
          </div>
        )}

        {boards.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <p style={{ color: 'black' }}>No boards found</p>
          </div>
        )}
      </div>
    );
  }

  // Pins view (show all pins)
  const displayedPins = pins;

  return (
    <div className={styles.pPinsWrap}>
      {Header}
      
      <div className={styles.pBoardTitleBar} style={{ display: 'flex', alignItems: 'center' }}>
        <Button type="text" onClick={goBackToBoards} className={styles.backBtn}>
          ‹ Back to Boards
        </Button>
      </div>

      {isLoading && pins.length === 0 ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
          <p style={{ color: 'black' }}>Loading pins...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className={styles.pinsGrid} style={{ flex: 1, overflowY: 'auto' }}>
            {displayedPins.map((pin) => (
              <div key={pin.id} className={styles.pinCard}>
                <div className={styles.pinImageContainer}>
                  <img 
                    src={pin.image_url} 
                    alt={pin.title}
                    className={styles.pinImage}
                    onError={(e) => {
                      e.target.src = '/icons/image-placeholder.svg';
                    }}
                  />  
                </div>
                <div className={styles.pinInfo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div className={styles.pinTitle} style={{ color: 'black', marginBottom: 0, flex: 1 }}>
                      {pin.title || 'Untitled Pin'}
                    </div>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        addPinToMoodboard(pin);
                      }}
                      style={{ 
                        borderRadius: '6px', 
                        flexShrink: 0,
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '0 12px',
                        height: '28px'
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>


        </div>
      )}

      {pins.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <p style={{ color: 'black' }}>No pins found in this board</p>
        </div>
      )}
    </div>
  );
}