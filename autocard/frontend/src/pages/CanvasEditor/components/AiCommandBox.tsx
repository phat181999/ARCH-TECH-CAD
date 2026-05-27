import React, { useState } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useAuthStore } from "../../../stores/authStore";
import { generateDrawingFromPrompt, centerElementsOnViewport } from "../../../services/aiDrawingService";
import { ToolType } from "../../../types";

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
  const updateElement = useDrawingStore((state) => state.updateElement);
  const setTool = useDrawingStore((state) => state.setTool);
  const setCurrentArchitecturalPlan = useDrawingStore((state) => state.setCurrentArchitecturalPlan);

  const [commandInput, setCommandInput] = useState("");

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

  return (
    <div className="absolute bottom-6 right-6 w-80 bg-slate-50 dark:bg-[#151B23]/95 backdrop-blur-xl border border-slate-200 dark:border-[#1E293B] rounded-xl flex flex-col shadow-2xl z-20 overflow-hidden ring-1 ring-white/5">
      <div className="p-3 border-b border-slate-200 dark:border-[#1E293B] flex items-center bg-slate-100 dark:bg-[#11161D]/80">
        <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center mr-3">
          <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-900 dark:text-white tracking-widest uppercase">
            Command AI
          </span>
          <span className="text-[8px] font-mono text-cyan-500/70">ENGINEERING_MODEL_v4.2</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Try: "Draw a 10x12m house with a bedroom and a 1m door"
        </p>

        <div className="flex gap-2">
          <button
            disabled={isAiLoading || !commandInput.trim()}
            onClick={handleGenerate}
            className={`flex-1 text-slate-900 dark:text-white text-[9px] font-bold py-1.5 rounded flex items-center justify-center transition-colors ${
              isAiLoading || !commandInput.trim()
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
            }`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isAiLoading ? (
              <span className="flex items-center gap-1">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {aiStreamCount > 0 ? `${aiStreamCount} entities…` : "THINKING…"}
              </span>
            ) : (
              "GENERATE"
            )}
          </button>
          <button
            className="flex-1 bg-slate-200 dark:bg-[#1E293B] hover:bg-[#2A3441] text-slate-700 dark:text-gray-300 text-[9px] font-bold py-1.5 rounded transition-colors"
            onClick={() => setCommandInput((prev) => prev + " with stroke color #EF4444")}
          >
            ADD RED COLOR
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0B0E14] flex items-center">
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const cmd = commandInput.trim().toUpperCase();
              if (!cmd) return;

              // 1. Check for basic CAD shortcuts first
              if (cmd === "L" || cmd === "LINE") {
                setTool("line");
                setCommandInput("");
                return;
              }
              if (cmd === "PL" || cmd === "PLINE") {
                setTool("polyline");
                setCommandInput("");
                return;
              }
              if (cmd === "C" || cmd === "CIRCLE") {
                setTool("circle");
                setCommandInput("");
                return;
              }
              if (cmd === "REC" || cmd === "RECTANGLE") {
                setTool("rectangle");
                setCommandInput("");
                return;
              }
              if (cmd === "D" || cmd === "DIM") {
                setTool("dimension");
                setCommandInput("");
                return;
              }
              if (cmd === "T" || cmd === "TEXT") {
                setTool("text");
                setCommandInput("");
                return;
              }
              if (cmd === "H" || cmd === "HATCH") {
                setTool("hatch");
                setCommandInput("");
                return;
              }
              if (cmd === "M" || cmd === "MOVE") {
                setTool("select");
                setCommandInput("");
                return;
              }
              if (cmd === "PLOT") {
                window.print();
                setCommandInput("");
                return;
              }

              // 2. If it's a long string, treat as an AI prompt
              await handleGenerate();
            }
          }}
          placeholder="Enter command or describe drawing..."
          className="bg-transparent border-none text-xs font-bold text-slate-900 dark:text-white placeholder-slate-600 flex-1 focus:outline-none font-mono"
        />
        <button className="text-slate-500 hover:text-cyan-400 p-1 transition-colors" onClick={handleGenerate}>
          <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};
