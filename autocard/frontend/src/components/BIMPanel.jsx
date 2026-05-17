import { useState } from "react";

const BIM_CATEGORIES = [
  "Wall",
  "Floor",
  "Ceiling",
  "Roof",
  "Door",
  "Window",
  "Column",
  "Beam",
  "Stair",
  "Railing",
  "Furniture",
  "Fixture",
  "Equipment",
  "Pipe",
  "Duct",
  "Cable Tray",
  "Generic",
];

const BIM_MATERIALS = [
  "Concrete",
  "Steel",
  "Wood",
  "Glass",
  "Brick",
  "Stone",
  "Plaster",
  "Aluminum",
  "Copper",
  "Plastic",
  "Composite",
  "Other",
];

const FIRE_RATINGS = ["None", "1hr", "2hr", "3hr", "4hr"];

export default function BIMPanel({ element, onUpdate, onClose }) {
  const [expanded, setExpanded] = useState(true);

  if (!element) {
    return (
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200 mb-2">BIM Properties</h3>
        <p className="text-xs text-gray-500">Select an element to view BIM properties</p>
      </div>
    );
  }

  const bim = element.bim || {};
  const hasBim = Object.keys(bim).length > 0;

  const updateBim = (key, value) => {
    onUpdate(element.id, {
      bim: { ...bim, [key]: value },
    });
  };

  const deleteBim = () => {
    onUpdate(element.id, { bim: null });
  };

  return (
    <div className="border-b border-gray-700">
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium text-gray-200">BIM Properties</h3>
        <span className="text-gray-400 text-xs">{expanded ? "▼" : "▶"}</span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Category */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Category</label>
            <select
              value={bim.category || ""}
              onChange={(e) => updateBim("category", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            >
              <option value="">— Select —</option>
              {BIM_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Material */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Material</label>
            <select
              value={bim.material || ""}
              onChange={(e) => updateBim("material", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            >
              <option value="">— Select —</option>
              {BIM_MATERIALS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Fire Rating */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Fire Rating</label>
            <select
              value={bim.fireRating || "None"}
              onChange={(e) => updateBim("fireRating", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            >
              {FIRE_RATINGS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Description</label>
            <textarea
              value={bim.description || ""}
              onChange={(e) => updateBim("description", e.target.value)}
              rows={2}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 resize-none"
            />
          </div>

          {/* Manufacturer */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Manufacturer</label>
            <input
              type="text"
              value={bim.manufacturer || ""}
              onChange={(e) => updateBim("manufacturer", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            />
          </div>

          {/* Model Number */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Model Number</label>
            <input
              type="text"
              value={bim.modelNumber || ""}
              onChange={(e) => updateBim("modelNumber", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            />
          </div>

          {/* Cost */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Cost ($)</label>
            <input
              type="number"
              value={bim.cost || ""}
              onChange={(e) => updateBim("cost", parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
              min="0"
              step="0.01"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Status</label>
            <select
              value={bim.status || "Existing"}
              onChange={(e) => updateBim("status", e.target.value)}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            >
              <option value="Existing">Existing</option>
              <option value="New">New</option>
              <option value="Demolish">Demolish</option>
              <option value="Temporary">Temporary</option>
            </select>
          </div>

          {/* Phase */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Phase</label>
            <input
              type="text"
              value={bim.phase || ""}
              onChange={(e) => updateBim("phase", e.target.value)}
              placeholder="e.g. Phase 1"
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes</label>
            <textarea
              value={bim.notes || ""}
              onChange={(e) => updateBim("notes", e.target.value)}
              rows={2}
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                // Generate default BIM data based on element type
                const defaults = {
                  category: element.type === "rectangle" ? "Wall" : element.type === "circle" ? "Column" : "Generic",
                  material: "Concrete",
                  fireRating: "None",
                  status: "New",
                  description: "",
                };
                onUpdate(element.id, { bim: defaults });
              }}
              className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              {hasBim ? "Reset" : "Add BIM Data"}
            </button>
            {hasBim && (
              <button
                onClick={deleteBim}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Remove
              </button>
            )}
          </div>

          {/* BIM Summary */}
          {hasBim && (
            <div className="mt-2 p-2 bg-gray-700/50 rounded text-xs text-gray-400">
              <div className="font-medium text-gray-300 mb-1">Summary</div>
              <div>Category: {bim.category || "—"}</div>
              <div>Material: {bim.material || "—"}</div>
              <div>Status: {bim.status || "—"}</div>
              {bim.cost > 0 && <div>Cost: ${bim.cost.toFixed(2)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}