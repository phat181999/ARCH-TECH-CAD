import React, { useState, useRef, useCallback, useEffect } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useAuthStore } from "../../../stores/authStore";
import { generateDrawingFromPrompt, interactDrawingFromPrompt, centerElementsOnViewport } from "../../../services/aiDrawingService";
import { listSessions, createSession, getMessages } from "../../../services/chatService";

interface AiCommandBoxProps {
  isAiLoading: boolean;
  setIsAiLoading: (loading: boolean) => void;
  aiStreamCount: number;
  setAiStreamCount: (count: number) => void;
  drawingId?: string;
}

export const AiCommandBox: React.FC<AiCommandBoxProps> = ({
  isAiLoading,
  setIsAiLoading,
  aiStreamCount,
  setAiStreamCount,
  drawingId,
}) => {
  const authToken = useAuthStore((state) => state.token);
  const elements = useDrawingStore((state) => state.elements);
  const addElements = useDrawingStore((state) => state.addElements);
  const addElement = useDrawingStore((state) => state.addElement);
  const updateElement = useDrawingStore((state) => state.updateElement);
  const deleteElement = useDrawingStore((state) => state.deleteElement);
  const setTool = useDrawingStore((state) => state.setTool);
  const saveDrawing = useDrawingStore((state) => state.saveDrawing);
  const setCurrentArchitecturalPlan = useDrawingStore((state) => state.setCurrentArchitecturalPlan);

  const [commandInput, setCommandInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // ── 1. Message History (Database Persisted) ─────────────────────────────
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; commands?: string[] }>>([
    { role: "assistant", text: "Hello! I am your CAD assistant. Ask me to draw something, verify codes, or check materials." }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load chat session and message history from database on mount (scoped by drawingId)
  useEffect(() => {
    const loadSessionAndMessages = async () => {
      try {
        const list = await listSessions(drawingId);
        let sessionId = "";
        if (list.length > 0) {
          // Take the most recently updated session for this drawing
          sessionId = list[0].id;
        } else {
          // Fallback: create a new session scoped to this drawing
          const newSession = await createSession(drawingId ? "Drawing Chat" : "New Chat", drawingId);
          sessionId = newSession.id;
        }
        setActiveSessionId(sessionId);

        const msgs = await getMessages(sessionId);
        if (msgs && msgs.length > 0) {
          setMessages(
            msgs.map((m: any) => {
              let cmds: string[] = [];
              if (m.commands) {
                try {
                  const parsed = JSON.parse(m.commands);
                  if (Array.isArray(parsed)) {
                    cmds = parsed.map((cmd: any) => {
                      if (cmd.action === "add" && cmd.elementType) return `add ${cmd.elementType}`;
                      if (cmd.action === "update" && cmd.elementId) return `update ${cmd.elementId}`;
                      if (cmd.action === "delete" && cmd.elementId) return `delete ${cmd.elementId}`;
                      return cmd.action || "";
                    }).filter(Boolean);
                  }
                } catch {}
              }
              return {
                role: m.role,
                text: m.content,
                commands: cmds.length > 0 ? cmds : undefined,
              };
            })
          );
        }
      } catch (e) {
        console.error("Failed to load chat session from DB", e);
      }
    };
    loadSessionAndMessages();
  }, [drawingId]);

  // ── 2. Dimensions & Resize Dragging ─────────────────────────────────────
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    const saved = localStorage.getItem("commandAiDimensions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { width: 288, height: 350 };
  });

  const [isResizing, setIsResizing] = useState<"w" | "h" | "both" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const autoSave = useCallback(() => {
    saveDrawing();
  }, [saveDrawing]);

  // Sync dimensions to localStorage
  useEffect(() => {
    localStorage.setItem("commandAiDimensions", JSON.stringify(dimensions));
  }, [dimensions]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Resize Handler
  const startResize = (e: React.MouseEvent, direction: "w" | "h" | "both") => {
    e.preventDefault();
    setIsResizing(direction);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(600, window.innerWidth - 20 - e.clientX));
      const newHeight = Math.max(220, Math.min(700, window.innerHeight - 20 - e.clientY));

      setDimensions((prev) => {
        const next = { ...prev };
        if (isResizing === "w" || isResizing === "both") {
          next.width = newWidth;
        }
        if (isResizing === "h" || isResizing === "both") {
          next.height = newHeight;
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // ── AI generate/edit handler ─────────────────────────────────────────────
  const handleGenerate = async () => {
    const prompt = commandInput.trim();
    if (!prompt) return;

    setIsAiLoading(true);
    setAiStreamCount(0);
    setCommandInput("");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);

    // If there are existing elements on the canvas, treat this as an EDIT/INTERACT command
    if (elements.length > 0) {
      try {
        const res = await interactDrawingFromPrompt(
          prompt,
          elements,
          authToken ?? undefined,
          activeSessionId ?? undefined
        );

        setIsAiLoading(false);
        if (res.error) {
          setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${res.error}` }]);
          return;
        }

        const store = useDrawingStore.getState();
        const activeLayerId = store.activeLayerId;
        
        let addedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const executedStrs: string[] = [];

        res.commands.forEach((cmd) => {
          if (cmd.action === "add" && cmd.elementType) {
            let newEl: any = {
              id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: cmd.elementType,
              layerId: activeLayerId,
              strokeColor: "#1f2937",
              strokeWidth: 2,
              ...cmd.properties
            };

            if (cmd.elementType === "wall") {
              const start = cmd.properties?.start || { x: cmd.properties?.x1 || 0, y: cmd.properties?.y1 || 0 };
              const end = cmd.properties?.end || { x: cmd.properties?.x2 || 0, y: cmd.properties?.y2 || 0 };
              const thickness = cmd.properties?.thickness || cmd.properties?.wallThickness || 20;
              const height = cmd.properties?.height || 300;

              newEl = {
                ...newEl,
                archType: "wall",
                start,
                end,
                x1: start.x,
                y1: start.y,
                x2: end.x,
                y2: end.y,
                thickness,
                wallThickness: thickness,
                height,
              };
            } else if (cmd.elementType === "door" || cmd.elementType === "window" || cmd.elementType === "opening") {
              const type = cmd.properties?.openingType || cmd.properties?.archType || cmd.elementType;
              const hostWallId = cmd.properties?.hostWallId || "";
              const pos = cmd.properties?.position || { x: cmd.properties?.x || 0, y: cmd.properties?.y || 0 };
              const width = cmd.properties?.width || 90;
              const height = cmd.properties?.height || 210;
              const sill = cmd.properties?.sill || (type === "door" ? 0 : 90);

              newEl = {
                ...newEl,
                type: "opening",
                archType: type,
                openingType: type,
                hostWallId,
                position: pos,
                x: pos.x,
                y: pos.y,
                width,
                height,
                sill,
              };
            }

            store.addElement(newEl);
            addedCount++;
            executedStrs.push(`add ${cmd.elementType}`);
          } else if (cmd.action === "update" && cmd.elementId && cmd.properties) {
            store.updateElement(cmd.elementId, cmd.properties);
            updatedCount++;
            executedStrs.push(`update ${cmd.elementId}`);
          } else if (cmd.action === "delete" && cmd.elementId) {
            store.deleteElement(cmd.elementId);
            deletedCount++;
            executedStrs.push(`delete ${cmd.elementId}`);
          }
        });

        if (addedCount > 0 || updatedCount > 0 || deletedCount > 0) {
          autoSave();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `${res.summary}\n\n*(Modified drawing: added ${addedCount}, updated ${updatedCount}, deleted ${deletedCount} elements)*`,
              commands: executedStrs,
            }
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: res.summary }
          ]);
        }
      } catch (err: any) {
        setIsAiLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Error: ${err.message || "Failed to execute AI edit"}` }
        ]);
      }
      return;
    }

    // Otherwise, perform standard generative drawing (create new layout)
    let streamedCount = 0;
    const res = await generateDrawingFromPrompt(
      prompt,
      authToken ?? undefined,
      (partialElements, done) => {
        const { activeLayerId, panOffset, zoom } = useDrawingStore.getState();
        if (partialElements.length > 0) {
          centerElementsOnViewport(partialElements, panOffset, zoom);
          const store = useDrawingStore.getState();
          const existingIds = new Set(store.elements.map((e: any) => e.id));
          const newEls = partialElements.filter((e: any) => !existingIds.has(e.id));
          const updateEls = partialElements.filter((e: any) => existingIds.has(e.id));
          if (newEls.length > 0) {
            store.addElements(
              newEls.map((el: any) => ({ ...el, layerId: el.layerId || activeLayerId }))
            );
          }
          updateEls.forEach((el: any) => store.updateElement(el.id, el));
          streamedCount = partialElements.length;
          setAiStreamCount(streamedCount);
        }
        if (done) {
          setIsAiLoading(false);
          setAiStreamCount(0);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "Successfully generated drawing elements on the canvas.",
              commands: partialElements.map((el: any) => `add ${el.type}`),
            }
          ]);
        }
      },
      activeSessionId ?? undefined
    );

    setIsAiLoading(false);
    if (res.elements?.length) {
      if (res.plan) setCurrentArchitecturalPlan(res.plan);
      if (streamedCount === 0) {
        const { panOffset, zoom } = useDrawingStore.getState();
        centerElementsOnViewport(res.elements, panOffset, zoom);
        addElements(
          res.elements.map((el) => ({ ...el, layerId: el.layerId || useDrawingStore.getState().activeLayerId }))
        );
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Successfully generated drawing elements on the canvas.",
            commands: res.elements ? res.elements.map((el: any) => `add ${el.type}`) : undefined,
          }
        ]);
      }
    } else if (res.error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${res.error}` }
      ]);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const cmd = commandInput.trim().toUpperCase();
      if (!cmd) return;

      const shortcuts: Record<string, string> = {
        L: "line", LINE: "line", PL: "polyline", PLINE: "polyline",
        C: "circle", CIRCLE: "circle", REC: "rectangle", RECTANGLE: "rectangle",
        D: "dimension", DIM: "dimension", T: "text", TEXT: "text",
        H: "hatch", HATCH: "hatch", M: "select", MOVE: "select",
      };
      if (shortcuts[cmd]) { setTool(shortcuts[cmd] as any); setCommandInput(""); return; }
      if (cmd === "PLOT") { window.print(); setCommandInput(""); return; }
      await handleGenerate();
    }
    if (e.key === "Escape") setIsOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes ai-fab-breathe {
          0%, 100% { box-shadow: 0 2px 12px rgba(34,211,238,0.15); }
          50% { box-shadow: 0 2px 20px rgba(34,211,238,0.3); }
        }
        @keyframes ai-panel-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes message-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Bottom-right container — avatar + panel together ─────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

        {/* ── Chat Panel (appears above FAB) ────────────────────────────── */}
        {isOpen && (
          <div
            className="bg-white dark:bg-[#1A2030] border border-slate-200 dark:border-[#2A3441] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
            style={{
              animation: "ai-panel-in 0.2s ease-out both",
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
            }}
          >
            {/* ── Drag Resize Handles ─────────────────────────────────────── */}
            <div
              onMouseDown={(e) => startResize(e, "w")}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize hover:bg-cyan-500/10 transition-colors z-50"
              title="Drag to resize width"
            />
            <div
              onMouseDown={(e) => startResize(e, "h")}
              className="absolute top-0 left-0 right-0 h-1 cursor-n-resize hover:bg-cyan-500/10 transition-colors z-50"
              title="Drag to resize height"
            />
            <div
              onMouseDown={(e) => startResize(e, "both")}
              className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-cyan-500/20 transition-colors z-50 flex items-center justify-center"
              title="Drag to resize"
            >
              <svg className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-60 hover:opacity-100" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                <path d="M1 9 L9 1 M5 9 L9 5" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>

            {/* Header */}
            <div className="px-3 py-2.5 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 shrink-0">
              <svg className="w-4 h-4 text-white/90 ml-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[11px] font-bold text-white tracking-wide flex-1">COMMAND AI</span>
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat message area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-[11.5px] px-2.5 py-1.5 rounded-xl max-w-[85%] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-tr-none ml-auto shadow-sm shadow-cyan-500/10"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none mr-auto shadow-sm"
                  }`}
                  style={{
                    animation: "message-in 0.2s ease-out both",
                    whiteSpace: "pre-line",
                  }}
                >
                  <span>{msg.text}</span>
                  {msg.commands && msg.commands.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">Commands executed:</span>
                      {msg.commands.map((cmd, j) => (
                        <code key={j} className="block text-[9.5px] text-emerald-500 font-mono mt-0.5">
                          : {cmd}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions */}
            <div className="p-3 space-y-2.5 shrink-0">
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "🏠 House 10x12m", prompt: "Draw a 10x12m house with 2 bedrooms" },
                  { label: "🚪 Add door", prompt: "Add a 1m door to the front wall" },
                  { label: "🪟 Windows", prompt: "Add 1.2m windows to all rooms" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => setCommandInput(chip.prompt)}
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[9px] font-medium text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-500 transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <button
                disabled={isAiLoading || !commandInput.trim()}
                onClick={handleGenerate}
                className={`w-full text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all ${
                  isAiLoading || !commandInput.trim()
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/20 hover:shadow-cyan-400/30"
                }`}
              >
                {isAiLoading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {aiStreamCount > 0 ? `${aiStreamCount} entities…` : "Thinking…"}
                  </span>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    GENERATE
                  </>
                )}
              </button>
            </div>

            {/* Input bar */}
            <div className="px-3 pb-3 flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Command or describe…"
                autoFocus
                className="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all"
              />
              <button
                className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center transition-colors shrink-0"
                onClick={handleGenerate}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── FAB Avatar button ─────────────────────────────────────────── */}
        <button
          onClick={() => setIsOpen((p) => !p)}
          className={`group relative w-12 h-12 rounded-full transition-all duration-300 ${
            isOpen
              ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30"
              : "bg-gradient-to-br from-slate-700 to-slate-800 hover:from-cyan-600 hover:to-blue-600"
          }`}
          style={{ animation: isOpen ? "none" : "ai-fab-breathe 3s ease-in-out infinite" }}
        >
          {/* Robot icon or close icon */}
          {isOpen ? (
            <svg className="w-5 h-5 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg viewBox="0 0 64 64" className="w-8 h-8 mx-auto">
              <rect x="14" y="18" width="36" height="32" rx="8" fill="none" stroke="#22d3ee" strokeWidth="2.5" />
              <line x1="32" y1="18" x2="32" y2="10" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
              <circle cx="32" cy="8" r="2.5" fill="#22d3ee" />
              <circle cx="24" cy="32" r="3.5" fill="#22d3ee" />
              <circle cx="40" cy="32" r="3.5" fill="#22d3ee" />
              <path d="M24 42 Q32 46 40 42" stroke="#22d3ee" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}

          {/* Status dot */}
          <span className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${
            isAiLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          }`} />

          {/* Loading badge */}
          {isAiLoading && aiStreamCount > 0 && (
            <span className="absolute -top-1 -left-1 bg-cyan-500 text-[7px] font-black text-white rounded-full w-4 h-4 flex items-center justify-center shadow">
              {aiStreamCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
};
