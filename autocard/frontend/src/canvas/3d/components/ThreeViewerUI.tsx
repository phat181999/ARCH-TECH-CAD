import { useState } from "react";
import type { ViewAngle, ShapeWithDepth, PerfStats } from "../types";
import { MaterialService } from "../materials/materialService";
import type { RoofType } from "../geometry/RoofGenerator";
import type { Season, Weather, NeighborhoodContext } from "../../../stores/slices/sceneSlice";
import { BimPropertiesPanel } from "./BimPropertiesPanel";
import { BimQuantitiesPanel } from "./BimQuantitiesPanel";
import { ClashPanel } from "./ClashPanel";

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
  onDetectRooms,
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
  onDetectRooms?: () => void;
}) {
  const active = "bg-blue-600 text-white shadow-lg shadow-blue-600/25";
  const idle = "text-slate-400 hover:text-white hover:bg-slate-700";
  const cls = (tool: string) => `p-1.5 rounded-lg transition-all ${activeTool === tool ? active : idle}`;

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-slate-950/70 border border-white/[0.08] p-1.5 rounded-xl shadow-2xl flex flex-col space-y-1 backdrop-blur-sm select-none w-10 items-center">

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

      <button onClick={() => setActiveTool("floor3d")} className={cls("floor3d")} title="Draw Floor Surface — click polygon vertices, DblClick to close">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("rect3d")} className={cls("rect3d")} title="Rectangle — 2 clicks on the ground">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth={2} />
        </svg>
      </button>
      <button onClick={() => setActiveTool("circle3d")} className={cls("circle3d")} title="Circle — center + radius; type radius + Enter for exact">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" strokeWidth={2} />
        </svg>
      </button>
      <button onClick={() => setActiveTool("arc3d")} className={cls("arc3d")} title="Arc — 3 points (start, through, end)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M4 18 A 12 12 0 0 1 20 18" />
        </svg>
      </button>
      <button onClick={() => setActiveTool("box3d")} className={cls("box3d")} title="Box — 2 clicks footprint, then height">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      </button>
      <button onClick={() => setActiveTool("cylinder3d")} className={cls("cylinder3d")} title="Cylinder — center + radius, then height">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <ellipse cx="12" cy="6" rx="7" ry="3" strokeWidth={2} />
          <path strokeWidth={2} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
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

      <div className="w-full border-t border-slate-800 my-1" />

      <button onClick={() => setActiveTool("wall-height")} className={cls("wall-height")} title="Wall height — click a wall to set custom height">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      </button>

      {/* Wall Move — drag a wall perpendicular to itself */}
      <button onClick={() => setActiveTool("wall-move")} className={cls("wall-move")} title="Move Wall — drag to offset perpendicular">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("wall-offset")} className={cls("wall-offset")} title="Offset Wall — click a wall, then distance (or type m + Enter)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={2} d="M6 4v16M14 4v16M18 8l3 4-3 4" />
        </svg>
      </button>

      {/* Place Door — click near a wall */}
      <button onClick={() => setActiveTool("door-place3d")} className={cls("door-place3d")} title="Place Door — click near a wall">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* Place Window — click near a wall */}
      <button onClick={() => setActiveTool("window-place3d")} className={cls("window-place3d")} title="Place Window — click near a wall">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("walk")} className={cls("walk")} title="Walkthrough — WASD + drag to look, Esc to exit">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      <button
        onClick={() => onDetectRooms?.()}
        className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-white hover:bg-emerald-700"
        title="Auto-detect rooms (R)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>
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

/** Thin top status bar for the 3D viewer */
export function ViewerTopBar({
  wallHeight,
  quality,
  showBim,
  hasBim,
  onToggleBim,
  floorPlanActive,
  perfStats,
  heapMB,
}: {
  wallHeight: number;
  quality: "low" | "medium" | "high";
  showBim: boolean;
  hasBim: boolean;
  onToggleBim: () => void;
  floorPlanActive: boolean;
  perfStats?: PerfStats | null;
  heapMB?: number | null;
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 h-9 bg-slate-950/90 backdrop-blur-md border-b border-white/[0.06] flex items-center px-3 gap-3 select-none">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô hình 3D</span>
      <span className="w-px h-4 bg-white/[0.08]" />
      {hasBim && (
        <button
          onClick={onToggleBim}
          className={`px-2.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
            showBim
              ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
          }`}
        >
          {showBim ? "BIM model" : "Show BIM"}
        </button>
      )}
      <span className="text-[9px] text-slate-600">Wall {((wallHeight / 10) * 100).toFixed(0)} cm</span>
      {quality === "low" && (
        <span className="text-[9px] text-amber-400 font-semibold">⚡ Low quality (auto)</span>
      )}
      {floorPlanActive && (
        <span className="text-[9px] text-blue-400 font-semibold">· Region selected</span>
      )}
      {perfStats && (
        <span
          className="ml-auto text-[9px] font-mono text-slate-400 flex items-center gap-2"
          title={perfStats.gpu ?? "GPU name unavailable"}
        >
          <span className={perfStats.fps < 30 ? "text-red-400" : perfStats.fps < 50 ? "text-amber-400" : "text-emerald-400"}>
            {perfStats.fps} fps
          </span>
          <span>{perfStats.frameMs}ms</span>
          <span>{perfStats.drawCalls} calls</span>
          <span>{(perfStats.triangles / 1000).toFixed(0)}k tri</span>
          {heapMB != null && <span>{heapMB}MB</span>}
        </span>
      )}
    </div>
  );
}

/** Unified right sidebar — ViewCube + tabbed Render/Materials/Furniture/Export/Scene panels */
export function RightSidebar({
  viewAngle, setViewAngle,
  explodedView, setExplodedView,
  sectionCut, setSectionCut,
  roofType, setRoofType,
  roofPitch, setRoofPitch,
  facadeMaterial, setFacadeMaterial,
  roofMaterial, setRoofMaterial,
  useTextures, setUseTextures,
  quality, setQuality,
  onExportGLTF, onExportIFC,
  onInsertFurniture,
  season, setSeason,
  weather, setWeather,
  timeOfDay, setTimeOfDay,
  neighborhoodContext, setNeighborhoodContext,
  neighborCount, setNeighborCount,
  undergroundSectionDepth, setUndergroundSectionDepth,
  enableSSAO, setEnableSSAO,
  enablePBRShaders, setEnablePBRShaders,
}: {
  viewAngle: ViewAngle; setViewAngle: (v: ViewAngle) => void;
  explodedView: boolean; setExplodedView: (v: boolean) => void;
  sectionCut: boolean; setSectionCut: (v: boolean) => void;
  roofType: RoofType; setRoofType: (v: RoofType) => void;
  roofPitch: number; setRoofPitch: (v: number) => void;
  facadeMaterial: string; setFacadeMaterial: (v: string) => void;
  roofMaterial: string; setRoofMaterial: (v: string) => void;
  useTextures: boolean; setUseTextures: (v: boolean) => void;
  quality: "low" | "medium" | "high"; setQuality: (v: "low" | "medium" | "high") => void;
  onExportGLTF?: () => void; onExportIFC?: () => void;
  onInsertFurniture: (id: string) => void;
  // Scene props
  season: Season; setSeason: (v: Season) => void;
  weather: Weather; setWeather: (v: Weather) => void;
  timeOfDay: number; setTimeOfDay: (v: number) => void;
  neighborhoodContext: NeighborhoodContext; setNeighborhoodContext: (v: NeighborhoodContext) => void;
  neighborCount: number; setNeighborCount: (v: number) => void;
  undergroundSectionDepth: number; setUndergroundSectionDepth: (v: number) => void;
  // WebGL W1 quality controls
  enableSSAO: boolean; setEnableSSAO: (v: boolean) => void;
  enablePBRShaders: boolean; setEnablePBRShaders: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<"render" | "materials" | "furniture" | "export" | "scene" | "bim" | "clash">("render");
  const [collapsed, setCollapsed] = useState(false);
  const [bimSubTab, setBimSubTab] = useState<"properties" | "quantities">("properties");
  const materials = MaterialService.getPresetList();

  const QUICK_FURNITURE = [
    { id: "sofa", label: "Sofa" }, { id: "armchair", label: "Armchair" },
    { id: "coffee-table", label: "Table" }, { id: "bed", label: "Bed" },
    { id: "bed-single", label: "Bed S" }, { id: "dining-table-rect", label: "Dining" },
    { id: "stove", label: "Stove" }, { id: "toilet", label: "Toilet" },
    { id: "shower", label: "Shower" }, { id: "desk", label: "Desk" },
    { id: "chair", label: "Chair" }, { id: "plant", label: "Plant" },
  ];

  const vcBtn = (v: ViewAngle, label: string) => (
    <button
      onClick={() => setViewAngle(v)}
      className={`flex items-center justify-center text-[9px] font-black rounded transition-all ${
        viewAngle === v
          ? "bg-blue-600 text-white"
          : "bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  if (collapsed) {
    return (
      <div className="absolute right-0 top-9 bottom-0 z-20 w-9 flex flex-col items-center pt-2 gap-2 bg-slate-950/90 border-l border-white/[0.06] backdrop-blur-md select-none">
        <button onClick={() => setCollapsed(false)} className="text-slate-500 hover:text-slate-200 text-xs p-1" title="Expand panel">▶</button>
        {(["render", "materials", "furniture", "export", "scene", "bim", "clash"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setCollapsed(false); }}
            className={`w-7 h-7 rounded flex items-center justify-center text-[8px] font-black uppercase transition-all ${tab === t ? "bg-blue-600/30 text-blue-400" : "text-slate-600 hover:text-slate-300"}`}
            title={t}
          >
            {t[0].toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-9 bottom-0 z-20 w-56 flex flex-col bg-slate-950/90 border-l border-white/[0.06] backdrop-blur-md select-none">
      {/* View Cube */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">View Cube</span>
          <button onClick={() => setCollapsed(true)} className="text-slate-600 hover:text-slate-300 text-[10px]" title="Collapse">◀</button>
        </div>
        <div className="grid grid-cols-3 gap-1 h-16">
          <div />{vcBtn("front", "F")}<div />
          {vcBtn("left", "L")}
          <button onClick={() => setViewAngle("top")} className={`flex items-center justify-center text-[9px] font-black rounded transition-all ${viewAngle === "top" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10"}`}>TOP</button>
          {vcBtn("right", "R")}
          <div />{vcBtn("back", "B")}<div />
        </div>
        <button onClick={() => setViewAngle("perspective")} className={`mt-1 w-full py-1 rounded text-[9px] font-bold transition-colors ${viewAngle === "perspective" ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"}`}>ISO</button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0 flex-wrap">
        {(["render", "materials", "furniture", "export", "scene", "bim", "clash"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-wide transition-all border-b-2 ${
              tab === t
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-600 hover:text-slate-400"
            }`}
          >
            {t === "render" ? "Render" : t === "materials" ? "Mat." : t === "furniture" ? "Furn." : t === "export" ? "Export" : t === "scene" ? "Scene" : t === "bim" ? "BIM" : "Clash"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.12) transparent" }}>

        {tab === "render" && (
          <>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quality</p>
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map(q => (
                  <button key={q} onClick={() => setQuality(q)}
                    className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all ${quality === q
                      ? q === "low" ? "bg-amber-500/20 border-amber-500/60 text-amber-400"
                        : q === "medium" ? "bg-blue-500/20 border-blue-500/60 text-blue-400"
                        : "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                      : "border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-400"}`}
                  >
                    {q === "low" ? "Thấp" : q === "medium" ? "Vừa" : "Cao"}
                  </button>
                ))}
              </div>
              {quality === "low" && <p className="text-[8px] text-amber-400/70 mt-1">Auto-downgraded — low FPS detected</p>}
            </div>
            <div className="space-y-2 pt-1 border-t border-white/[0.06]">
              {([
                ["PBR textures", useTextures, setUseTextures],
                ["Exploded view", explodedView, setExplodedView],
                ["Section cut", sectionCut, setSectionCut],
                ["SSAO (ambient occlusion)", enableSSAO, setEnableSSAO],
                ["PBR shaders (triplanar)", enablePBRShaders, setEnablePBRShaders],
              ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
                <label key={label} className="flex items-center justify-between cursor-pointer">
                  <span className="text-[10px] text-slate-400">{label}</span>
                  <div onClick={() => set(!val)}
                    className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${val ? "bg-blue-600" : "bg-slate-700"}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${val ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </label>
              ))}
              {enableSSAO && quality === "low" && (
                <p className="text-[8px] text-amber-400/70">SSAO disabled in low quality mode</p>
              )}
            </div>
            <div className="pt-1 border-t border-white/[0.06]">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Roof</p>
              <div className="flex gap-1 flex-wrap mb-2">
                {(["flat", "gable", "hip", "shed"] as RoofType[]).map(r => (
                  <button key={r} onClick={() => setRoofType(r)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all capitalize ${roofType === r ? "bg-blue-500/20 border-blue-500/60 text-blue-400" : "border-white/10 text-slate-600 hover:text-slate-400"}`}
                  >{r}</button>
                ))}
              </div>
              {roofType !== "flat" && (
                <div>
                  <div className="flex justify-between text-[9px] text-slate-500 mb-1">
                    <span>Pitch</span><span className="text-blue-400 font-bold">{roofPitch}°</span>
                  </div>
                  <input type="range" min={10} max={60} value={roofPitch}
                    onChange={e => setRoofPitch(Number(e.target.value))}
                    className="w-full accent-blue-600 h-1 rounded" />
                </div>
              )}
            </div>
          </>
        )}

        {tab === "materials" && (
          <>
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Wall facade</p>
              <div className="flex flex-wrap gap-1.5">
                {materials.map(mat => (
                  <button key={mat.id} onClick={() => setFacadeMaterial(mat.id)}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${facadeMaterial === mat.id ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: mat.color }} title={mat.label}
                  />
                ))}
              </div>
            </div>
            {roofType !== "flat" && (
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Roofing</p>
                <div className="flex flex-wrap gap-1.5">
                  {materials.map(mat => (
                    <button key={mat.id} onClick={() => setRoofMaterial(mat.id)}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${roofMaterial === mat.id ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: mat.color }} title={mat.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "furniture" && (
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_FURNITURE.map(item => (
              <button key={item.id} onClick={() => onInsertFurniture(item.id)}
                className="flex flex-col items-center justify-center rounded-lg border border-white/10 py-2 px-1 transition-all bg-white/4 hover:bg-blue-500/15 hover:border-blue-500/40 text-white"
              >
                <span className="text-[9px] font-semibold text-slate-300 text-center leading-tight">{item.label}</span>
              </button>
            ))}
            <p className="col-span-3 text-[8px] text-slate-600 text-center">Click to place at floor center</p>
          </div>
        )}

        {tab === "export" && (
          <div className="space-y-2">
            {onExportGLTF && (
              <button onClick={onExportGLTF}
                className="w-full py-2 rounded text-[10px] font-bold bg-violet-500/15 border border-violet-500/40 text-violet-400 hover:bg-violet-500/25 transition-all">
                ⬇ Export GLTF 2.0
              </button>
            )}
            {onExportIFC && (
              <button onClick={onExportIFC}
                className="w-full py-2 rounded text-[10px] font-bold bg-sky-500/15 border border-sky-500/40 text-sky-400 hover:bg-sky-500/25 transition-all">
                ⬇ Export IFC 2x3
              </button>
            )}
            <p className="text-[8px] text-slate-600 leading-relaxed">GLTF: opens in Blender, Sketchfab, AR viewers. IFC: opens in Revit, BIM viewers.</p>
          </div>
        )}

        {tab === "clash" && (
          <div className="flex flex-col h-full -m-3">
            <ClashPanel
              onHighlight={(ids) => {
                console.log("Highlight clash elements:", ids);
              }}
            />
          </div>
        )}

        {tab === "bim" && (
          <div className="flex flex-col h-full -m-3">
            {/* Sub-tab switcher */}
            <div className="flex border-b border-slate-700 shrink-0">
              {(["properties", "quantities"] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setBimSubTab(sub)}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    bimSubTab === sub
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {sub === "properties" ? "Properties" : "Quantities"}
                </button>
              ))}
            </div>
            {bimSubTab === "properties" && <BimPropertiesPanel />}
            {bimSubTab === "quantities" && <BimQuantitiesPanel />}
          </div>
        )}

        {tab === "scene" && (
          <div className="flex flex-col space-y-3">

            {/* Season */}
            <div className="flex flex-col space-y-1.5">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Season</span>
              <div className="grid grid-cols-2 gap-1">
                {(["spring","summer","autumn","winter"] as Season[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={`py-1 rounded text-[10px] font-semibold transition-all border ${
                      season === s
                        ? "bg-emerald-600/30 border-emerald-500/60 text-emerald-300"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {s === "spring" ? "🌸 Xuân" : s === "summer" ? "☀ Hè" : s === "autumn" ? "🍂 Thu" : "❄ Đông"}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather */}
            <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Weather</span>
              <div className="grid grid-cols-3 gap-1">
                {([
                  ["sunny","☀","Nắng"],["overcast","☁","Âm u"],["rainy","🌧","Mưa"],
                  ["stormy","⛈","Bão"],["foggy","🌫","Sương"],["snowy","❄","Tuyết"],
                ] as [Weather, string, string][]).map(([w, icon, label]) => (
                  <button
                    key={w}
                    onClick={() => setWeather(w)}
                    className={`py-1 rounded text-[10px] font-semibold transition-all border ${
                      weather === w
                        ? "bg-sky-600/30 border-sky-500/60 text-sky-300"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time of day */}
            <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Giờ trong ngày</span>
                <span className="text-[10px] font-mono font-bold text-amber-400">
                  {String(Math.floor(timeOfDay)).padStart(2,"0")}:{String(Math.round((timeOfDay % 1) * 60)).padStart(2,"0")}
                </span>
              </div>
              <input
                type="range" min={0} max={24} step={0.25} value={timeOfDay}
                onChange={(e) => setTimeOfDay(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
              />
            </div>

            {/* Neighborhood */}
            <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Khu vực</span>
              <div className="grid grid-cols-2 gap-1">
                {(["none","suburban","urban","highrise"] as NeighborhoodContext[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setNeighborhoodContext(c)}
                    className={`py-1 rounded text-[10px] font-semibold transition-all border ${
                      neighborhoodContext === c
                        ? "bg-violet-600/30 border-violet-500/60 text-violet-300"
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {c === "none" ? "Không" : c === "suburban" ? "Ngoại ô" : c === "urban" ? "Đô thị" : "Cao tầng"}
                  </button>
                ))}
              </div>
              {neighborhoodContext !== "none" && (
                <div className="flex flex-col space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <label className="font-medium">Số nhà lân cận</label>
                    <span className="font-mono font-bold text-violet-400">{neighborCount}</span>
                  </div>
                  <input
                    type="range" min={0} max={6} step={1} value={neighborCount}
                    onChange={(e) => setNeighborCount(Number(e.target.value))}
                    className="w-full accent-violet-600 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Underground section */}
            <div className="flex flex-col space-y-1.5 border-t border-slate-200 dark:border-slate-800 pt-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cắt nền móng</span>
                <span className="text-[10px] font-mono font-bold text-amber-600">
                  {undergroundSectionDepth === 0 ? "Tắt" : `-${undergroundSectionDepth} cm`}
                </span>
              </div>
              <input
                type="range" min={0} max={600} step={10} value={undergroundSectionDepth}
                onChange={(e) => setUndergroundSectionDepth(Number(e.target.value))}
                className="w-full accent-amber-700 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export function WallHeightPanel({ wallId, currentHeight, onApply, onCancel }: {
  wallId: string; currentHeight: number;
  onApply: (wallId: string, height: number) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState(String(Math.round(currentHeight)));
  return (
    <div className="absolute left-1/2 bottom-20 -translate-x-1/2 z-30 bg-slate-900/95 border border-slate-700/60 rounded-xl px-5 py-3 flex items-center gap-3 backdrop-blur-md shadow-2xl select-none">
      <span className="text-slate-300 text-sm font-medium">Wall height</span>
      <input type="number" value={val} onChange={e => setVal(e.target.value)}
        className="w-20 bg-slate-800 border border-slate-600 text-white text-sm px-2 py-1 rounded focus:outline-none focus:border-blue-500"
        autoFocus min={10} max={5000} step={10} onKeyDown={e => { if(e.key==="Enter") onApply(wallId, Number(val)); if(e.key==="Escape") onCancel(); }}
      />
      <span className="text-slate-500 text-xs">cm</span>
      <button onClick={() => onApply(wallId, Number(val))} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors">Apply</button>
      <button onClick={onCancel} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors">Cancel</button>
    </div>
  );
}
