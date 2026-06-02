import { useDrawingStore } from "../stores/drawingStore";
import TextFormatBar from "../components/TextFormatBar";

export default function PropertiesPanel(): React.ReactElement | null {
  const elements = useDrawingStore((s) => s.elements);
  const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const setSelectedElementIds = useDrawingStore((s) => s.setSelectedElementIds);

  const formatLength = useDrawingStore((s) => s.formatLength);

  if (selectedElementIds.length === 0) {
    return (
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-2">Properties</h3>
        <p className="text-xs text-gray-500 italic">No element selected</p>
      </div>
    );
  }

  if (selectedElementIds.length > 1) {
    return (
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-2">Properties</h3>
        <p className="text-xs text-gray-500">{selectedElementIds.length} elements selected</p>
      </div>
    );
  }

  const el = elements.find((e) => e.id === selectedElementIds[0]);
  if (!el) return null;

  return (
    <div className="p-3 border-b border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200">Properties</h3>
        <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
          {el.type}
        </span>
      </div>

      {/* Text formatting */}
      {el.type === "text" && (
        <div className="mb-3">
          <TextFormatBar
            elementId={el.id}
            onClose={() => setSelectedElementIds([])}
          />
        </div>
      )}

      {/* Geometry info */}
      <div className="mb-3 p-2 bg-gray-700/50 rounded text-xs text-gray-400 space-y-0.5">
        {el.type === "line" && (
          <>
            <div>Start: ({Math.round(el.x1!)}, {Math.round(el.y1!)})</div>
            <div>End: ({Math.round(el.x2!)}, {Math.round(el.y2!)})</div>
            <div>Length: {formatLength(Math.hypot(el.x2! - el.x1!, el.y2! - el.y1!) / 100)}</div>
          </>
        )}
        {el.type === "rectangle" && (
          <>
            <div>Position: ({Math.round(el.x!)}, {Math.round(el.y!)})</div>
            <div>Size: {formatLength(el.width! / 100)} × {formatLength(el.height! / 100)}</div>
          </>
        )}
        {el.type === "circle" && (
          <>
            <div>Center: ({Math.round(el.cx!)}, {Math.round(el.cy!)})</div>
            <div>Radius: {formatLength(el.radius! / 100)}</div>
          </>
        )}
        {el.type === "text" && (
          <>
            <div>Position: ({Math.round(el.x!)}, {Math.round(el.y!)})</div>
            <div>Content: "{el.text}"</div>
          </>
        )}
        {el.type === "dimension" && (
          <>
            <div>From: ({Math.round(el.x1!)}, {Math.round(el.y1!)})</div>
            <div>To: ({Math.round(el.x2!)}, {Math.round(el.y2!)})</div>
            <div>Distance: {formatLength(Math.hypot(el.x2! - el.x1!, el.y2! - el.y1!) / 100)}</div>
          </>
        )}
        {el.type === "leader" && (
          <>
            <div>Points: {el.points?.length || 0}</div>
            <div>Text: "{el.text || ""}"</div>
          </>
        )}
        {el.type === "hatch" && (
          <>
            <div>Points: {el.points?.length || 0}</div>
            <div>Pattern: {el.pattern || "solid"}</div>
          </>
        )}
      </div>

      {/* Style properties */}
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Stroke Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={el.strokeColor || "#1f2937"}
              onChange={(e) => updateElement(el.id, { strokeColor: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer border border-gray-600"
            />
            <input
              type="text"
              value={el.strokeColor || "#1f2937"}
              onChange={(e) => updateElement(el.id, { strokeColor: e.target.value })}
              className="flex-1 bg-gray-700 text-slate-900 dark:text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {(el.type === "rectangle" || el.type === "circle" || el.type === "hatch") && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Fill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={el.fillColor && el.fillColor !== "transparent" ? el.fillColor : "#ffffff"}
                onChange={(e) => updateElement(el.id, { fillColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border border-gray-600"
              />
              <input
                type="text"
                value={el.fillColor || "transparent"}
                onChange={(e) => updateElement(el.id, { fillColor: e.target.value })}
                className="flex-1 bg-gray-700 text-slate-900 dark:text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => updateElement(el.id, { fillColor: "transparent" })}
                className="text-xs text-gray-400 hover:text-slate-900 dark:text-white px-1"
                title="No fill"
              >
                ∅
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 block mb-1">Line Width</label>
          <input
            type="range"
            min="1"
            max="20"
            value={el.strokeWidth || 2}
            onChange={(e) => updateElement(el.id, { strokeWidth: parseInt(e.target.value) })}
            className="w-full"
          />
          <span className="text-xs text-gray-500">{el.strokeWidth || 2}px</span>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Line Type</label>
          <select
            value={el.lineType || "solid"}
            onChange={(e) => updateElement(el.id, { lineType: e.target.value })}
            className="w-full bg-gray-700 text-slate-900 dark:text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>

        {el.type === "hatch" && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Hatch Pattern</label>
            <select
              value={el.pattern || "diagonal45"}
              onChange={(e) => updateElement(el.id, { pattern: e.target.value })}
              className="w-full bg-gray-700 text-slate-900 dark:text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="solid">Solid Fill</option>
              <option value="diagonal45">Diagonal 45° (ANSI31)</option>
              <option value="diagonal135">Diagonal 135°</option>
              <option value="cross">Crosshatch</option>
              <option value="grid">Grid</option>
              <option value="brick">Brick</option>
              <option value="concrete">Concrete</option>
              <option value="insulation">Insulation</option>
              <option value="tile">Tile</option>
              <option value="wood">Wood Grain</option>
              <option value="steel">Steel (dense)</option>
              <option value="glass">Glazing</option>
              <option value="earth">Earth Fill</option>
              <option value="gravel">Gravel</option>
              <option value="sand">Sand</option>
            </select>
          </div>
        )}

        {el.type === "dimension" && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Offset Distance</label>
            <input
              type="number"
              min="10"
              max="200"
              value={typeof el.offset === "number" ? el.offset : 30}
              onChange={(e) => updateElement(el.id, { offset: parseInt(e.target.value) || 30 })}
              className="w-full bg-gray-700 text-slate-900 dark:text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}