import { useState } from "react";
import { generateDrawingFromPrompt } from "../../services/aiDrawingService";
import { useDrawingStore } from "../../stores/drawingStore";
import { Zap, X } from "lucide-react";

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
      setAiStatus({ type: "success", msg: `Added ${result.elements.length} element(s) to canvas.` });
    }
    setTimeout(() => setAiStatus(null), 5000);
  };

  return (
    <div className="px-3 pb-2">
      <div className="bg-gradient-to-b from-blue-600/5 to-transparent border border-blue-600/20 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <Zap className="w-3 h-3" />
          AI-Powered CAD
        </p>
        <textarea
          value={aiInput}
          onChange={(e) => { setAiInput(e.target.value); }}
          placeholder={"Describe what to draw...\ne.g. 'a 10x8m apartment with 2 bedrooms'"}
          rows={3}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-blue-500/50 rounded p-2 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 outline-none resize-none"
        />

        {aiStatus && (
          <div className={`text-xs font-mono px-2 py-1.5 rounded border ${
            aiStatus.type === "success" ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400" :
            aiStatus.type === "error"   ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400" :
            "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400"
          }`}>
            {aiStatus.msg}
          </div>
        )}

        <div className="flex gap-1">
          <button
            onClick={handleAiGenerate}
            disabled={aiLoading || !aiInput.trim()}
            className={`flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-semibold py-1.5 rounded transition-colors ${
              aiLoading || !aiInput.trim()
                ? "bg-blue-800/50 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            <Zap className="w-3 h-3" />
            {aiLoading ? "Thinking..." : "Generate"}
          </button>
          <button
            onClick={() => { setAiInput(""); setAiStatus(null); }}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold px-2 py-1.5 rounded transition-colors"
            title="Clear"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {["10x8m apartment", "2 bedrooms + bathroom", "open office 20x15m", "floor plan with hallway"].map((s) => (
            <button
              key={s}
              onClick={() => setAiInput(s)}
              className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
