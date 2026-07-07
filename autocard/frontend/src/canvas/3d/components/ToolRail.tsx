// Icon-rail toolbar (house_planner_demo_2 pattern): slim rail of icon buttons
// with hover tooltips; grouped tools open a flyout beside the rail; the
// group button stays highlighted while one of its tools is active. Pure
// presentation over the same activeTool/setActiveTool contract as the old
// ThreeToolbar.
import { useEffect, useState } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";

interface RailTool { id: string; label: string; icon: React.ReactNode }
interface RailGroup { id: string; label: string; icon: React.ReactNode; tools: RailTool[] }

const ICONS: Record<string, React.ReactNode> = {
  select: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l7 14 3-5 5 3-4-15z" />
    </svg>
  ),
  eraser: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  undo: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v1M3 10l5-5M3 10l5 5" />
    </svg>
  ),
  redo: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v1M21 10l-5-5M21 10l-5 5" />
    </svg>
  ),
  wall3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21V5a1 1 0 011-1h14a1 1 0 011 1v16M4 9h16M4 15h16M9 9v6m6-6v6" />
    </svg>
  ),
  floor3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  rect3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="6" width="16" height="12" rx="1" strokeWidth={2} />
    </svg>
  ),
  circle3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
    </svg>
  ),
  arc3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth={2} d="M4 18 A 12 12 0 0 1 20 18" />
    </svg>
  ),
  box3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  ),
  cylinder3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <ellipse cx="12" cy="6" rx="7" ry="3" strokeWidth={2} />
      <path strokeWidth={2} d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    </svg>
  ),
  "roof-ridge": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-8 9 8M7 12v8h10v-8" />
      <path strokeLinecap="round" strokeWidth={2} strokeDasharray="2 2" d="M6 8.5h12" />
    </svg>
  ),
  line: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  pushpull: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5 5 5M7 13l5 5 5-5" />
    </svg>
  ),
  "wall-move": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  "wall-offset": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth={2} d="M6 4v16M14 4v16M18 8l3 4-3 4" />
    </svg>
  ),
  "wall-height": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
    </svg>
  ),
  "door-place3d": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  "window-place3d": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  paint3d: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l6-6 4 4 6-6M4 16v4h16v-4M9 3l6 6" />
    </svg>
  ),
  "mep-water": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c3.5 4.5 6 7.8 6 11a6 6 0 11-12 0c0-3.2 2.5-6.5 6-11z" />
    </svg>
  ),
  "mep-drain": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M8 6v6a4 4 0 004 4h0a4 4 0 004-4V6M12 16v5m0 0l-3-3m3 3l3-3" />
    </svg>
  ),
  "mep-electric": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  "mep-hvac": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 9.5C12 6 14 4 17 4c0 3-2 5.5-5 5.5zM14.5 12c3.5 0 5.5 2 5.5 5-3 0-5.5-2-5.5-5zM12 14.5c0 3.5-2 5.5-5 5.5 0-3 2-5.5 5-5.5zM9.5 12C6 12 4 10 4 7c3 0 5.5 2 5.5 5z" />
    </svg>
  ),
  "mep-gas": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c1 3-3 4.5-3 8a3 3 0 006 0c0-1.5-.8-2.6-1.5-3.5C15.5 8.5 18 10.5 18 14a6 6 0 11-12 0c0-5 4.5-7 6-11z" />
    </svg>
  ),
  "mep-fixture": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth={2} />
      <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
    </svg>
  ),
  orbit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 21a9 9 0 100-18 9 9 0 000 18z" />
    </svg>
  ),
  pan: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a2 2 0 114 0v4m0 0V9a2 2 0 114 0v2m0 0V7a2 2 0 114 0v2m-12 0a3 3 0 01-3-3V7a3 3 0 016 0v4" />
    </svg>
  ),
  zoom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  walk: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  "walk-avatar": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM10 7l-1.5 4 2 1.5-.5 5m3-9.5l1.5 3.5-2 2 2.5 4.5M8 12l-2.5 1.5" />
    </svg>
  ),
  measure: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9h4m-6 4h6m-11 4h16V7H5v10z" />
    </svg>
  ),
  "floor-pick": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
    </svg>
  ),
};

export const TOOL_LABELS: Record<string, string> = {
  select: "Chọn (V)", eraser: "Tẩy — click để xoá (E)",
  wall3d: "Vẽ tường (W)", floor3d: "Vẽ sàn", rect3d: "Chữ nhật", circle3d: "Hình tròn",
  arc3d: "Cung tròn", box3d: "Hộp 3D", cylinder3d: "Trụ 3D", "roof-ridge": "Vẽ đường nóc mái",
  line: "Vẽ trên bề mặt", pushpull: "Đẩy/Kéo (P)",
  "wall-move": "Dời tường", "wall-offset": "Offset tường", "wall-height": "Chiều cao tường",
  "door-place3d": "Đặt cửa đi", "window-place3d": "Đặt cửa sổ", paint3d: "Sơn vật liệu",
  "mep-water": "Cấp nước (+30cm)", "mep-drain": "Thoát nước (−20cm)", "mep-electric": "Điện (+280cm)",
  "mep-hvac": "Điều hòa (+300cm)", "mep-gas": "Gas (+30cm)", "mep-fixture": "Thiết bị gắn tường",
  orbit: "Xoay camera (O)", pan: "Di chuyển (H)", zoom: "Thu phóng (Z)",
  walk: "Đi bộ WASD", "walk-avatar": "Nhân vật đi vào phòng",
  measure: "Thước đo", "floor-pick": "Chọn vùng mặt bằng",
};

const toRailTools = (ids: string[]): RailTool[] =>
  ids.map((id) => ({ id, label: TOOL_LABELS[id], icon: ICONS[id] }));

const GROUPS: RailGroup[] = [
  { id: "draw", label: "Vẽ", icon: ICONS.wall3d, tools: toRailTools([
    "wall3d", "floor3d", "rect3d", "circle3d", "arc3d", "box3d", "cylinder3d", "roof-ridge", "line",
  ]) },
  { id: "modify", label: "Chỉnh sửa", icon: ICONS.pushpull, tools: toRailTools([
    "pushpull", "wall-move", "wall-offset", "wall-height", "door-place3d", "window-place3d", "paint3d",
  ]) },
  { id: "mep", label: "MEP", icon: ICONS["mep-water"], tools: toRailTools([
    "mep-water", "mep-drain", "mep-electric", "mep-hvac", "mep-gas", "mep-fixture",
  ]) },
  { id: "view", label: "Camera", icon: ICONS.orbit, tools: toRailTools([
    "orbit", "pan", "zoom", "walk", "walk-avatar",
  ]) },
];

export function ToolRail({
  activeTool, setActiveTool, onLineClick,
  hasRegion, onResetRegion, onAnalyze, analyzeStatus, onDetectRooms,
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
  const [openGroup, setOpenGroup] = useState<{ id: string; top: number } | null>(null);

  // Click-away closes any open flyout (demo_2's document click handler).
  useEffect(() => {
    if (!openGroup) return;
    const close = () => setOpenGroup(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [openGroup]);

  const pick = (id: string) => {
    setOpenGroup(null);
    if (id === "line") onLineClick();
    else setActiveTool(id);
  };

  const railBtn = "relative group/rb w-9 h-9 rounded-lg flex items-center justify-center transition-all";
  const idle = "text-slate-400 hover:text-white hover:bg-slate-700";
  const activeCls = "bg-blue-600 text-white shadow-lg shadow-blue-600/25";
  const tooltip = (label: string) => (
    <span className="absolute left-11 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap opacity-0 group-hover/rb:opacity-100 pointer-events-none transition-opacity shadow-xl z-[60]">
      {label}
    </span>
  );

  const groupOfActive = GROUPS.find((g) => g.tools.some((t) => t.id === activeTool));

  return (
    <>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-slate-950/80 border border-white/[0.08] p-1.5 rounded-xl shadow-2xl flex flex-col space-y-0.5 backdrop-blur-sm select-none items-center overflow-y-auto max-h-[86vh]">
        {/* Edit */}
        <button onClick={() => pick("select")} className={`${railBtn} ${activeTool === "select" ? activeCls : idle}`}>{ICONS.select}{tooltip(TOOL_LABELS.select)}</button>
        <button onClick={() => pick("eraser")} className={`${railBtn} ${activeTool === "eraser" ? activeCls : idle}`}>{ICONS.eraser}{tooltip(TOOL_LABELS.eraser)}</button>
        <button onClick={() => useDrawingStore.getState().undo()} className={`${railBtn} ${idle}`}>{ICONS.undo}{tooltip("Hoàn tác (Ctrl+Z)")}</button>
        <button onClick={() => useDrawingStore.getState().redo()} className={`${railBtn} ${idle}`}>{ICONS.redo}{tooltip("Làm lại (Ctrl+Shift+Z)")}</button>
        <div className="w-6 border-t border-slate-800 my-1" />

        {/* Flyout groups */}
        {GROUPS.map((g) => (
          <button
            key={g.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              const top = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
              setOpenGroup(openGroup?.id === g.id ? null : { id: g.id, top });
            }}
            className={`${railBtn} ${groupOfActive?.id === g.id ? activeCls : idle}`}
          >
            {g.tools.find((t) => t.id === activeTool)?.icon ?? g.icon}
            {tooltip(g.tools.find((t) => t.id === activeTool)?.label ?? g.label)}
          </button>
        ))}
        <div className="w-6 border-t border-slate-800 my-1" />

        {/* Analyze */}
        <button onClick={() => pick("measure")} className={`${railBtn} ${activeTool === "measure" ? activeCls : idle}`}>{ICONS.measure}{tooltip(TOOL_LABELS.measure)}</button>
        <button onClick={() => pick("floor-pick")} className={`${railBtn} ${activeTool === "floor-pick" ? activeCls : idle}`}>{ICONS["floor-pick"]}{tooltip(TOOL_LABELS["floor-pick"])}</button>
        {hasRegion && (
          <button onClick={onResetRegion} className={`${railBtn} text-amber-400 hover:text-white hover:bg-amber-700`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            {tooltip("Bỏ vùng đã chọn")}
          </button>
        )}
        {onAnalyze && (
          <button onClick={onAnalyze} disabled={analyzeStatus === "pending" || analyzeStatus === "running"} className={`${railBtn} text-violet-400 hover:text-white hover:bg-violet-700 disabled:opacity-40`}>
            {analyzeStatus === "pending" || analyzeStatus === "running"
              ? <span className="block w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>}
            {tooltip("Phân tích 2D → BIM 3D")}
          </button>
        )}
        <button onClick={() => onDetectRooms?.()} className={`${railBtn} ${idle} hover:bg-emerald-700`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          {tooltip("Tự động nhận phòng (R)")}
        </button>
      </div>

      {/* Flyout menu — fixed beside the rail at the group button's height */}
      {openGroup && (() => {
        const g = GROUPS.find((x) => x.id === openGroup.id)!;
        return (
          <div
            className="fixed left-[60px] z-30 bg-slate-900/95 border border-slate-700/70 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[190px] shadow-2xl backdrop-blur-md"
            style={{ top: Math.max(8, Math.min(openGroup.top, window.innerHeight - 40 * g.tools.length - 16)) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {g.tools.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-left transition-all ${activeTool === t.id ? "bg-blue-600/25 text-blue-300" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
              >
                <span className="flex-shrink-0">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );
}

/** Persistent pill above the canvas naming the active tool (demo_2's #toolBadge). */
export function ToolBadge({ activeTool }: { activeTool: string }) {
  const label = TOOL_LABELS[activeTool];
  if (!label) return null;
  return (
    <div className="absolute top-4 left-16 z-30 flex items-center gap-2 bg-blue-950/80 border border-blue-500/50 text-blue-300 px-3 py-1.5 rounded-full text-[11px] font-bold select-none pointer-events-none backdrop-blur">
      {ICONS[activeTool]}
      {label}
    </div>
  );
}
