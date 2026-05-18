import { useDrawingStore } from "../stores/drawingStore";
import type { ToolType } from "../types";

const ANNOTATE_TOOLS: { id: ToolType; label: string; icon: string; shortcut: string }[] = [
  { id: "text", label: "Text", icon: "T", shortcut: "TEXT" },
  { id: "dimension", label: "Dimension", icon: "📏", shortcut: "DIM" },
  { id: "leader", label: "Leader", icon: "➤", shortcut: "LEADER" },
  { id: "hatch", label: "Hatch", icon: "▓", shortcut: "H" },
];

export default function AnnotateToolbar(): React.ReactElement {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);

  return (
    <div className="p-2 border-b border-gray-700">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
        Annotate
      </h3>
      <div className="grid grid-cols-2 gap-1">
        {ANNOTATE_TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`flex flex-col items-center justify-center px-2 py-1.5 rounded text-xs transition-colors ${
              tool === t.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
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