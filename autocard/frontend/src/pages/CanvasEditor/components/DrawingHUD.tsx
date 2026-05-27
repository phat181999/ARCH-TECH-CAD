import React from "react";

interface DrawingHUDProps {
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  dragPoint: { x: number; y: number } | null;
  mouseClientPos: { x: number; y: number } | null;
  snapPoint: any;
}

export const DrawingHUD: React.FC<DrawingHUDProps> = ({
  isDrawing,
  startPoint,
  dragPoint,
  mouseClientPos,
  snapPoint,
}) => {
  if (!isDrawing || !startPoint || !dragPoint || !mouseClientPos) return null;

  const length = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
  const angle =
    (((Math.atan2(-(dragPoint.y - startPoint.y), dragPoint.x - startPoint.x) * 180) / Math.PI) + 360) % 360;

  return (
    <div
      className="fixed z-30 pointer-events-none bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-sm border border-cyan-500/30 rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-200 shadow-lg"
      style={{ left: mouseClientPos.x + 18, top: mouseClientPos.y + 18 }}
    >
      <div className="flex flex-col gap-0.5">
        <span>
          <span className="text-slate-500">L: </span>
          <span className="text-cyan-400">{length.toFixed(2)}</span>
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
