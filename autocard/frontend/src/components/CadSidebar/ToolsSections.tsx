import { ToolBtn } from "../ui/ToolBtn";

// ─── Architecture Section ─────────────────────────────────────────────────────
interface ArchitectureSectionProps {
  tool: string;
  setTool: (t: string) => void;
}

export function ArchitectureSection({ tool, setTool }: ArchitectureSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Wall" icon="▬" active={tool === "wall"} onClick={() => setTool("wall")} compact />
      <ToolBtn label="Door" icon="🚪" active={tool === "door"} onClick={() => setTool("door")} compact />
      <ToolBtn label="Window" icon="🪟" active={tool === "window"} onClick={() => setTool("window")} compact />
      <ToolBtn label="Room" icon="⬛" active={tool === "room"} onClick={() => setTool("room")} compact />
      <ToolBtn label="Stair" icon="🪜" active={tool === "stair"} onClick={() => setTool("stair")} compact />
    </div>
  );
}

// ─── Draw Section ─────────────────────────────────────────────────────────────
interface DrawSectionProps {
  tool: string;
  setTool: (t: string) => void;
}

export function DrawSection({ tool, setTool }: DrawSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Select" icon="↖" active={tool === "select"} onClick={() => setTool("select")} shortcut="V" compact />
      <ToolBtn label="Line" icon="╱" active={tool === "line"} onClick={() => setTool("line")} shortcut="L" dragToolId="line" compact />
      <ToolBtn label="P-Line" icon="⌐" active={tool === "polyline"} onClick={() => setTool("polyline")} shortcut="PL" dragToolId="polyline" compact />
      <ToolBtn label="Rect" icon="▭" active={tool === "rectangle"} onClick={() => setTool("rectangle")} shortcut="REC" dragToolId="rectangle" compact />
      <ToolBtn label="Circle" icon="○" active={tool === "circle"} onClick={() => setTool("circle")} shortcut="C" dragToolId="circle" compact />
      <ToolBtn label="Arc" icon="⌒" active={tool === "arc"} onClick={() => setTool("arc")} shortcut="A" dragToolId="arc" compact />
      <ToolBtn label="Polygon" icon="⬡" active={tool === "polygon"} onClick={() => setTool("polygon")} dragToolId="polygon" compact />
      <ToolBtn label="Ellipse" icon="⬭" active={tool === "ellipse"} onClick={() => setTool("ellipse")} dragToolId="ellipse" compact />
      <ToolBtn label="Spline" icon="∿" active={tool === "spline"} onClick={() => setTool("spline")} compact />
      <ToolBtn label="Hatch" icon="▓" active={tool === "hatch"} onClick={() => setTool("hatch")} shortcut="H" dragToolId="hatch" compact />
    </div>
  );
}

// ─── Modify Section ───────────────────────────────────────────────────────────
interface ModifySectionProps {
  tool: string;
  setTool: (t: string) => void;
  onMirrorH?: () => void;
  onMirrorV?: () => void;
  onRotate90?: () => void;
}

export function ModifySection({ tool, setTool, onMirrorH, onMirrorV, onRotate90 }: ModifySectionProps) {
  return (
    <div className="px-2 py-1 space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Move" icon="✥" active={tool === "move"} onClick={() => setTool("move")} shortcut="M" compact />
        <ToolBtn label="Copy" icon="⧉" active={tool === "copy"} onClick={() => setTool("copy")} shortcut="CO" compact />
        <ToolBtn label="Rotate" icon="↻" active={tool === "rotate"} onClick={() => setTool("rotate")} shortcut="RO" compact />
        <ToolBtn label="Scale" icon="⤢" active={tool === "scale"} onClick={() => setTool("scale")} shortcut="SC" compact />
      </div>
      <div className="flex gap-1 px-1">
        <button onClick={onMirrorH} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors" title="Mirror Horizontal (over Y axis)">⇔ Mir H</button>
        <button onClick={onMirrorV} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors" title="Mirror Vertical (over X axis)">⇕ Mir V</button>
      </div>
      <div className="px-1">
        <button onClick={onRotate90} className="w-full text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors" title="Rotate 90 Degrees Clockwise">↷ Rot 90</button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Offset" icon="⊟" active={tool === "offset"} onClick={() => setTool("offset")} shortcut="O" compact />
        <ToolBtn label="Trim" icon="✂" active={tool === "trim"} onClick={() => setTool("trim")} shortcut="TR" compact />
        <ToolBtn label="Extend" icon="↔" active={tool === "extend"} onClick={() => setTool("extend")} shortcut="EX" compact />
        <ToolBtn label="Stretch" icon="⤡" active={tool === "stretch"} onClick={() => setTool("stretch")} compact />
        <ToolBtn label="Fillet" icon="⌔" active={tool === "fillet"} onClick={() => setTool("fillet")} shortcut="F" compact />
        <ToolBtn label="Chamfer" icon="⊿" active={tool === "chamfer"} onClick={() => setTool("chamfer")} shortcut="CHA" compact />
      </div>
    </div>
  );
}

// ─── Annotate Section ─────────────────────────────────────────────────────────
interface AnnotateSectionProps {
  tool: string;
  setTool: (t: string) => void;
}

export function AnnotateSection({ tool, setTool }: AnnotateSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Text" icon="T" active={tool === "text"} onClick={() => setTool("text")} shortcut="T" dragToolId="text" compact />
      <ToolBtn label="M-Text" icon="¶" active={tool === "mtext"} onClick={() => setTool("mtext")} compact />
      <ToolBtn label="Dim" icon="📏" active={tool === "dimension"} onClick={() => setTool("dimension")} shortcut="D" dragToolId="dimension" compact />
      <ToolBtn label="Linear" icon="⊢" active={tool === "dim-linear"} onClick={() => setTool("dim-linear")} compact />
      <ToolBtn label="Angular" icon="∠" active={tool === "dim-angular"} onClick={() => setTool("dim-angular")} compact />
      <ToolBtn label="Leader" icon="➤" active={tool === "leader"} onClick={() => setTool("leader")} dragToolId="leader" compact />
      <ToolBtn label="Mark No." icon="#" active={tool === "mark"} onClick={() => setTool("mark")} compact />
    </div>
  );
}
