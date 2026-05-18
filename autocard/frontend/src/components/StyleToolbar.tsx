import { useDrawingStore } from "../stores/drawingStore";

const LINE_TYPES = [
  { id: "solid", label: "Solid", dash: "" },
  { id: "dashed", label: "Dashed", dash: "— —" },
  { id: "dotted", label: "Dotted", dash: "···" },
];

export default function StyleToolbar(): React.ReactElement {
  const currentStyle = useDrawingStore((s) => s.currentStyle);
  const setStyle = useDrawingStore((s) => s.setStyle);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-800 border-b border-gray-700">
      <span className="text-xs text-gray-500 font-medium">Style</span>

      {/* Stroke Color */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-400">Color</label>
        <input
          type="color"
          value={currentStyle.strokeColor}
          onChange={(e) => setStyle({ strokeColor: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-gray-600 p-0"
        />
      </div>

      {/* Fill Color */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-400">Fill</label>
        <input
          type="color"
          value={currentStyle.fillColor && currentStyle.fillColor !== "transparent" ? currentStyle.fillColor : "#ffffff"}
          onChange={(e) => setStyle({ fillColor: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-gray-600 p-0"
        />
        <button
          onClick={() => setStyle({ fillColor: "transparent" })}
          className="text-xs text-gray-500 hover:text-white px-1"
          title="No fill"
        >
          ∅
        </button>
      </div>

      {/* Line Width */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-400">Width</label>
        <select
          value={currentStyle.lineWidth}
          onChange={(e) => setStyle({ lineWidth: parseInt(e.target.value) })}
          className="bg-gray-700 text-white rounded px-1 py-0.5 text-xs border border-gray-600 w-14"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((w) => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </div>

      {/* Line Type */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-400">Type</label>
        <select
          value={currentStyle.lineType}
          onChange={(e) => setStyle({ lineType: e.target.value })}
          className="bg-gray-700 text-white rounded px-1 py-0.5 text-xs border border-gray-600"
        >
          {LINE_TYPES.map((lt) => (
            <option key={lt.id} value={lt.id}>{lt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}