import { create } from "zustand";
import {
  listSessions,
  createSession,
  getMessages,
  deleteSession,
  ChatSessionInfo,
} from "../services/chatService";

export interface Message {
  role: "user" | "assistant";
  text: string;
  category?: string;
  commands?: string[];
  is_streaming?: boolean;
}

interface ChatStore {
  activeSessionId: string | null;
  sessions: ChatSessionInfo[];
  messages: Message[];
  isProcessing: boolean;

  setActiveSessionId: (id: string | null) => void;
  setSessions: (sessions: ChatSessionInfo[]) => void;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setIsProcessing: (processing: boolean) => void;

  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  startNewChat: () => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessionId: null,
  sessions: [],
  messages: [
    {
      role: "assistant",
      text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials.",
    },
  ],
  isProcessing: false,

  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setSessions: (sessions) => set({ sessions }),
  setMessages: (messages) =>
    set((state) => ({
      messages: typeof messages === "function" ? messages(state.messages) : messages,
    })),
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  loadSessions: async () => {
    try {
      const list = (await listSessions()) || [];
      set({ sessions: list });
      if (list.length > 0) {
        const latestSession = list[0];
        set({ activeSessionId: latestSession.id });
        
        const msgs = await getMessages(latestSession.id);
        if (msgs && msgs.length > 0) {
          set({
            messages: msgs.map((m) => {
              let cmds: string[] = [];
              if (m.commands) {
                try {
                  const parsed = JSON.parse(m.commands);
                  if (Array.isArray(parsed)) {
                    cmds = parsed
                      .map((cmd: any) => {
                        if (cmd.action === "add" && cmd.elementType) return `add ${cmd.elementType}`;
                        if (cmd.action === "update" && cmd.elementId) return `update ${cmd.elementId}`;
                        if (cmd.action === "delete" && cmd.elementId) return `delete ${cmd.elementId}`;
                        return cmd.action || "";
                      })
                      .filter(Boolean);
                  }
                } catch {
                  // ignore
                }
              }
              return {
                role: m.role,
                text: m.content,
                category: m.category,
                commands: cmds.length > 0 ? cmds : undefined,
              };
            }),
          });
        } else {
          set({
            messages: [
              {
                role: "assistant",
                text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials.",
              },
            ],
          });
        }
      } else {
        // Fallback: create a new session if none exists
        const newSession = await createSession("New Chat");
        set({
          sessions: [newSession],
          activeSessionId: newSession.id,
          messages: [
            {
              role: "assistant",
              text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials.",
            },
          ],
        });
      }
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    }
  },

  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId });
    try {
      const msgs = await getMessages(sessionId);
      if (msgs && msgs.length > 0) {
        set({
          messages: msgs.map((m) => {
            let cmds: string[] = [];
            if (m.commands) {
              try {
                const parsed = JSON.parse(m.commands);
                if (Array.isArray(parsed)) {
                  cmds = parsed
                    .map((cmd: any) => {
                      if (cmd.action === "add" && cmd.elementType) return `add ${cmd.elementType}`;
                      if (cmd.action === "update" && cmd.elementId) return `update ${cmd.elementId}`;
                      if (cmd.action === "delete" && cmd.elementId) return `delete ${cmd.elementId}`;
                      return cmd.action || "";
                    })
                    .filter(Boolean);
                }
              } catch {
                // ignore
              }
            }
            return {
              role: m.role,
              text: m.content,
              category: m.category,
              commands: cmds.length > 0 ? cmds : undefined,
            };
          }),
        });
      } else {
        set({
          messages: [
            {
              role: "assistant",
              text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials.",
            },
          ],
        });
      }
    } catch (e) {
      console.error("Failed to load messages for session:", e);
      set({
        messages: [
          { role: "assistant", text: "Failed to load chat history." },
        ],
      });
    }
  },

  startNewChat: async () => {
    try {
      const session = await createSession("New Chat");
      set((state) => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
        messages: [
          {
            role: "assistant",
            text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials.",
          },
        ],
      }));
    } catch (e) {
      console.error("Failed to start new chat:", e);
    }
  },

  removeSession: async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      const remaining = get().sessions.filter((s) => s.id !== sessionId);
      set({ sessions: remaining });
      
      // If we deleted the active session, select the next available one, or start a new chat
      if (get().activeSessionId === sessionId) {
        if (remaining.length > 0) {
          get().selectSession(remaining[0].id);
        } else {
          get().startNewChat();
        }
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  },
}));
