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
  wall: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  door: "bg-red-500/15 text-red-400 border-red-500/30",
  window: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  slab: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  ignore: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

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
  const mmW = bbox ? (bbox.width * factor) / 1000 : 0; // metres for display
  const mmH = bbox ? (bbox.height * factor) / 1000 : 0;

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
              <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-gray-300">
                {bbox
                  ? <>Bounding box: <b>{mmW.toFixed(2)}m × {mmH.toFixed(2)}m</b> · {elementCount.toLocaleString()} elements</>
                  : <>{elementCount.toLocaleString()} elements</>}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] font-bold uppercase text-slate-400">
                <span>Layer</span><span>Count</span><span>Type</span>
              </div>
              {layers.map((l) => (
                <div key={l.layerId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <span className="truncate text-xs text-slate-700 dark:text-gray-200" title={l.layerId}>{l.layerId}</span>
                  <span className="text-xs tabular-nums text-slate-500">{l.count}</span>
                  <select
                    value={override[l.layerId]}
                    onChange={(e) => setOverride((m) => ({ ...m, [l.layerId]: e.target.value as LayerType }))}
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[override[l.layerId]]}`}
                  >
                    {(["wall", "door", "window", "slab", "ignore"] as LayerType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
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
