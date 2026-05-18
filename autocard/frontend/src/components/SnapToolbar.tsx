import { useDrawingStore } from "../stores/drawingStore";
import type { SnapModes } from "../types";

const SNAP_MODES: { id: keyof SnapModes; label: string; icon: string }[] = [
  { id: "endpoint", label: "End", icon: "◻" },
  { id: "midpoint", label: "Mid", icon: "△" },
  { id: "center", label: "Cen", icon: "○" },
  { id: "grid", label: "Grid", icon: "·" },
  { id: "intersection", label: "Int", icon: "×" },
];

export default function SnapToolbar(): React.ReactElement {
  const snapEnabled = useDrawingStore((s) => s.snapEnabled);
  const snapModes = useDrawingStore((s) => s.snapModes);
  const setSnapEnabled = useDrawingStore((s) => s.setSnapEnabled);
  const toggleSnapMode = useDrawingStore((s) => s.toggleSnapMode);

  return (
    <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
      <button
        onClick={() => setSnapEnabled(!snapEnabled)}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          snapEnabled
            ? "bg-blue-600 text-slate-900 dark:text-white"
            : "text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-600"
        }`}
        title="Toggle Snap (F3)"
      >
        SNAP
      </button>
      <span className="text-gray-600 mx-0.5">|</span>
      {SNAP_MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => toggleSnapMode(mode.id)}
          className={`px-1.5 py-1 rounded text-xs transition-colors ${
            snapModes[mode.id]
              ? "bg-blue-600/40 text-blue-300"
              : "text-gray-500 hover:text-slate-700 dark:text-gray-300 hover:bg-gray-600"
          }`}
          title={`Snap to ${mode.label}`}
        >
          {mode.icon}
        </button>
      ))}
    </div>
  );
}