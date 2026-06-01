import { useState } from "react";
import { generateDrawingFromPrompt } from "../../services/aiDrawingService";
import { useDrawingStore } from "../../stores/drawingStore";

interface AiSectionProps {
  addElements?: (els: any[]) => void;
  authToken?: string;
}

export function AiSection({ addElements, authToken }: AiSectionProps) {
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const setCurrentArchitecturalPlan = useDrawingStore((s) => s.setCurrentArchitecturalPlan);

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiStatus({ type: "info", msg: "Generating..." });
    const result = await generateDrawingFromPrompt(aiInput.trim(), authToken);
    setAiLoading(false);
    if (result.error) {
      setAiStatus({ type: "error", msg: result.error });
    } else if (result.elements.length === 0) {
      setAiStatus({ type: "error", msg: "AI returned no elements. Try a clearer prompt." });
    } else {
      if (result.plan) setCurrentArchitecturalPlan(result.plan);
      addElements?.(result.elements);
      setAiStatus({ type: "success", msg: `✅ Added ${result.elements.length} element(s) to canvas.` });
    }
    setTimeout(() => setAiStatus(null), 5000);
  };

  return (
    <div className="px-3 pb-2">
      <div className="bg-gradient-to-b from-cyan-500/5 to-slate-100 dark:from-cyan-950/30 dark:to-[#0B0E14] border border-cyan-500/20 rounded-lg p-3 space-y-2">
        <p className="text-[9px] font-bold text-cyan-500 dark:text-cyan-400 uppercase tracking-widest">🔥 AI-Powered CAD</p>
        <textarea
          value={aiInput}
          onChange={(e) => { setAiInput(e.target.value); }}
          placeholder="Describe what to draw...&#10;e.g. 'a 10x8m apartment with 2 bedrooms'"
          rows={3}
          className="w-full bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] focus:border-cyan-500/50 rounded p-2 text-[10px] font-mono text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 outline-none resize-none transition-colors duration-300"
        />

        {/* Status bar */}
        {aiStatus && (
          <div className={`text-[9px] font-mono px-2 py-1.5 rounded border transition-colors duration-300 ${
            aiStatus.type === "success" ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400" :
            aiStatus.type === "error"   ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400" :
            "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400"
          }`}>
            {aiStatus.msg}
          </div>
        )}

        <div className="flex gap-1">
          <button
            onClick={handleAiGenerate}
            disabled={aiLoading || !aiInput.trim()}
            className={`flex-1 text-slate-900 text-[9px] font-black py-1.5 rounded transition-colors ${
              aiLoading || !aiInput.trim()
                ? "bg-cyan-800 cursor-not-allowed"
                : "bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
            }`}
          >
            {aiLoading ? "⏳ Thinking..." : "⚡ GENERATE"}
          </button>
          <button
            onClick={() => { setAiInput(""); setAiStatus(null); }}
            className="bg-slate-200 dark:bg-[#1E293B] hover:bg-[#2A3441] hover:text-white text-slate-700 dark:text-gray-300 text-[9px] font-bold px-2 py-1.5 rounded transition-colors duration-300"
            title="Clear"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {["10x8m apartment", "2 bedrooms + bathroom", "open office 20x15m", "floor plan with hallway"].map((s) => (
            <button
              key={s}
              onClick={() => setAiInput(s)}
              className="text-[8px] bg-slate-200 dark:bg-[#1E293B] hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 text-slate-600 dark:text-gray-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#1E293B] transition-colors duration-300"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
