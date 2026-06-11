import {
  MousePointer2, RectangleHorizontal, DoorOpen, Square, Circle,
  Move, Copy, RotateCcw, Maximize2, Scissors, ArrowLeftRight,
  Expand, Triangle, Type, AlignLeft, Ruler, Hash, ArrowUpRight,
  Waypoints, Grid3X3, Hexagon, Pen, Spline, Hand
} from "lucide-react";
import { ToolBtn } from "../ui/ToolBtn";

const ic = (I: React.ComponentType<{ className?: string }>) => <I className="w-3.5 h-3.5" />;

// ─── Architecture Section ─────────────────────────────────────────────────────
interface ArchitectureSectionProps {
  tool: string;
  setTool: (t: string) => void;
}

export function ArchitectureSection({ tool, setTool }: ArchitectureSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
      <ToolBtn label="Wall" icon={ic(RectangleHorizontal)} active={tool === "wall"} onClick={() => setTool("wall")} compact />
      <ToolBtn label="Door" icon={ic(DoorOpen)} active={tool === "door"} onClick={() => setTool("door")} compact />
      <ToolBtn label="Window" icon={ic(Square)} active={tool === "window"} onClick={() => setTool("window")} compact />
      <ToolBtn label="Room" icon={ic(Square)} active={tool === "room"} onClick={() => setTool("room")} compact />
      <ToolBtn label="Stair" icon={
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h4v-4h4v-4h4v-4h4v-4h2M3 21V3" />
        </svg>
      } active={tool === "stair"} onClick={() => setTool("stair")} compact />
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
      <ToolBtn label="Select" icon={ic(MousePointer2)} active={tool === "select"} onClick={() => setTool("select")} shortcut="V" compact />
      <ToolBtn label="Line" icon={ic(Pen)} active={tool === "line"} onClick={() => setTool("line")} shortcut="L" dragToolId="line" compact />
      <ToolBtn label="P-Line" icon={ic(Waypoints)} active={tool === "polyline"} onClick={() => setTool("polyline")} shortcut="PL" dragToolId="polyline" compact />
      <ToolBtn label="Rect" icon={ic(Square)} active={tool === "rectangle"} onClick={() => setTool("rectangle")} shortcut="REC" dragToolId="rectangle" compact />
      <ToolBtn label="Circle" icon={ic(Circle)} active={tool === "circle"} onClick={() => setTool("circle")} shortcut="C" dragToolId="circle" compact />
      <ToolBtn label="Arc" icon={ic(Spline)} active={tool === "arc"} onClick={() => setTool("arc")} shortcut="A" dragToolId="arc" compact />
      <ToolBtn label="Polygon" icon={ic(Hexagon)} active={tool === "polygon"} onClick={() => setTool("polygon")} dragToolId="polygon" compact />
      <ToolBtn label="Ellipse" icon={
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <ellipse cx="12" cy="12" rx="10" ry="6" strokeWidth="2" />
        </svg>
      } active={tool === "ellipse"} onClick={() => setTool("ellipse")} dragToolId="ellipse" compact />
      <ToolBtn label="Spline" icon={ic(Spline)} active={tool === "spline"} onClick={() => setTool("spline")} compact />
      <ToolBtn label="Hatch" icon={ic(Grid3X3)} active={tool === "hatch"} onClick={() => setTool("hatch")} shortcut="H" dragToolId="hatch" compact />
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
  const btnCls = "flex-1 text-xs font-semibold py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600/30 transition-colors";
  return (
    <div className="px-2 py-1 space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Move" icon={ic(Move)} active={tool === "move"} onClick={() => setTool("move")} shortcut="M" compact />
        <ToolBtn label="Copy" icon={ic(Copy)} active={tool === "copy"} onClick={() => setTool("copy")} shortcut="CO" compact />
        <ToolBtn label="Rotate" icon={ic(RotateCcw)} active={tool === "rotate"} onClick={() => setTool("rotate")} shortcut="RO" compact />
        <ToolBtn label="Scale" icon={ic(Maximize2)} active={tool === "scale"} onClick={() => setTool("scale")} shortcut="SC" compact />
      </div>
      <div className="flex gap-1 px-1">
        <button onClick={onMirrorH} className={btnCls} title="Mirror Horizontal">⇔ Mir H</button>
        <button onClick={onMirrorV} className={btnCls} title="Mirror Vertical">⇕ Mir V</button>
      </div>
      <div className="px-1">
        <button onClick={onRotate90} className={`w-full ${btnCls}`} title="Rotate 90° CW">↷ Rot 90</button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ToolBtn label="Offset" icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 6h10M4 18h10" />
          </svg>
        } active={tool === "offset"} onClick={() => setTool("offset")} shortcut="O" compact />
        <ToolBtn label="Trim" icon={ic(Scissors)} active={tool === "trim"} onClick={() => setTool("trim")} shortcut="TR" compact />
        <ToolBtn label="Extend" icon={ic(ArrowLeftRight)} active={tool === "extend"} onClick={() => setTool("extend")} shortcut="EX" compact />
        <ToolBtn label="Stretch" icon={ic(Expand)} active={tool === "stretch"} onClick={() => setTool("stretch")} compact />
        <ToolBtn label="Fillet" icon={
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20V8a4 4 0 014-4h8" />
          </svg>
        } active={tool === "fillet"} onClick={() => setTool("fillet")} shortcut="F" compact />
        <ToolBtn label="Chamfer" icon={ic(Triangle)} active={tool === "chamfer"} onClick={() => setTool("chamfer")} shortcut="CHA" compact />
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
      <ToolBtn label="Text" icon={ic(Type)} active={tool === "text"} onClick={() => setTool("text")} shortcut="T" dragToolId="text" compact />
      <ToolBtn label="M-Text" icon={ic(AlignLeft)} active={tool === "mtext"} onClick={() => setTool("mtext")} compact />
      <ToolBtn label="Dim" icon={ic(Ruler)} active={tool === "dimension"} onClick={() => setTool("dimension")} shortcut="D" dragToolId="dimension" compact />
      <ToolBtn label="Linear" icon={ic(Ruler)} active={tool === "dim-linear"} onClick={() => setTool("dim-linear")} compact />
      <ToolBtn label="Angular" icon={ic(Triangle)} active={tool === "dim-angular"} onClick={() => setTool("dim-angular")} compact />
      <ToolBtn label="Leader" icon={ic(ArrowUpRight)} active={tool === "leader"} onClick={() => setTool("leader")} dragToolId="leader" compact />
      <ToolBtn label="Mark No." icon={ic(Hash)} active={tool === "mark"} onClick={() => setTool("mark")} compact />
    </div>
  );
}
