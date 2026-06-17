import React, { useState, useRef, useCallback, useEffect } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useAuthStore } from "../../../stores/authStore";
import { generateDrawingFromPrompt, centerElementsOnViewport } from "../../../services/aiDrawingService";

interface AiCommandBoxProps {
  isAiLoading: boolean;
  setIsAiLoading: (loading: boolean) => void;
  aiStreamCount: number;
  setAiStreamCount: (count: number) => void;
}

// ── Avatar SVG with idle animation ──────────────────────────────────────────
function AiAvatar({ isOpen, isLoading }: { isOpen: boolean; isLoading: boolean }) {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      {/* Pulse rings */}
      <span
        className={`absolute inset-0 rounded-full transition-all duration-700 ${
          isLoading
            ? "animate-ping bg-cyan-400/30"
            : isOpen
              ? "bg-cyan-400/10 scale-110"
              : "bg-cyan-400/5 animate-[pulse_3s_ease-in-out_infinite]"
        }`}
      />
      <span
        className={`absolute inset-1 rounded-full transition-all duration-500 ${
          isLoading ? "bg-cyan-500/20 animate-[pulse_1s_ease-in-out_infinite]" : "bg-transparent"
        }`}
      />

      {/* Robot face */}
      <svg
        viewBox="0 0 64 64"
        className={`relative w-10 h-10 drop-shadow-lg transition-transform duration-500 ${
          isOpen ? "scale-110" : "hover:scale-105"
        }`}
      >
        {/* Head */}
        <rect x="12" y="16" width="40" height="36" rx="10" fill="url(#headGrad)" stroke="#22d3ee" strokeWidth="1.5" />
        {/* Antenna */}
        <line x1="32" y1="16" x2="32" y2="8" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="6" r="3" fill="#22d3ee">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        {/* Eyes */}
        <g>
          <ellipse cx="24" cy="32" rx="4" ry={isLoading ? "2" : "4"} fill="#22d3ee">
            {!isLoading && (
              <animate attributeName="ry" values="4;1;4" dur="3.5s" repeatCount="indefinite" keyTimes="0;0.03;1" />
            )}
          </ellipse>
          <ellipse cx="40" cy="32" rx="4" ry={isLoading ? "2" : "4"} fill="#22d3ee">
            {!isLoading && (
              <animate attributeName="ry" values="4;1;4" dur="3.5s" repeatCount="indefinite" keyTimes="0;0.03;1" />
            )}
          </ellipse>
          {/* Eye glow */}
          <ellipse cx="24" cy="32" rx="2" ry="2" fill="#fff" opacity="0.6" />
          <ellipse cx="40" cy="32" rx="2" ry="2" fill="#fff" opacity="0.6" />
        </g>
        {/* Mouth */}
        {isLoading ? (
          <g>
            <rect x="22" y="42" width="4" height="3" rx="1" fill="#22d3ee" opacity="0.7">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="indefinite" />
            </rect>
            <rect x="30" y="42" width="4" height="3" rx="1" fill="#22d3ee" opacity="0.7">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="indefinite" begin="0.2s" />
            </rect>
            <rect x="38" y="42" width="4" height="3" rx="1" fill="#22d3ee" opacity="0.7">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="indefinite" begin="0.4s" />
            </rect>
          </g>
        ) : (
          <path d="M24 43 Q32 48 40 43" stroke="#22d3ee" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {/* Gradient defs */}
        <defs>
          <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// ── Floating particles behind avatar ────────────────────────────────────────
function Particles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
      {[...Array(6)].map((_, i) => (
        <span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400/40"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
            animation: `float-particle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  );
}

export const AiCommandBox: React.FC<AiCommandBoxProps> = ({
  isAiLoading,
  setIsAiLoading,
  aiStreamCount,
  setAiStreamCount,
}) => {
  const authToken = useAuthStore((state) => state.token);
  const addElements = useDrawingStore((state) => state.addElements);
  const updateElement = useDrawingStore((state) => state.updateElement);
  const setTool = useDrawingStore((state) => state.setTool);
  const setCurrentArchitecturalPlan = useDrawingStore((state) => state.setCurrentArchitecturalPlan);

  const [commandInput, setCommandInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // ── Dragging state ──────────────────────────────────────────────────────
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem("ai-avatar-pos");
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch {}
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const didDrag = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persist position
  useEffect(() => {
    try { localStorage.setItem("ai-avatar-pos", JSON.stringify(pos)); } catch {}
  }, [pos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    didDrag.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.startPosX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.startPosY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleAvatarClick = () => {
    if (didDrag.current) return;
    setIsOpen((prev) => !prev);
  };

  // ── AI generate handler (same logic) ────────────────────────────────────
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
      alert(res.error);
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
    if (e.key === "Escape") { setIsOpen(false); }
  };

  // Panel position — clamp so it doesn't go off screen
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(pos.x - 140, window.innerWidth - 340),
    top: Math.max(8, pos.y - 320),
    width: 320,
  };

  return (
    <>
      {/* ── Inline keyframes ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          50% { transform: translate(${Math.random() > 0.5 ? '' : '-'}8px, -12px) scale(1.5); opacity: 0.8; }
        }
        @keyframes avatar-breathe {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.03) translateY(-2px); }
        }
        @keyframes panel-enter {
          from { opacity: 0; transform: scale(0.9) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* ── Floating Avatar (draggable) ──────────────────────────────────── */}
      <div
        ref={containerRef}
        className="fixed z-50 select-none"
        style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      >
        {/* Drag handle + click area */}
        <div
          className={`relative cursor-grab active:cursor-grabbing transition-shadow duration-300 rounded-full ${
            isOpen ? "shadow-[0_0_30px_rgba(34,211,238,0.3)]" : "shadow-[0_0_15px_rgba(34,211,238,0.15)]"
          }`}
          style={{ animation: "avatar-breathe 4s ease-in-out infinite" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={handleAvatarClick}
        >
          {/* Outer glow ring */}
          <div className={`absolute -inset-1 rounded-full transition-all duration-500 ${
            isOpen ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20" : "bg-transparent"
          }`} />

          {/* Avatar body */}
          <div className="relative rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/30 hover:border-cyan-400/60 transition-colors">
            <Particles />
            <AiAvatar isOpen={isOpen} isLoading={isAiLoading} />
          </div>

          {/* Status dot */}
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
            isAiLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
          }`} />

          {/* Notification badge when loading */}
          {isAiLoading && aiStreamCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-[8px] font-black text-slate-900 rounded-full w-5 h-5 flex items-center justify-center">
              {aiStreamCount}
            </span>
          )}
        </div>
      </div>

      {/* ── Expanded Chat Panel ──────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed z-40"
          style={panelStyle}
        >
          <div
            className="bg-slate-50/95 dark:bg-[#151B23]/95 backdrop-blur-xl border border-slate-200 dark:border-[#1E293B] rounded-2xl flex flex-col shadow-2xl ring-1 ring-white/5 overflow-hidden"
            style={{ animation: "panel-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
          >
            {/* Panel header */}
            <div className="p-3 border-b border-slate-200 dark:border-[#1E293B] flex items-center gap-3 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-[#11161D]/80 dark:to-[#151B23]/80">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-black text-slate-900 dark:text-white tracking-widest uppercase">
                  Command AI
                </div>
                <div className="text-[8px] font-mono text-cyan-500/70">ENGINEERING_MODEL_v4.2</div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Suggestion chips */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                Thử: "Vẽ nhà 10x12m, 2 phòng ngủ, 1 cửa 1m"
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "🏠 House 10x12m", prompt: "Draw a 10x12m house with 2 bedrooms" },
                  { label: "🚪 Add door", prompt: "Add a 1m door to the front wall" },
                  { label: "🪟 Add windows", prompt: "Add 1.2m windows to all rooms" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => { setCommandInput(chip.prompt); }}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[9px] font-medium text-slate-500 dark:text-slate-400 hover:border-cyan-400 hover:text-cyan-500 transition-all hover:shadow-sm"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <button
                disabled={isAiLoading || !commandInput.trim()}
                onClick={handleGenerate}
                className={`w-full text-white text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  isAiLoading || !commandInput.trim()
                    ? "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30"
                }`}
              >
                {isAiLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {aiStreamCount > 0 ? `Drawing ${aiStreamCount} entities…` : "Thinking…"}
                  </span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    GENERATE
                  </>
                )}
              </button>
            </div>

            {/* Input bar */}
            <div className="p-3 border-t border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0B0E14]/80 flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Command or describe…"
                  autoFocus
                  className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all"
                />
              </div>
              <button
                className="w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center transition-colors shadow-sm"
                onClick={handleGenerate}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
