import { useState } from "react";
import type { DxfUnit } from "../../../canvas/dxf.units";
import { DXF_UNIT_OPTIONS, unitFactorToMm } from "../../../canvas/dxf.units";
import type { DxfLayerInfo } from "../../../canvas/dxf";

export type LayerType = "wall" | "door" | "window" | "slab" | "ignore";

export interface DxfImportResult {
  unit: DxfUnit;
  mode: "replace" | "merge";
  override: Record<string, LayerType>;
}

const TYPE_COLORS: Record<LayerType, string> = {
  wall:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  door:   "bg-red-500/15 text-red-400 border-red-500/30",
  window: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  slab:   "bg-sky-500/15 text-sky-400 border-sky-500/30",
  ignore: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

// What each type does in 3D — shown as tooltip on the select
const TYPE_DESC: Record<LayerType, string> = {
  wall:   "🧱 Tường — đường line sẽ được extrude lên thành tường 3D",
  door:   "🚪 Cửa đi — hiển thị panel cửa trong mô hình 3D",
  window: "🪟 Cửa sổ — hiển thị kính trong suốt trong 3D",
  slab:   "🏗️ Sàn/trần — tạo mặt phẳng ngang trong 3D",
  ignore: "🚫 Bỏ qua — không hiển thị trong 3D (chữ, kích thước, ký hiệu, điện nước...)",
};

// Guess why a layer was auto-classified — shown as a badge hint
function guessLayerHint(layerId: string): string | null {
  const id = layerId.toUpperCase().trim();
  if (/^TXT$|^T$|TEXT|CHU|FONT/.test(id))   return "chữ/text";
  if (/THANG|CAU.?THANG/.test(id))          return "cầu thang";
  if (/LAMP|LIGHT|BONG|DEN\b/.test(id))     return "đèn/điện";
  if (/NUOC|NDNUOC|NDET/.test(id))          return "nước/ống";
  if (/^HOA$|CAY.?XANH/.test(id))           return "cây/hoa";
  if (/^KT$|KICH.?THUOC|DIM|L-DIM/.test(id)) return "kích thước";
  if (/KY.?HIEU|CHU.?THICH/.test(id))       return "ký hiệu";
  if (/MAT.?CAT|MATCAT/.test(id))           return "mặt cắt";
  if (/MAT.?DU[NG]/.test(id))               return "mặt đứng";
  if (/TONG.?THE/.test(id))                 return "tổng thể";
  if (/^NET|NETVE|NETBAO/.test(id))         return "nét khuất";
  if (/NOI.?THAT|THIET.?BI/.test(id))       return "nội thất";
  if (/TUONG|BTCT|GACH/.test(id))           return "tường/BT";
  if (/^CUA$|CUADI|CUA.?DI/.test(id))       return "cửa đi";
  if (/CUASO|CUA.?SO/.test(id))             return "cửa sổ";
  if (/MAT.?BANG|^MB$/.test(id))            return "mặt bằng";
  return null;
}

// Small inline tooltip — shows on hover via CSS title attr + visual cue
function Tip({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex cursor-help items-center rounded-full border border-slate-300/50 bg-slate-100 px-1 py-0.5 text-[9px] text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 hover:border-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
    >
      {children}
    </span>
  );
}



export function DxfImportWizard({
  fileName,
  elementCount,
  bbox,
  layers,
  detectedUnit,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  elementCount: number;
  bbox: { width: number; height: number } | null; // in raw DXF units
  layers: DxfLayerInfo[];
  detectedUnit: DxfUnit | null;
  onCancel: () => void;
  onConfirm: (result: DxfImportResult) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [unit, setUnit] = useState<DxfUnit>(detectedUnit ?? "mm");
  const [override, setOverride] = useState<Record<string, LayerType>>(
    Object.fromEntries(layers.map((l) => [l.layerId, l.autoType])),
  );

  const factor = unitFactorToMm(unit);
  // Raw DXF size (before unit conversion) — helps user identify the unit
  const rawW = bbox?.width ?? 0;
  const rawH = bbox?.height ?? 0;
  // Converted to metres
  const mW = bbox ? (rawW * factor) / 1000 : 0;
  const mH = bbox ? (rawH * factor) / 1000 : 0;

  // Heuristic hint: guess most likely unit from raw coordinate magnitude
  const unitHint = !detectedUnit && bbox
    ? rawW > 10000 ? "Looks like mm (large numbers)"
    : rawW > 1000  ? "Looks like cm or mm"
    : rawW > 100   ? "Looks like cm or inches"
    : rawW > 1     ? "Looks like m or ft"
    : null
    : null;

  const finish = (mode: "replace" | "merge") => onConfirm({ unit, mode, override });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0B0E14]/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#1E293B] dark:bg-[#151B23]">
        {/* Header + step indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-[#1E293B]">
          <div className="truncate pr-3 text-sm font-bold text-slate-800 dark:text-gray-200">Import DXF · {fileName}</div>
          <div className="flex flex-shrink-0 gap-1.5 text-[10px] font-bold">
            <span className={step === 1 ? "text-cyan-400" : "text-slate-400"}>1 · Units</span>
            <span className="text-slate-500">/</span>
            <span className={step === 2 ? "text-cyan-400" : "text-slate-400"}>2 · Layers</span>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {step === 1 ? (
            <div className="space-y-4">
              {/* Unit selector row */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">Drawing unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as DxfUnit)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-gray-200"
                >
                  {DXF_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {detectedUnit && (
                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                    Auto-detected: {detectedUnit}
                  </span>
                )}
              </div>

              {/* Bounding box info card */}
              {bbox ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Raw DXF size</div>
                      <div className="text-xs font-mono text-slate-700 dark:text-gray-300">
                        {rawW.toLocaleString(undefined, { maximumFractionDigits: 2 })} × {rawH.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">After conversion</div>
                      <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                        {mW.toFixed(2)} m × {mH.toFixed(2)} m
                      </div>
                    </div>
                  </div>
                  {unitHint && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span>💡</span> {unitHint} — try changing unit above to see the real size
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">{elementCount.toLocaleString()} elements found</div>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-500 dark:bg-slate-800/60">
                  {elementCount.toLocaleString()} elements · no bounding box (elements at origin)
                </div>
              )}

              {/* Guide for when unsure */}
              {!detectedUnit && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Không rõ đơn vị?</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>• Raw &gt; 10 000 → <b className="text-slate-700 dark:text-gray-300">mm</b></span>
                    <span>• Raw 1 000–10 000 → <b className="text-slate-700 dark:text-gray-300">cm</b></span>
                    <span>• Raw 100–1 000 → <b className="text-slate-700 dark:text-gray-300">inches</b></span>
                    <span>• Raw 1–100 → <b className="text-slate-700 dark:text-gray-300">m / ft</b></span>
                  </div>
                </div>
              )}
            </div>
          ) : (() => {
            const wallCount = Object.values(override).filter(v => v === "wall").length;
            const ignoreCount = Object.values(override).filter(v => v === "ignore").length;
            const doorCount = Object.values(override).filter(v => v === "door").length;
            return (
            <div className="space-y-3">

              {/* 3D readiness banner */}
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 flex items-start gap-3">
                <span className="text-lg mt-0.5">🏗️</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-400 mb-1">Sau khi import → bấm 3D để xem mô hình</div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="bg-emerald-500/15 text-emerald-400 rounded px-1.5 py-0.5 font-bold">{wallCount} wall layer → tường</span>
                    {doorCount > 0 && <span className="bg-red-500/15 text-red-400 rounded px-1.5 py-0.5 font-bold">{doorCount} door layer → cửa</span>}
                    {ignoreCount > 0 && <span className="bg-slate-500/15 text-slate-400 rounded px-1.5 py-0.5">{ignoreCount} ignore → bỏ qua</span>}
                  </div>
                </div>
              </div>

              {/* Quick guide — collapsible */}
              <details className="group rounded-lg border border-slate-200 dark:border-slate-700">
                <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <span>💡 Hướng dẫn chọn Type cho 3D</span>
                  <span className="group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-3 space-y-3">
                  {/* Type legend */}
                  <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                    {([
                      { type: "wall",   icon: "🧱", color: "text-emerald-400", label: "wall",   desc: "Tường → extrude lên cao thành 3D. Chọn cho layer chứa đường tường." },
                      { type: "door",   icon: "🚪", color: "text-red-400",     label: "door",   desc: "Cửa đi → hiển thị panel cửa trong 3D." },
                      { type: "window", icon: "🪟", color: "text-amber-400",   label: "window", desc: "Cửa sổ → hiển thị kính trong suốt." },
                      { type: "ignore", icon: "🚫", color: "text-slate-400",   label: "ignore", desc: "Bỏ qua → không hiện trong 3D. Chọn cho chữ, kích thước, ký hiệu, điện nước, cầu thang, mặt đứng, mặt cắt." },
                    ] as const).map(item => (
                      <div key={item.type} className="flex items-start gap-2">
                        <span>{item.icon}</span>
                        <span className={`w-12 shrink-0 font-bold ${item.color}`}>{item.label}</span>
                        <span className="text-slate-500 dark:text-slate-400">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                  {/* Common Vietnamese layer cheat-sheet */}
                  <div className="rounded bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Layer phổ biến VN → nên set</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                      {[
                        ["TUONG, BTCT, GACH", "wall"], ["CUA, CUADI", "door"],
                        ["CUASO, KINH", "window"], ["TXT, TEXT, CHU", "ignore"],
                        ["THANG, CAU THANG", "ignore"], ["LAMP, DEN, DIEN", "ignore"],
                        ["NUOC, NDNUOC", "ignore"], ["KT, L-DIM, DIM", "ignore"],
                        ["MAT CAT, MAT DUNG", "ignore"], ["TONG THE", "ignore"],
                        ["HOA, CAY", "ignore"], ["NET*, NETVE", "ignore"],
                      ].map(([name, type]) => (
                        <div key={name} className="flex justify-between gap-1">
                          <span className="text-slate-600 dark:text-slate-300 font-mono">{name}</span>
                          <span className={`font-bold shrink-0 ${
                            type === "wall" ? "text-emerald-400" :
                            type === "door" ? "text-red-400" :
                            type === "window" ? "text-amber-400" : "text-slate-400"
                          }`}>→ {type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Tip for multi-floor drawings */}
                  <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                    <span>⚠️</span>
                    <span>Nếu file có nhiều tầng/mặt cắt chung 1 model space: sau khi vào 3D, dùng nút <b>floor-pick</b> (⬡) để chọn đúng vùng mặt bằng.</span>
                  </div>
                </div>
              </details>

              {/* Layer list */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] font-bold uppercase text-slate-400 px-1">
                <span>Layer</span><span>Count</span><span>Type</span>
              </div>
              {layers.map((l) => {
                const hint = guessLayerHint(l.layerId);
                const currentType = override[l.layerId];
                return (
                <div key={l.layerId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  {/* Layer name + hint badge */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-xs text-slate-700 dark:text-gray-200" title={l.layerId}>
                      {l.layerId}
                    </span>
                    {hint && (
                      <Tip title={`Layer này được nhận dạng là "${hint}" → tự động set thành ${currentType}`}>
                        {hint}
                      </Tip>
                    )}
                  </div>
                  {/* Element count */}
                  <span className="text-xs tabular-nums text-slate-500" title={`${l.count} elements trong layer này`}>
                    {l.count}
                  </span>
                  {/* Type selector with tooltip */}
                  <select
                    value={currentType}
                    title={TYPE_DESC[currentType]}
                    onChange={(e) => setOverride((m) => ({ ...m, [l.layerId]: e.target.value as LayerType }))}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${TYPE_COLORS[currentType]}`}
                  >
                    <option value="wall"   title={TYPE_DESC.wall}>🧱 wall</option>
                    <option value="door"   title={TYPE_DESC.door}>🚪 door</option>
                    <option value="window" title={TYPE_DESC.window}>🪟 window</option>
                    <option value="slab"   title={TYPE_DESC.slab}>🏗️ slab</option>
                    <option value="ignore" title={TYPE_DESC.ignore}>🚫 ignore</option>
                  </select>
                </div>
                );
              })}

            </div>
            );
          })()}

        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-slate-200 p-4 dark:border-[#1E293B]">
          <button onClick={onCancel} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancel</button>
          <div className="flex gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Back</button>
            )}
            {step === 1 ? (
              <button onClick={() => setStep(2)} className="rounded-lg bg-[#38BDF8] px-6 py-2 text-xs font-bold text-[#0B0E14] hover:bg-cyan-300">Next</button>
            ) : (
              <>
                <button onClick={() => finish("merge")} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Merge</button>
                <button onClick={() => finish("replace")} className="rounded-lg bg-[#38BDF8] px-6 py-2 text-xs font-bold text-[#0B0E14] hover:bg-cyan-300">Replace</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
