// src/pages/CanvasEditor/components/ViewsPanel.tsx
// "Views" tab: renders plan + 4 elevations + user-defined section cuts, all
// live from the 3D model via ViewRenderer. Click a thumbnail to expand it
// with dimension lines; each view has its own PNG export. Section cuts are
// added by drawing a line on the expanded plan view.
import { useMemo, useState } from "react";
import { ViewRenderer } from "../../../canvas/3d/components/ViewRenderer";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";
import type { SheetView } from "../../../canvas/3d/geometry/sheetCamera";
import { getPlanBounds } from "../../../canvas/3d/geometry/planClassification";

const THUMB_W = 220, THUMB_H = 160;
const EXPANDED_W = 900, EXPANDED_H = 640;

interface ViewsPanelProps {
  elements: DrawingElement[];
  visible: boolean;
  wallHeight: number;
}

const FIXED_VIEWS: { view: SheetView; label: string }[] = [
  { view: "plan", label: "Mặt bằng" },
  { view: "elevation-N", label: "Mặt đứng Bắc" },
  { view: "elevation-S", label: "Mặt đứng Nam" },
  { view: "elevation-E", label: "Mặt đứng Đông" },
  { view: "elevation-W", label: "Mặt đứng Tây" },
];

interface ExpandedView { view: SheetView; label: string; sectionLine?: { x1: number; y1: number; x2: number; y2: number } }

export default function ViewsPanel({ elements, visible, wallHeight }: ViewsPanelProps) {
  const sectionCuts = useDrawingStore((s) => s.sectionCuts);
  const addSectionCut = useDrawingStore((s) => s.addSectionCut);
  const removeSectionCut = useDrawingStore((s) => s.removeSectionCut);
  const [expanded, setExpanded] = useState<ExpandedView | null>(null);
  const [addingCut, setAddingCut] = useState(false);
  const [exportId, setExportId] = useState(0);
  // ViewRenderer draws wall/roof geometry inside a group offset by
  // (-cx, -cz) — the centroid of `elements`' raw (uncentered) drawing
  // bounds — so it lines up with its camera, which is built from those
  // same bounds re-centered on the origin (see sheetFrustum/ViewRenderer:
  // `sectionLine` is passed straight into sheetFrustum alongside the
  // already-centered `localBounds`, with no further offset applied
  // inside ViewRenderer). sceneSlice.sectionCuts[].line, on the other
  // hand, is stored in raw/uncentered drawing coordinates — SectionCutTool
  // converts its local scene click-points back to drawing coords via
  // worldToDrawing() (adding the center back) before calling
  // addSectionCut(). So re-centering here (subtracting the same cx/cz
  // ViewRenderer itself derives from `elements`) is required — a plain
  // x1,y1 -> x1,z1 field rename would leave the cut in the wrong place
  // any time the model isn't already centered on the origin.
  // (Must run unconditionally, before the `visible` early-return, per the
  // Rules of Hooks — same reason ViewRenderer's own bounds-dependent hooks
  // run before its "nothing to show" early return.)
  const bounds = useMemo(() => getPlanBounds(elements), [elements]);

  if (!visible) return null;

  const wallCount = elements.filter((el) => el.archType === "wall").length;
  const cx = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
  const cz = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 0;
  const toLocalSection = (line?: { x1: number; y1: number; x2: number; y2: number }) =>
    line ? { x1: line.x1 - cx, z1: line.y1 - cz, x2: line.x2 - cx, z2: line.y2 - cz } : undefined;

  return (
    <div className="absolute inset-0 top-9 bg-slate-100 dark:bg-slate-950 overflow-y-auto p-6">
      {wallCount === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-sm">
          Chưa có gì để hiển thị — vẽ tường ở chế độ 3D trước.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {FIXED_VIEWS.map(({ view, label }) => (
              <button key={view} onClick={() => setExpanded({ view, label })} className="flex flex-col items-center gap-1 group">
                <div className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden group-hover:border-blue-500 transition-colors">
                  <ViewRenderer elements={elements} view={view} width={THUMB_W} height={THUMB_H} wallHeight={wallHeight} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{label} · 1:100</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mặt cắt</span>
            <button
              onClick={() => { setAddingCut(true); setExpanded({ view: "plan", label: "Mặt bằng" }); }}
              className="text-[10px] font-bold text-blue-500 hover:text-blue-400"
            >
              + Thêm mặt cắt
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {sectionCuts.map((cut) => (
              <div key={cut.id} className="flex flex-col items-center gap-1 group relative">
                <button
                  onClick={() => setExpanded({ view: "section", label: cut.label, sectionLine: cut.line })}
                  className="border border-slate-300 dark:border-slate-700 rounded overflow-hidden group-hover:border-blue-500 transition-colors"
                >
                  <ViewRenderer elements={elements} view="section" sectionLine={toLocalSection(cut.line)} width={THUMB_W} height={THUMB_H} wallHeight={wallHeight} />
                </button>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{cut.label} · 1:100</span>
                <button
                  onClick={() => removeSectionCut(cut.id)}
                  className="absolute top-1 right-1 text-[10px] text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Xoá mặt cắt"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {expanded && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => { setExpanded(null); setAddingCut(false); }}>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {expanded.label}{addingCut ? " — click 2 điểm để vẽ mặt cắt" : ""}
              </span>
              <div className="flex items-center gap-3">
                {!addingCut && (
                  <button onClick={() => setExportId((n) => n + 1)} className="text-[11px] font-bold text-blue-500 hover:text-blue-400">⬇ Xuất PNG</button>
                )}
                <button onClick={() => { setExpanded(null); setAddingCut(false); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm">✕</button>
              </div>
            </div>
            <ViewRenderer
              elements={elements}
              view={expanded.view}
              sectionLine={toLocalSection(expanded.sectionLine)}
              width={EXPANDED_W}
              height={EXPANDED_H}
              wallHeight={wallHeight}
              showDimensions={!addingCut}
              drawingSectionCut={addingCut}
              exportRequestId={exportId}
              exportLabel={expanded.label.replace(/\s+/g, "-")}
              onSectionCutDrawn={(line) => { addSectionCut(line); setAddingCut(false); setExpanded(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
