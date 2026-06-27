import { useEffect, useRef, useCallback, useState } from "react";

export interface RemoteCursor {
  userId: string;
  username: string;
  x: number;
  y: number;
  color: string;
  updatedAt: number;
}

/** Deterministic color per userId */
function userColor(userId: string): string {
  const COLORS = [
    "#f87171", "#fb923c", "#facc15", "#4ade80",
    "#34d399", "#38bdf8", "#818cf8", "#f472b6",
  ];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

const API_BASE: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:56396";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export function useCursorPresence(drawingId: string | null) {
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const selfIdRef = useRef<string>("");

  useEffect(() => {
    if (!drawingId) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // Decode own userId from JWT to avoid rendering own cursor
    try {
      const seg = token.split(".")[1];
      const payload = JSON.parse(atob(seg.replace(/-/g, "+").replace(/_/g, "/")));
      selfIdRef.current = payload.user_id || "";
    } catch {}

    const ws = new WebSocket(`${WS_BASE}/ws/collaborate?drawingId=${drawingId}&token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string; userId?: string; username?: string; payload?: string;
        };
        if (msg.type === "cursor" && msg.userId && msg.userId !== selfIdRef.current) {
          const { x, y } = JSON.parse(msg.payload ?? "{}") as { x: number; y: number };
          const userId = msg.userId;
          const username = msg.username ?? "User";
          setCursors(prev => ({
            ...prev,
            [userId]: { userId, username, x, y, color: userColor(userId), updatedAt: Date.now() },
          }));
        } else if (msg.type === "leave" && msg.userId) {
          setCursors(prev => { const n = { ...prev }; delete n[msg.userId!]; return n; });
        }
      } catch {}
    };

    ws.onclose = () => { wsRef.current = null; setCursors({}); };

    return () => { ws.close(); };
  }, [drawingId]);

  // Prune stale cursors after 5 s of no update
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCursors(prev => {
        const pruned = { ...prev };
        let changed = false;
        for (const k of Object.keys(pruned)) {
          if (now - pruned[k].updatedAt > 5000) { delete pruned[k]; changed = true; }
        }
        return changed ? pruned : prev;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  /** Call on every mousemove over the canvas to broadcast position */
  const broadcastCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: "cursor",
      drawingId,
      payload: JSON.stringify({ x, y }),
      timestamp: Date.now(),
    }));
  }, [drawingId]);

  return { cursors, broadcastCursor };
}
