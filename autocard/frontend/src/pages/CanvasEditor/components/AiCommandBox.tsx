import React, { useState, useRef, useCallback, useEffect } from "react";
import { appDialog } from "../../../stores/dialogStore";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useAuthStore } from "../../../stores/authStore";
import { generateDrawingFromPrompt, centerElementsOnViewport } from "../../../services/aiDrawingService";

interface AiCommandBoxProps {
  isAiLoading: boolean;
  setIsAiLoading: (loading: boolean) => void;
  aiStreamCount: number;
  setAiStreamCount: (count: number) => void;
}

export const AiCommandBox: React.FC<AiCommandBoxProps> = ({
  isAiLoading,
  setIsAiLoading,
  aiStreamCount,
  setAiStreamCount,
}) => {
  const authToken = useAuthStore((state) => state.token);
  const addElements = useDrawingStore((state) => state.addElements);
  const setTool = useDrawingStore((state) => state.setTool);
  const setCurrentArchitecturalPlan = useDrawingStore((state) => state.setCurrentArchitecturalPlan);

  const [commandInput, setCommandInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // ── AI generate handler ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!commandInput.trim()) return;
    setIsAiLoading(true);
    setAiStreamCount(0);
    let streamedCount = 0;
    const res = await generateDrawingFromPrompt(
      commandInput.trim(),
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
          setCommandInput("");
        }
      }
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
      }
      setCommandInput("");
    } else if (res.error) {
      appDialog.alert(res.error, { title: "Error", variant: "danger" });
    }
    setAiStreamCount(0);
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
      `}</style>

      {/* ── Bottom-right container — avatar + panel together ─────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

        {/* ── Chat Panel (appears above FAB) ────────────────────────────── */}
        {isOpen && (
          <div
            className="w-72 bg-white dark:bg-[#1A2030] border border-slate-200 dark:border-[#2A3441] rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: "ai-panel-in 0.2s ease-out both" }}
          >
            {/* Header */}
            <div className="px-3 py-2.5 flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500">
              <svg className="w-4 h-4 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[11px] font-bold text-white tracking-wide flex-1">COMMAND AI</span>
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick actions */}
            <div className="p-3 space-y-2.5">
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
            <div className="px-3 pb-3 flex items-center gap-1.5">
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
