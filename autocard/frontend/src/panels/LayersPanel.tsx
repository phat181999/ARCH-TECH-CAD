import { useDrawingStore } from "../stores/drawingStore";

export default function LayersPanel(): React.ReactElement {
  const layers = useDrawingStore((s) => s.layers);
  const activeLayerId = useDrawingStore((s) => s.activeLayerId);
  const addLayer = useDrawingStore((s) => s.addLayer);
  const setActiveLayer = useDrawingStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useDrawingStore((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useDrawingStore((s) => s.toggleLayerLock);
  const deleteLayer = useDrawingStore((s) => s.deleteLayer);
  const renameLayer = useDrawingStore((s) => s.renameLayer);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="flex-1 flex flex-col min-h-0 border-b border-gray-700">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200">Layers</h3>
        <button
          onClick={addLayer}
          className="text-gray-400 hover:text-slate-900 dark:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700"
          title="Add Layer"
        >
          + Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
              activeLayerId === layer.id
                ? "bg-blue-600/20 border border-blue-500/30"
                : "hover:bg-gray-700 border border-transparent"
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
              className={`text-xs ${layer.visible ? "text-slate-700 dark:text-gray-300" : "text-gray-600"}`}
              title={layer.visible ? "Hide layer" : "Show layer"}
            >
              {layer.visible ? "👁" : "—"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
              className={`text-xs ${layer.locked ? "text-red-400" : "text-gray-600"}`}
              title={layer.locked ? "Unlock layer" : "Lock layer"}
            >
              {layer.locked ? "🔒" : "🔓"}
            </button>
            <input
              value={layer.name}
              onChange={(e) => renameLayer(layer.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-slate-800 dark:text-gray-200 focus:outline-none focus:bg-gray-700 px-1 rounded text-xs"
            />
            {layers.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                className="text-gray-500 hover:text-red-400 text-xs"
                title="Delete layer"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500">
        Active: {activeLayer?.name || "None"}
      </div>
    </div>
  );
}