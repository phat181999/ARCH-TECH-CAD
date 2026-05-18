import { useDrawingStore } from "../stores/drawingStore";
import { ToolType } from "../types";

const MODIFY_TOOLS = [
  { id: "move", label: "Move", icon: "✚", shortcut: "M" },
  { id: "copy", label: "Copy", icon: "📋", shortcut: "CO" },
  { id: "rotate", label: "Rotate", icon: "↻", shortcut: "RO" },
  { id: "scale", label: "Scale", icon: "⇔", shortcut: "SC" },
  { id: "trim", label: "Trim", icon: "✂", shortcut: "TR" },
  { id: "offset", label: "Offset", icon: "∥", shortcut: "O" },
  { id: "mirror", label: "Mirror", icon: "⇔", shortcut: "MI" },
  { id: "explode", label: "Explode", icon: "💥", shortcut: "X" },
];

export default function ModifyToolbar(): React.ReactElement {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);
  const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
  const deleteSelectedElements = useDrawingStore((s) => s.deleteSelectedElements);

  const handleModifyClick = (modTool: string) => {
    if (modTool === "explode" || modTool === "move" || modTool === "copy" || modTool === "rotate" || modTool === "scale" || modTool === "offset" || modTool === "mirror") {
      if (selectedElementIds.length === 0) return;
    }
    setTool(modTool as ToolType);
  };

  return (
    <div className="p-2 border-b border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
          Modify
        </h3>
        <button
          onClick={deleteSelectedElements}
          disabled={selectedElementIds.length === 0}
          className="text-xs px-2 py-0.5 bg-red-700/50 text-red-300 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete selected"
        >
          Delete
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {MODIFY_TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleModifyClick(t.id)}
            className={`flex flex-col items-center justify-center px-1 py-1.5 rounded text-xs transition-colors ${
              tool === t.id
                ? "bg-blue-600 text-slate-900 dark:text-white"
                : "text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-700"
            } ${(t.id === "explode" || t.id === "move" || t.id === "copy" || t.id === "rotate" || t.id === "scale" || t.id === "offset" || t.id === "mirror") && selectedElementIds.length === 0 ? "opacity-40" : ""}`}
            title={`${t.label} (${t.shortcut})`}
          >
            <span className="text-sm leading-none mb-0.5">{t.icon}</span>
            <span className="text-[10px] leading-none">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}