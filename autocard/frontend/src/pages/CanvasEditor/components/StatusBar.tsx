import React, { useState, useEffect, useRef } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { Check, ChevronDown } from "lucide-react";

interface StatusBarProps {
  orthoEnabled: boolean;
  setOrthoEnabled: (enabled: boolean) => void;
  snapPoint: any;
  mouseClientPos: { x: number; y: number } | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  orthoEnabled,
  setOrthoEnabled,
  snapPoint,
  mouseClientPos,
}) => {
  const snapEnabled = useDrawingStore((state) => state.snapEnabled);
  const setSnapEnabled = useDrawingStore((state) => state.setSnapEnabled);
  const osnapEnabled = useDrawingStore((state) => state.osnapEnabled);
  const setOsnapEnabled = useDrawingStore((state) => state.setOsnapEnabled);
  const snapModes = useDrawingStore((state) => state.snapModes);
  const toggleSnapMode = useDrawingStore((state) => state.toggleSnapMode);
  const gridVisible = useDrawingStore((state) => state.gridVisible);
  const setGridVisible = useDrawingStore((state) => state.setGridVisible);
  const panOffset = useDrawingStore((state) => state.panOffset);
  const zoom = useDrawingStore((state) => state.zoom);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-slate-50 dark:bg-[#0f1419] border-t border-slate-200 dark:border-slate-700 flex items-center px-3 gap-2 z-50 select-none shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
      {/* SNAP master */}
      <button
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="Toggle Grid Snap (F9)"
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all ${
          snapEnabled
            ? "bg-cyan-500 text-white shadow-[0_0_8px_rgba(34,211,238,0.4)]"
            : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        SNAP
      </button>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />

      {/* OSNAP master split button */}
      <div className="relative flex items-center h-5" ref={dropdownRef}>
        <button
          onClick={() => setOsnapEnabled(!osnapEnabled)}
          title="Toggle Object Snap (F3)"
          className={`h-full px-2 rounded-l text-[9px] font-bold tracking-wider transition-all flex items-center justify-center border-r ${
            osnapEnabled
              ? "bg-cyan-500 text-white shadow-[0_0_8px_rgba(34,211,238,0.4)] border-cyan-600/30"
              : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}
        >
          OSNAP
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen(!dropdownOpen);
          }}
          title="Object Snap Settings"
          className={`h-full px-1.5 rounded-r text-[9px] font-bold transition-all flex items-center justify-center ${
            osnapEnabled
              ? "bg-cyan-500 text-white shadow-[0_0_8px_rgba(34,211,238,0.4)]"
              : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Floating checkable menu */}
        {dropdownOpen && (
          <div
            className="absolute bottom-7 left-0 w-56 bg-white dark:bg-[#151b23] border border-slate-200 dark:border-slate-800 shadow-xl rounded-md py-1.5 z-50 pointer-events-auto text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
              Object Snap Modes
            </div>
            {([
              { key: "endpoint",            label: "Endpoint",              icon: "▢", color: "#22c55e" },
              { key: "midpoint",            label: "Midpoint",              icon: "▲", color: "#eab308" },
              { key: "center",              label: "Center",                icon: "○", color: "#ef4444" },
              { key: "geometricCenter",     label: "Geometric Center",      icon: "⊡", color: "#22c55e" },
              { key: "node",                label: "Node",                  icon: "⊙", color: "#eab308" },
              { key: "quadrant",            label: "Quadrant",              icon: "◇", color: "#f97316" },
              { key: "intersection",        label: "Intersection",          icon: "✕", color: "#a855f7" },
              { key: "apparentIntersection",label: "Apparent Intersection", icon: "⊠", color: "#f43f5e" },
              { key: "extension",           label: "Extension",             icon: "⋯", color: "#94a3b8" },
              { key: "perpendicular",       label: "Perpendicular",         icon: "⊾", color: "#818cf8" },
              { key: "tangent",             label: "Tangent",               icon: "⊘", color: "#fb923c" },
              { key: "insertion",           label: "Insertion",             icon: "⧯", color: "#34d399" },
              { key: "nearest",             label: "Nearest",               icon: "⧖", color: "#f97316" },
            ] as const).map(({ key, label, icon, color }) => {
              const active = snapModes[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleSnapMode(key)}
                  className="w-full text-left px-3 py-1 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center font-mono font-bold text-sm" style={{ color }}>
                      {icon}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{label}</span>
                  </div>
                  <div className="w-4 h-4 flex items-center justify-center">
                    {active && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />

      {/* GRID & ORTHO */}
      <button
        onClick={() => setGridVisible(!gridVisible)}
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all ${
          gridVisible
            ? "text-cyan-500 dark:text-cyan-400"
            : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        GRID
      </button>
      <button
        onClick={() => setOrthoEnabled(!orthoEnabled)}
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider transition-all ${
          orthoEnabled
            ? "text-cyan-500 dark:text-cyan-400"
            : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        ORTHO
      </button>

      {/* Snap active indicator */}
      {snapPoint && (
        <>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
          <span className="text-[9px] font-mono text-cyan-400">⊙ {snapPoint.type}</span>
        </>
      )}

      {/* Spacer + coordinates */}
      <div className="flex-1" />
      {mouseClientPos && (
        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600">
          {Math.round((mouseClientPos.x - panOffset.x) / zoom)}, {Math.round((mouseClientPos.y - panOffset.y) / zoom)}
        </span>
      )}
    </div>
  );
};
