import type { ViewAngle } from "../types";
import type { ShapeWithDepth } from "../types";

/** Left toolbar with tool buttons for the 3D viewer. */
export function ThreeToolbar({
  activeTool,
  setActiveTool,
  onLineClick,
  onShow2DNotice,
  onShowInteractionNotice,
}: {
  activeTool: string;
  setActiveTool: (tool: string) => void;
  onLineClick: () => void;
  onShow2DNotice: (name: string) => void;
  onShowInteractionNotice: (name: string) => void;
}) {
  const active = "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25";
  const idle = "text-slate-400 hover:text-white hover:bg-slate-800";
  const cls = (tool: string) => `p-1.5 rounded-lg transition-all ${activeTool === tool ? active : idle}`;
  const disabled = "p-1.5 rounded-lg text-slate-500 hover:text-slate-400 hover:bg-slate-800";

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-slate-900/95 border border-slate-700/60 p-1.5 rounded-xl shadow-2xl flex flex-col space-y-1 backdrop-blur-md select-none w-10 items-center">
      <button onClick={() => setActiveTool("select")} className={cls("select")} title="Select (V)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l7 14 3-5 5 3-4-15z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("eraser")} className={cls("eraser")} title="Eraser (E)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      <button onClick={onLineClick} className={cls("line")} title="✏ Draw on Face">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      <button onClick={() => onShow2DNotice("Arc")} className={disabled} title="Arc (2D Drawing Tool)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10a8 8 0 018-8v2a6 6 0 00-6 6H4z" />
        </svg>
      </button>

      <button onClick={() => onShow2DNotice("Offset")} className={disabled} title="Offset (2D drawing tool)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M3 12h18" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      <button onClick={() => setActiveTool("pushpull")} className={cls("pushpull")} title="Push/Pull (P)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5 5 5M7 13l5 5 5-5" />
        </svg>
      </button>

      <button onClick={() => onShowInteractionNotice("Move")} className={disabled} title="Move geometry">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4 4 4m0 10l-4 4-4-4m10-6l4-4-4-4M7 8l-4 4 4 4" />
        </svg>
      </button>

      <button onClick={() => onShowInteractionNotice("Rotate")} className={disabled} title="Rotate geometry">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L9 17" />
        </svg>
      </button>

      <button onClick={() => onShowInteractionNotice("Scale")} className={disabled} title="Scale geometry">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm16 0v6h-6v-2h4v-4h2z" />
        </svg>
      </button>

      <div className="w-full border-t border-slate-800 my-1" />

      <button onClick={() => setActiveTool("orbit")} className={cls("orbit")} title="Orbit Camera (O)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("pan")} className={cls("pan")} title="Pan Camera (H)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a2 2 0 114 0v4m0 0V9a2 2 0 114 0v2m0 0V7a2 2 0 114 0v2m-12 0a3 3 0 01-3-3V7a3 3 0 016 0v4" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("zoom")} className={cls("zoom")} title="Zoom Camera (Z)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      <button onClick={() => setActiveTool("measure")} className={cls("measure")} title="Tape Measure Tool">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9h4m-6 4h6m-11 4h16V7H5v10z" />
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
          ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
          : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
      }`}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute right-4 top-4 z-20 flex flex-col items-center p-3 bg-white/75 dark:bg-[#151B23]/75 backdrop-blur-md rounded-xl border border-white/60 dark:border-[#1E293B] shadow-lg space-y-2 select-none">
      <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">View Cube</span>
      <div className="relative w-24 h-24 flex items-center justify-center">
        {btn("front", "F", "absolute top-0", "Front View")}
        {btn("left", "L", "absolute left-0", "Left View")}
        <button
          onClick={() => setViewAngle("top")}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black border transition-all ${
            viewAngle === "top"
              ? "bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/30"
              : "bg-white/90 dark:bg-[#0B0E14]/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
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
            ? "bg-cyan-500 border-cyan-400 text-white"
            : "bg-white/80 dark:bg-[#0B0E14]/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
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
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5 animate-pulse" />
                Push/Pull — drag face or use slider
              </span>
              <span className="text-xs font-bold text-cyan-400">{formatLength(last.depth / 100)}</span>
            </div>
            <input
              type="range"
              min={-200}
              max={200}
              value={last.depth}
              onChange={(e) => onDepthChange(last.id, Number(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-700 rounded-lg appearance-none h-1 cursor-pointer"
            />
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Wall Height</span>
          <span className="text-xs font-bold text-cyan-400">{formatLength(wallHeight / 10)}</span>
        </div>
        <input
          type="range"
          min={10}
          max={120}
          value={wallHeight}
          onChange={(e) => setWallHeight(Number(e.target.value))}
          className="w-full accent-cyan-500 bg-slate-700 rounded-lg appearance-none h-1 cursor-pointer"
        />
      </div>
    </div>
  );
}
