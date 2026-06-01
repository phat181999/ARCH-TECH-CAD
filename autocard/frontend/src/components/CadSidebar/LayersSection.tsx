import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";

interface LayersSectionProps {
  layers: any[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  addLayer: () => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  duplicateLayer?: (id: string) => void;
}

export function LayersSection({
  layers,
  activeLayerId,
  setActiveLayer,
  addLayer,
  toggleLayerVisibility,
  toggleLayerLock,
  deleteLayer,
  renameLayer,
  duplicateLayer,
}: LayersSectionProps) {
  const [layerEditId, setLayerEditId] = useState<string | null>(null);

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-400 dark:text-gray-500 transition-colors duration-300 font-mono">{layers.length} layer(s)</span>
        <button
          onClick={addLayer}
          className="text-[9px] font-bold text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded hover:bg-cyan-500/10 transition-colors"
        >
          + NEW
        </button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
        {layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
              activeLayerId === layer.id
                ? "bg-slate-200 dark:bg-[#1E293B] border border-slate-300 dark:border-gray-600"
                : "hover:bg-slate-100 dark:bg-[#11161D] border border-transparent"
            } ${!layer.visible ? "opacity-40" : ""}`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
              className={`transition-colors ${layer.visible ? "text-cyan-400" : "text-slate-500"}`}
              title={layer.visible ? "Hide layer" : "Show layer"}
            >
              {layer.visible
                ? <Eye className="w-3.5 h-3.5" />
                : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
              className={`transition-colors ${layer.locked ? "text-rose-500" : "text-slate-500"}`}
              title={layer.locked ? "Unlock layer" : "Lock layer"}
            >
              {layer.locked
                ? <Lock className="w-3.5 h-3.5" />
                : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: layer.style?.strokeColor || "#38BDF8" }}
            />
            {layerEditId === layer.id ? (
              <input
                autoFocus
                defaultValue={layer.name}
                onBlur={(e) => { renameLayer(layer.id, e.target.value); setLayerEditId(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { renameLayer(layer.id, e.currentTarget.value); setLayerEditId(null); } }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-white dark:bg-[#0B0E14] transition-colors duration-300 text-xs text-slate-900 dark:text-white transition-colors duration-300 font-mono border border-cyan-500/50 rounded px-1 outline-none"
              />
            ) : (
              <span
                onDoubleClick={(e) => { e.stopPropagation(); setLayerEditId(layer.id); }}
                className={`flex-1 text-[11px] font-mono truncate ${activeLayerId === layer.id ? "text-slate-900 dark:text-white transition-colors duration-300" : "text-slate-500 dark:text-gray-400 transition-colors duration-300"}`}
              >
                {layer.name}
              </span>
            )}
            <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); setLayerEditId(layer.id); }}
                className="p-0.5 hover:text-cyan-400 text-slate-500 transition-colors"
                title="Rename"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); duplicateLayer?.(layer.id); }}
                className="p-0.5 hover:text-cyan-400 text-slate-500 transition-colors"
                title="Duplicate"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              </button>
              {layers.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete layer ${layer.name} and all its elements?`)) deleteLayer(layer.id); }}
                  className="p-0.5 hover:text-red-400 text-slate-500 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
