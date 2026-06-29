import { useState, useCallback } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { detectClashes, exportBcf, type Clash } from "../../bim/clashDetector";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-900/30 border-red-700",
  major:    "text-yellow-400 bg-yellow-900/30 border-yellow-700",
  minor:    "text-blue-400 bg-blue-900/30 border-blue-700",
};

const SEVERITY_ICON: Record<string, string> = {
  critical: "🔴",
  major:    "🟡",
  minor:    "🔵",
};

interface ClashPanelProps {
  onHighlight?: (elementIds: string[]) => void;
}

export function ClashPanel({ onHighlight }: ClashPanelProps) {
  const elements   = useDrawingStore((s) => s.elements);
  const [clashes,  setClashes]  = useState<Clash[]>([]);
  const [running,  setRunning]  = useState(false);
  const [lastRun,  setLastRun]  = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runDetection = useCallback(() => {
    setRunning(true);
    // Defer to next tick so UI updates first
    setTimeout(() => {
      const found = detectClashes(elements);
      setClashes(found);
      setRunning(false);
      setLastRun(new Date().toLocaleTimeString("vi-VN"));
    }, 50);
  }, [elements]);

  const handleExportBcf = useCallback(() => {
    const content = exportBcf(clashes);
    const blob    = new Blob([content], { type: "application/json" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = `clash-report-${Date.now()}.bcf.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [clashes]);

  const critical = clashes.filter((c) => c.severity === "critical").length;
  const major    = clashes.filter((c) => c.severity === "major").length;
  const minor    = clashes.filter((c) => c.severity === "minor").length;

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          {lastRun && (
            <span className="text-slate-600 text-[9px]">Lần cuối: {lastRun}</span>
          )}
        </div>
        <div className="flex gap-1.5">
          {clashes.length > 0 && (
            <button
              onClick={handleExportBcf}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[9px] px-2 py-1 rounded font-medium"
            >
              BCF ↓
            </button>
          )}
          <button
            onClick={runDetection}
            disabled={running}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[9px] px-2 py-1 rounded font-bold"
          >
            {running ? "Đang kiểm tra..." : "Chạy kiểm tra"}
          </button>
        </div>
      </div>

      {/* Summary badges */}
      {clashes.length > 0 && (
        <div className="flex gap-1.5 p-2 shrink-0 flex-wrap">
          {critical > 0 && (
            <span className="bg-red-900/40 text-red-400 border border-red-700 px-2 py-0.5 rounded text-[9px] font-bold">
              🔴 {critical} lỗi
            </span>
          )}
          {major > 0 && (
            <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded text-[9px] font-bold">
              🟡 {major} cảnh báo
            </span>
          )}
          {minor > 0 && (
            <span className="bg-blue-900/40 text-blue-400 border border-blue-700 px-2 py-0.5 rounded text-[9px] font-bold">
              🔵 {minor} nhỏ
            </span>
          )}
        </div>
      )}

      {/* No clashes */}
      {!running && clashes.length === 0 && lastRun && (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
          <span className="text-2xl">✅</span>
          <span>Không phát hiện xung đột</span>
        </div>
      )}

      {/* Initial state */}
      {!running && clashes.length === 0 && !lastRun && (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
          <span className="text-2xl">🔍</span>
          <span>Nhấn &quot;Chạy kiểm tra&quot; để bắt đầu</span>
          <div className="text-[9px] text-slate-600 text-center px-4">
            Kiểm tra: ống nước đâm tường, cửa bị chặn, cột chồng tường
          </div>
        </div>
      )}

      {/* Clash list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {clashes.map((clash) => (
          <div
            key={clash.id}
            className={`border rounded p-2 cursor-pointer transition-colors ${SEVERITY_COLOR[clash.severity]}`}
            onClick={() => setExpanded(expanded === clash.id ? null : clash.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 flex-1 min-w-0">
                <span className="shrink-0 mt-0.5">{SEVERITY_ICON[clash.severity]}</span>
                <span className="leading-tight">{clash.description}</span>
              </div>
              <span className="text-[9px] opacity-60 shrink-0 capitalize">{clash.type}</span>
            </div>

            {expanded === clash.id && (
              <div className="mt-2 flex flex-col gap-1.5 border-t border-current/20 pt-2">
                <div className="text-[9px] opacity-70">
                  Vị trí: ({Math.round(clash.position.x)}, {Math.round(clash.position.y)})
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onHighlight?.([clash.elementAId, clash.elementBId]);
                    }}
                    className="flex-1 bg-black/20 hover:bg-black/40 py-1 rounded text-[9px] font-medium"
                  >
                    Highlight ↗
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
