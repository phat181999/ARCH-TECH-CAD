import { create } from "zustand";
import { useDrawingStore } from "./drawingStore";

let ws = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 3000;

export const useCollaborationStore = create((set, get) => ({
  connected: false,
  users: [],
  cursors: {},
  drawingId: null,
  locks: {},

  connect: (drawingId, userId, username) => {
    const { disconnect } = get();
    disconnect();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_WS_HOST || window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || "56396";
    const url = `${protocol}//${host}:${port}/ws/collaborate?drawingId=${drawingId}&userId=${userId}&username=${encodeURIComponent(username)}`;

    set({ drawingId });

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
      } catch (e) {
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

    ws.onerror = (err) => {
      console.error("WS error:", err);
    };
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

  send: (msg) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  sendCursor: (x, y) => {
    get().send({
      type: "cursor",
      payload: { x, y },
    });
  },

  sendElementOp: (op, id, data, layer) => {
    get().send({
      type: "element",
      payload: { op, id, data, layer },
    });
  },

  // Object locking
  lockObject: (objectId) => {
    get().send({
      type: "objectLock",
      payload: { objectId, action: "lock" },
    });
  },

  unlockObject: (objectId) => {
    get().send({
      type: "objectLock",
      payload: { objectId, action: "unlock" },
    });
  },

  isLocked: (objectId) => {
    const { locks } = get();
    return !!locks[objectId];
  },

  handleMessage: (msg) => {
    switch (msg.type) {
      case "users":
        set({ users: msg.payload || [] });
        break;
      case "join":
        set((state) => ({
          users: [...state.users.filter((u) => u.id !== msg.userId), { id: msg.userId, username: msg.username }],
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
            cursors: { ...state.cursors, [msg.userId]: msg.payload },
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
