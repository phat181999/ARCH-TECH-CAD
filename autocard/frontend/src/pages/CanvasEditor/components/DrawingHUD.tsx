import React from "react";
import { useDrawingStore } from "../../../stores/drawingStore";

interface DrawingHUDProps {
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  dragPoint: { x: number; y: number } | null;
  mouseClientPos: { x: number; y: number } | null;
  snapPoint: any;
  tool: string;
  typedValue?: string;
}

export const DrawingHUD: React.FC<DrawingHUDProps> = ({
  isDrawing,
  startPoint,
  dragPoint,
  mouseClientPos,
  snapPoint,
  tool,
  typedValue,
}) => {
  if (!isDrawing || !startPoint || !dragPoint || !mouseClientPos) return null;

  const length = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
  const angle =
    (((Math.atan2(-(dragPoint.y - startPoint.y), dragPoint.x - startPoint.x) * 180) / Math.PI) + 360) % 360;
  const formatLength = useDrawingStore((state) => state.formatLength);

  const getInputLabel = () => {
    if (tool === "rotate") return "Angle";
    if (tool === "scale") return "Scale";
    return "Distance";
  };

  const labelSuffix = tool === "rotate" ? "°" : "";

  return (
    <div
      className="fixed z-30 pointer-events-none bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-sm border border-cyan-500/30 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-200 shadow-lg"
      style={{ left: mouseClientPos.x + 18, top: mouseClientPos.y + 18 }}
    >
      <div className="flex flex-col gap-0.5">
        {typedValue && (
          <div className="border-b border-slate-700/50 pb-1 mb-1 flex items-center justify-between gap-4">
            <span className="text-slate-400 font-bold uppercase">{getInputLabel()}:</span>
            <span className="text-yellow-400 font-bold text-xs bg-black/40 px-1 rounded animate-pulse">
              {typedValue}{labelSuffix}
            </span>
          </div>
        )}
        <span>
          <span className="text-slate-500">L: </span>
          <span className="text-cyan-400">{formatLength(length / 100)}</span>
        </span>
        <span>
          <span className="text-slate-500">∠: </span>
          <span className="text-cyan-400">{angle | 0}°</span>
        </span>
        {snapPoint && (
          <span>
            <span className="text-slate-500">⊙: </span>
            <span className="text-cyan-400 capitalize">{snapPoint.type}</span>
          </span>
        )}
      </div>
    </div>
  );
};
