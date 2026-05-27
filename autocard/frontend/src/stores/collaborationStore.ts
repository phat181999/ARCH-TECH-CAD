import { create } from "zustand";
import { useDrawingStore } from "./drawingStore";
import type { Point } from "../types";

interface Collaborator {
  id: string;
  username: string;
}

interface CursorData {
  x: number;
  y: number;
}

interface WsMessage {
  type: string;
  userId?: string;
  username?: string;
  payload?: any;
}

interface CollaborationStore {
  connected: boolean;
  users: Collaborator[];
  cursors: Record<string, CursorData>;
  drawingId: string | null;
  locks: Record<string, string>;
  connect: (drawingId: string, userId: string, username: string) => void;
  disconnect: () => void;
  send: (msg: WsMessage) => void;
  sendCursor: (x: number, y: number) => void;
  sendElementOp: (op: string, id: string | null, data: any, layer: string) => void;
  lockObject: (objectId: string) => void;
  unlockObject: (objectId: string) => void;
  isLocked: (objectId: string) => boolean;
  handleMessage: (msg: WsMessage) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const RECONNECT_DELAY = 3000;

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  connected: false,
  users: [],
  cursors: {},
  drawingId: null,
  locks: {},

  connect: (drawingId: string, userId: string, username: string) => {
    const { disconnect } = get();
    disconnect();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || "56396";
    const url = `${protocol}//${host}:${port}/ws/collaborate?drawingId=${drawingId}&userId=${userId}&username=${encodeURIComponent(username)}`;

    set({ drawingId });

    // TEMPORARILY DISABLED:
    return;
    /*
    ws = new WebSocket(url);

    ws.onopen = () => {
      set({ connected: true });
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        get().handleMessage(msg);
      } catch (e: any) {
        console.error("WS parse error:", e);
      }
    };

    ws.onclose = () => {
      set({ connected: false });
      if (get().drawingId) {
        reconnectTimer = setTimeout(() => {
          const state = useCollaborationStore.getState();
          if (state.drawingId) {
            state.connect(state.drawingId, userId, username);
          }
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = (err: Event) => {
      console.error("WS error:", err);
    };
    */
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    set({ connected: false, users: [], cursors: {}, locks: {}, drawingId: null });
  },

  send: (msg: WsMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  sendCursor: (x: number, y: number) => {
    get().send({
      type: "cursor",
      payload: { x, y },
    });
  },

  sendElementOp: (op: string, id: string | null, data: any, layer: string) => {
    get().send({
      type: "element",
      payload: { op, id, data, layer },
    });
  },

  // Object locking
  lockObject: (objectId: string) => {
    get().send({
      type: "objectLock",
      payload: { objectId, action: "lock" },
    });
  },

  unlockObject: (objectId: string) => {
    get().send({
      type: "objectLock",
      payload: { objectId, action: "unlock" },
    });
  },

  isLocked: (objectId: string) => {
    const { locks } = get();
    return !!locks[objectId];
  },

  handleMessage: (msg: WsMessage) => {
    switch (msg.type) {
      case "users":
        set({ users: msg.payload || [] });
        break;
      case "join":
        set((state) => ({
          users: [...state.users.filter((u) => u.id !== msg.userId), { id: msg.userId as string, username: msg.username as string }],
        }));
        break;
      case "leave":
        set((state) => ({
          users: state.users.filter((u) => u.id !== msg.userId),
          cursors: Object.fromEntries(
            Object.entries(state.cursors).filter(([k]) => k !== msg.userId)
          ),
        }));
        break;
      case "cursor":
        if (msg.userId) {
          set((state) => ({
            cursors: { ...state.cursors, [msg.userId as string]: msg.payload },
          }));
        }
        break;
      case "element":
        if (msg.payload) {
          const store = useDrawingStore.getState();
          const { op, id, data, layer } = msg.payload;
          if (op === "add" && data) {
            store.addElement(data);
          } else if (op === "update" && id && data) {
            store.updateElement(id, data);
          } else if (op === "delete" && id) {
            store.deleteSelectedElements();
          }
        }
        break;
      case "locks":
        set({ locks: msg.payload || {} });
        break;
      case "objectLock":
        if (msg.payload) {
          const { objectId, action } = msg.payload;
          set((state) => {
            if (action === "lock") {
              return { locks: { ...state.locks, [objectId]: msg.userId } };
            } else {
              const { [objectId]: _, ...rest } = state.locks;
              return { locks: rest };
            }
          });
        }
        break;
      case "objectUnlock":
        if (msg.payload) {
          const { objectId } = msg.payload;
          set((state) => {
            const { [objectId]: _, ...rest } = state.locks;
            return { locks: rest };
          });
        }
        break;
    }
  },
}));
