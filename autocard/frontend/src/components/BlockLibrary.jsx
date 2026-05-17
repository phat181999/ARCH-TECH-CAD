import { useState } from "react";
import { useDrawingStore } from "../stores/drawingStore";

export default function BlockLibrary({ onInsertBlock }) {
  const blockDefsObj = useDrawingStore((s) => s.blockDefs);
  const defineBlock = useDrawingStore((s) => s.defineBlock);
  const deleteBlockDef = useDrawingStore((s) => s.deleteBlockDef);
  const elements = useDrawingStore((s) => s.elements);
  const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
  const [showSave, setShowSave] = useState(false);
  const [blockName, setBlockName] = useState("");

  const blockDefs = Object.values(blockDefsObj);

  const handleSaveBlock = () => {
    const name = blockName.trim();
    if (!name || selectedElementIds.length === 0) return;
    const blockElements = elements.filter((el) =>
      selectedElementIds.includes(el.id)
    );
    defineBlock(name, blockElements);
    setBlockName("");
    setShowSave(false);
  };

  return (
    <div className="p-3 border-b border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-200">Blocks</h3>
        <button
          onClick={() => setShowSave(!showSave)}
          disabled={selectedElementIds.length === 0}
          className="text-xs px-2 py-0.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Save as Block
        </button>
      </div>

      {showSave && (
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={blockName}
            onChange={(e) => setBlockName(e.target.value)}
            placeholder="Block name..."
            className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveBlock();
              if (e.key === "Escape") setShowSave(false);
            }}
            autoFocus
          />
          <button
            onClick={handleSaveBlock}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      )}

      {blockDefs.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          Select elements and save as block
        </p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {blockDefs.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between bg-gray-700 rounded px-2 py-1"
            >
              <button
                onClick={() => onInsertBlock(block)}
                className="text-xs text-gray-200 hover:text-white truncate flex-1 text-left"
                title={`Insert "${block.name}" (${block.elements.length} elements)`}
              >
                {block.name}
                <span className="text-gray-500 ml-1">
                  ({block.elements.length})
                </span>
              </button>
              <button
                onClick={() => deleteBlockDef(block.id)}
                className="text-gray-500 hover:text-red-400 text-xs ml-1"
                title="Delete block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}