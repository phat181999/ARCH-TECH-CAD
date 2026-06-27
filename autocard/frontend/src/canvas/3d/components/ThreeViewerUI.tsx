import { useState } from "react";
import type { ViewAngle } from "../types";
import type { ShapeWithDepth } from "../types";
import { MaterialService } from "../materials/materialService";

/** Left toolbar with tool buttons for the 3D viewer. */
export function ThreeToolbar({
  activeTool,
  setActiveTool,
  onLineClick,
  onShow2DNotice: _onShow2DNotice,
  onShowInteractionNotice: _onShowInteractionNotice,
  hasRegion,
  onResetRegion,
  onAnalyze,
  analyzeStatus,
}: {
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onLineClick: () => void;
  onShow2DNotice: (name: string) => void;
  onShowInteractionNotice: (name: string) => void;
  hasRegion?: boolean;
  onResetRegion?: () => void;
  onAnalyze?: () => void;
  analyzeStatus?: "idle" | "pending" | "running" | "done" | "error";
}) {
  const active = "bg-blue-600 text-white shadow-lg shadow-blue-600/25";
  const idle = "text-slate-400 hover:text-white hover:bg-slate-700";
  const cls = (tool: string) => `p-1.5 rounded-lg transition-all ${activeTool === tool ? active : idle}`;

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-slate-900/95 border border-slate-700/60 p-1.5 rounded-xl shadow-2xl flex flex-col space-y-1 backdrop-blur-md select-none w-10 items-center">

      {/* Selection / Deletion */}
      <button onClick={() => setActiveTool("select")} className={cls("select")} title="Select (V)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l7 14 3-5 5 3-4-15z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("eraser")} className={cls("eraser")} title="Eraser — click element to delete (E)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      {/* Structure */}
      <button onClick={() => setActiveTool("wall3d")} className={cls("wall3d")} title="Wall (W) — click-click to draw walls; Esc to end, double-click to break the chain">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21V5a1 1 0 011-1h14a1 1 0 011 1v16M4 9h16M4 15h16M9 9v6m6-6v6" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      {/* Drawing */}
      <button onClick={onLineClick} className={cls("line")} title="Draw on Face — click a wall/floor surface to draw">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("pushpull")} className={cls("pushpull")} title="Push/Pull — drag a face to extrude (P)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5 5 5M7 13l5 5 5-5" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      {/* Camera navigation */}
      <button onClick={() => setActiveTool("orbit")} className={cls("orbit")} title="Orbit — drag to rotate camera (O)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("pan")} className={cls("pan")} title="Pan — drag to move camera (H)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a2 2 0 114 0v4m0 0V9a2 2 0 114 0v2m0 0V7a2 2 0 114 0v2m-12 0a3 3 0 01-3-3V7a3 3 0 016 0v4" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("zoom")} className={cls("zoom")} title="Zoom — scroll or drag to zoom (Z)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      <button onClick={() => setActiveTool("measure")} className={cls("measure")} title="Tape Measure — click two points to measure">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9h4m-6 4h6m-11 4h16V7H5v10z" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      <button
        onClick={() => setActiveTool("floor-pick")}
        className={cls("floor-pick")}
        title="Pick Floor Plan Region — drag to select which drawing to view in 3D"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
        </svg>
      </button>

      {hasRegion && (
        <button
          onClick={onResetRegion}
          className="p-1.5 rounded-lg transition-all text-amber-400 hover:text-white hover:bg-amber-700"
          title="Reset region — show all elements in 3D"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {onAnalyze && (
        <>
          <div className="w-full border-t border-slate-800 my-1" />
          <button
            onClick={onAnalyze}
            disabled={analyzeStatus === "pending" || analyzeStatus === "running"}
            title={analyzeStatus === "done" ? "Re-analyze 2D drawing → BIM 3D model" : "Analyze 2D drawing → BIM 3D model"}
            className="p-1.5 rounded-lg transition-all text-violet-400 hover:text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {analyzeStatus === "pending" || analyzeStatus === "running" ? (
              <span className="block w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  );
}

/** Top-right View Cube compass widget. */
export function ViewCube({
  viewAngle,
  setViewAngle,
}: {
  viewAngle: ViewAngle;
  setViewAngle: (v: ViewAngle) => void;
}) {
  const btn = (v: ViewAngle, label: string, pos: string, title: string) => (
    <button
      onClick={() => setViewAngle(v)}
      className={`${pos} w-7 h-7 rounded flex items-center justify-center text-[10px] font-extrabold border transition-all ${
        viewAngle === v
          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30"
          : "bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-500/40 hover:text-blue-500"
      }`}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute right-4 top-20 z-20 flex flex-col items-center p-3 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md rounded-xl border border-white/60 dark:border-slate-800 shadow-lg space-y-2 select-none">
      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">View Cube</span>
      <div className="relative w-24 h-24 flex items-center justify-center">
        {btn("front", "F", "absolute top-0", "Front View")}
        {btn("left", "L", "absolute left-0", "Left View")}
        <button
          onClick={() => setViewAngle("top")}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border transition-all ${
            viewAngle === "top"
              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30"
              : "bg-white/90 dark:bg-slate-950/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500/40 hover:text-blue-500"
          }`}
          title="Top (Plan) View"
        >
          TOP
        </button>
        {btn("right", "R", "absolute right-0", "Right View")}
        {btn("back", "B", "absolute bottom-0", "Back View")}
      </div>
      <button
        onClick={() => setViewAngle("perspective")}
        className={`w-full py-1 rounded text-[9px] font-bold border transition-colors ${
          viewAngle === "perspective"
            ? "bg-blue-600 border-blue-500 text-white"
            : "bg-white/80 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-500/40 hover:text-blue-500"
        }`}
        title="Default 3D ISO View"
      >
        3D ISO
      </button>
    </div>
  );
}

/** Bottom panel shown when Push/Pull tool is active. */
export function PushPullPanel({
  shapes,
  wallHeight,
  setWallHeight,
  onDepthChange,
  formatLength,
}: {
  shapes: ShapeWithDepth[];
  wallHeight: number;
  setWallHeight: (h: number) => void;
  onDepthChange: (id: string, depth: number) => void;
  formatLength: (n: number) => string;
}) {
  const last = shapes.length > 0 ? shapes[shapes.length - 1] : null;
  return (
    <div className="absolute left-1/2 transform -translate-x-1/2 bottom-8 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-4 rounded-xl shadow-2xl flex items-center space-x-4 select-none min-w-[340px]">
      <div className="flex flex-col flex-1 space-y-3">
        {last && (
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
                Push/Pull — drag face or use slider
              </span>
              <span className="text-xs font-bold text-blue-400">{formatLength(last.depth / 100)}</span>
            </div>
            <input
              type="range"
              min={-200}
              max={200}
              value={last.depth}
              onChange={(e) => onDepthChange(last.id, Number(e.target.value))}
              className="w-full accent-blue-600 bg-slate-700 rounded-lg appearance-none h-1 cursor-pointer"
            />
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Wall Height</span>
          <span className="text-xs font-bold text-blue-400">{formatLength(wallHeight / 10)}</span>
        </div>
        <input
          type="range"
          min={10}
          max={120}
          value={wallHeight}
          onChange={(e) => setWallHeight(Number(e.target.value))}
          className="w-full accent-blue-600 bg-slate-700 rounded-lg appearance-none h-1 cursor-pointer"
        />
      </div>
    </div>
  );
}

// Common furniture items for the quick-insert panel
const QUICK_FURNITURE: { id: string; label: string; color: string }[] = [
  { id: "sofa",               label: "Sofa",       color: "bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30" },
  { id: "armchair",           label: "Armchair",   color: "bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30" },
  { id: "coffee-table",       label: "Table",      color: "bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/30" },
  { id: "bed",                label: "Bed",        color: "bg-purple-600/20 hover:bg-purple-600/40 border-purple-500/30" },
  { id: "bed-single",         label: "Bed S",      color: "bg-purple-600/20 hover:bg-purple-600/40 border-purple-500/30" },
  { id: "dining-table-rect",  label: "Dining",     color: "bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/30" },
  { id: "stove",              label: "Stove",      color: "bg-orange-600/20 hover:bg-orange-600/40 border-orange-500/30" },
  { id: "toilet",             label: "Toilet",     color: "bg-slate-400/20 hover:bg-slate-400/40 border-slate-400/30" },
  { id: "shower",             label: "Shower",     color: "bg-slate-400/20 hover:bg-slate-400/40 border-slate-400/30" },
  { id: "desk",               label: "Desk",       color: "bg-green-600/20 hover:bg-green-600/40 border-green-500/30" },
  { id: "chair",              label: "Chair",      color: "bg-green-600/20 hover:bg-green-600/40 border-green-500/30" },
  { id: "plant",              label: "Plant",      color: "bg-emerald-600/20 hover:bg-emerald-600/40 border-emerald-500/30" },
];

/** Bottom-right quick-insert panel for placing furniture directly in 3D. */
export function FurnitureQuickPanel({ onInsert }: { onInsert: (id: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute bottom-4 right-4 z-20 select-none">
      {open ? (
        <div className="bg-slate-900/95 border border-slate-700/60 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden w-[248px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Furniture</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 text-xs leading-none p-0.5"
              title="Collapse"
            >✕</button>
          </div>
          <div className="p-2 grid grid-cols-4 gap-1.5">
            {QUICK_FURNITURE.map((item) => (
              <button
                key={item.id}
                onClick={() => onInsert(item.id)}
                className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1 transition-all ${item.color} text-white`}
                title={`Insert ${item.label}`}
              >
                <span className="text-[9px] font-semibold text-slate-200 text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[9px] text-slate-500 text-center pb-2">Click to place at floor center</p>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-slate-900/95 border border-slate-700/60 backdrop-blur-md rounded-xl shadow-2xl px-3 py-2 text-[10px] font-bold text-slate-300 hover:text-white hover:border-blue-500/50 transition-all"
          title="Show furniture panel"
        >
          + Furniture
        </button>
      )}
    </div>
  );
}

/** Floating BIM styling panel for materials, roofs, explosion and section cuts. */
export function BimStylingPanel({
  explodedView,
  setExplodedView,
  sectionCut,
  setSectionCut,
  roofType,
  setRoofType,
  roofPitch,
  setRoofPitch,
  facadeMaterial,
  setFacadeMaterial,
  roofMaterial,
  setRoofMaterial,
  useTextures,
  setUseTextures,
  quality,
  setQuality,
  onExportGLTF,
  onExportIFC,
}: {
  explodedView: boolean;
  setExplodedView: (v: boolean) => void;
  sectionCut: boolean;
  setSectionCut: (v: boolean) => void;
  roofType: string;
  setRoofType: (v: any) => void;
  roofPitch: number;
  setRoofPitch: (v: number) => void;
  facadeMaterial: string;
  setFacadeMaterial: (v: string) => void;
  roofMaterial: string;
  setRoofMaterial: (v: string) => void;
  useTextures: boolean;
  setUseTextures: (v: boolean) => void;
  quality: "low" | "medium" | "high";
  setQuality: (v: "low" | "medium" | "high") => void;
  onExportGLTF?: () => void;
  onExportIFC?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const materials = MaterialService.getPresetList();

  const qualityOptions: { id: "low" | "medium" | "high"; label: string }[] = [
    { id: "low",    label: "Thấp" },
    { id: "medium", label: "Vừa" },
    { id: "high",   label: "Cao" },
  ];

  if (!open) {
    return (
      <div className="absolute right-4 z-20 select-none" style={{ top: "320px" }}>
        <button
          onClick={() => setOpen(true)}
          className="bg-slate-900/95 border border-slate-700/60 backdrop-blur-md rounded-xl shadow-2xl px-3 py-2 text-[10px] font-bold text-slate-300 hover:text-white hover:border-blue-500/50 transition-all"
          title="Show visual controls"
        >
          ⚙ Visual
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-4 z-20 flex flex-col bg-white/75 dark:bg-slate-900/75 backdrop-blur-md rounded-xl border border-white/60 dark:border-slate-800 shadow-2xl select-none w-56" style={{ top: "320px", maxHeight: "calc(100vh - 340px)" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          3D Visual Controls
        </span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200 text-xs leading-none p-0.5" title="Collapse">✕</button>
      </div>
      <div className="overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: "thin" }}>

      {/* Toggles */}
      <div className="flex flex-col space-y-2">
        <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Exploded Levels</span>
          <input
            type="checkbox"
            checked={explodedView}
            onChange={(e) => setExplodedView(e.target.checked)}
            className="rounded text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Section Cut</span>
          <input
            type="checkbox"
            checked={sectionCut}
            onChange={(e) => setSectionCut(e.target.checked)}
            className="rounded text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Chất liệu thực (PBR)</span>
          <input
            type="checkbox"
            checked={useTextures}
            onChange={(e) => setUseTextures(e.target.checked)}
            className="rounded text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 h-4 w-4"
          />
        </label>
      </div>

      {/* Quality Selector */}
      <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Chất lượng đồ hoạ
          </span>
          {quality === "low" && (
            <span className="text-[8px] text-amber-400 font-semibold">Auto ↓</span>
          )}
        </div>
        <div className="flex gap-1">
          {qualityOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setQuality(opt.id)}
              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                quality === opt.id
                  ? opt.id === "low"
                    ? "bg-amber-500/20 border-amber-500/60 text-amber-400"
                    : opt.id === "medium"
                    ? "bg-blue-500/20 border-blue-500/60 text-blue-400"
                    : "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[8px] text-slate-400 dark:text-slate-500 leading-tight">
          {quality === "low"  && "Tắt Bloom & Vignette, tối ưu GPU yếu"}
          {quality === "medium" && "Vignette nhẹ, Bloom giảm"}
          {quality === "high" && "Bloom + Vignette đầy đủ"}
        </p>
      </div>

      {/* 3D Export */}
      {onExportGLTF && (
        <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Xuất 3D Model
          </span>
          <button
            onClick={onExportGLTF}
            className="w-full py-1.5 rounded text-[10px] font-bold bg-violet-500/15 border border-violet-500/40 text-violet-400 hover:bg-violet-500/25 transition-all"
          >
            ⬇ Xuất GLTF
          </button>
          {onExportIFC && (
            <button
              onClick={onExportIFC}
              className="w-full py-1.5 rounded text-[10px] font-bold bg-sky-500/15 border border-sky-500/40 text-sky-400 hover:bg-sky-500/25 transition-all"
            >
              ⬇ Xuất IFC 2x3
            </button>
          )}
        </div>
      )}

      {/* Roof Config */}
      <div className="flex flex-col space-y-2 border-t border-slate-200 dark:border-slate-800 pt-2.5">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Roof Generator
        </span>

        <div className="flex flex-col space-y-1">
          <label className="text-[10px] text-slate-500 font-medium">Type</label>
          <select
            value={roofType}
            onChange={(e) => setRoofType(e.target.value as any)}
            className="bg-white/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-1 rounded outline-none focus:border-blue-500"
          >
            <option value="flat">Flat Roof</option>
            <option value="gable">Gable Roof</option>
            <option value="hip">Hip Roof</option>
            <option value="shed">Shed Roof</option>
          </select>
        </div>

        {roofType !== "flat" && (
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <label className="font-medium">Pitch Angle</label>
              <span className="font-mono font-bold text-blue-500">{roofPitch}°</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              value={roofPitch}
              onChange={(e) => setRoofPitch(Number(e.target.value))}
              className="w-full accent-blue-600 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Materials Config */}
      <div className="flex flex-col space-y-2 border-t border-slate-200 dark:border-slate-800 pt-2.5">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Materials Palette
        </span>

        {/* Facade Mat */}
        <div className="flex flex-col space-y-1">
          <label className="text-[10px] text-slate-500 font-medium">Wall Facade</label>
          <div className="grid grid-cols-4 gap-1">
            {materials.map((mat) => (
              <button
                key={`facade-${mat.id}`}
                onClick={() => setFacadeMaterial(mat.id)}
                className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                  facadeMaterial === mat.id
                    ? "border-blue-600 scale-110 shadow-md"
                    : "border-slate-200 dark:border-slate-800 hover:scale-105"
                }`}
                style={{ backgroundColor: mat.color }}
                title={mat.label}
              />
            ))}
          </div>
        </div>

        {/* Roof Mat */}
        {roofType !== "flat" && (
          <div className="flex flex-col space-y-1 pt-1">
            <label className="text-[10px] text-slate-500 font-medium">Roofing</label>
            <div className="grid grid-cols-4 gap-1">
              {materials.map((mat) => (
                <button
                  key={`roof-${mat.id}`}
                  onClick={() => setRoofMaterial(mat.id)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                    roofMaterial === mat.id
                      ? "border-blue-600 scale-110 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:scale-105"
                  }`}
                  style={{ backgroundColor: mat.color }}
                  title={mat.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
