import { useState } from "react";
import { generateDrawingFromPrompt } from "../services/aiDrawingService";
import { useDrawingStore } from "../stores/drawingStore";
import { BLOCK_CATALOG, CATEGORY_META, type BlockCategory } from "../data/blockLibrary";
import { getDroppedToolType } from "../canvas/drop";

import { SectionHeader } from "./ui/SectionHeader";
import { ToolBtn } from "./ui/ToolBtn";
import { Divider } from "./ui/Divider";
import { ToggleRow } from "./ui/ToggleRow";


// ─── Props ────────────────────────────────────────────────────────────────────
interface CadSidebarProps {
  tool: string;
  setTool: (t: string) => void;
  layers: any[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  addLayer: () => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  gridVisible: boolean;
  setGridVisible: (v: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  orthoEnabled: boolean;
  setOrthoEnabled: (v: boolean) => void;
  zoom: number;
  setZoom: (z: number) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (p: { x: number; y: number }) => void;
  onImportDxf?: () => void;
  onImportJson?: () => void;
  onExportSvg?: () => void;
  onExportDxf?: () => void;
  onExportPng?: () => void;
  onExportJson?: () => void;
  insertBlock: (id: string, x: number, y: number) => void;
  selectedElement?: any;
  aiPrompt?: string;
  setAiPrompt?: (s: string) => void;
  onAiGenerate?: () => void;
  addElements?: (els: any[]) => void;
  authToken?: string;
  onMirrorH?: () => void;
  onMirrorV?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CadSidebar({
  tool,
  setTool,
  layers,
  activeLayerId,
  setActiveLayer,
  addLayer,
  toggleLayerVisibility,
  toggleLayerLock,
  deleteLayer,
  renameLayer,
  gridVisible,
  setGridVisible,
  snapEnabled,
  setSnapEnabled,
  orthoEnabled,
  setOrthoEnabled,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  onImportDxf,
  onImportJson,
  onExportSvg,
  onExportDxf,
  onExportPng,
  onExportJson,
  insertBlock,
  selectedElement,
  aiPrompt = "",
  setAiPrompt,
  onAiGenerate,
  addElements,
  authToken,
  onMirrorH,
  onMirrorV,
}: CadSidebarProps) {

  const [aiInput, setAiInput] = useState(aiPrompt);
  const [layerEditId, setLayerEditId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [blockCategory, setBlockCategory] = useState<BlockCategory>("structural");
  const setCurrentArchitecturalPlan = useDrawingStore((s) => s.setCurrentArchitecturalPlan);

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiStatus({ type: "info", msg: "Generating..." });
    const result = await generateDrawingFromPrompt(aiInput.trim(), authToken);
    setAiLoading(false);
    if (result.error) {
      setAiStatus({ type: "error", msg: result.error });
    } else if (result.elements.length === 0) {
      setAiStatus({ type: "error", msg: "AI returned no elements. Try a clearer prompt." });
    } else {
      if (result.plan) setCurrentArchitecturalPlan(result.plan);
      addElements?.(result.elements);
      setAiStatus({ type: "success", msg: `✅ Added ${result.elements.length} element(s) to canvas.` });
    }
    setTimeout(() => setAiStatus(null), 5000);
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <aside className="w-[220px] bg-[#0D1117] border-r border-slate-200 dark:border-[#1E293B] transition-colors duration-300 flex flex-col h-full overflow-y-auto text-slate-700 dark:text-gray-300 transition-colors duration-300 select-none">

      {/* ─── 0. ARCHITECTURE ─────────────────────────────────────────────── */}
      <SectionHeader label="Architecture" color="bg-rose-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Wall" icon="▤" active={tool === "wall"} onClick={() => setTool("wall")} shortcut="W" dragToolId="wall" />
        <ToolBtn label="Door" icon="🚪" active={tool === "door"} onClick={() => setTool("door")} shortcut="DO" dragToolId="door" />
        <ToolBtn label="Window" icon="🪟" active={tool === "window"} onClick={() => setTool("window")} shortcut="WI" dragToolId="window" />
        <ToolBtn label="Room Label" icon="🏷" active={tool === "room-label"} onClick={() => setTool("room-label")} shortcut="RL" dragToolId="room-label" />
        <ToolBtn label="Stair" icon="🪜" active={tool === "stair"} onClick={() => setTool("stair")} shortcut="ST" dragToolId="stair" />
      </div>

      <Divider />

      {/* ─── 1. DRAW ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Draw" color="bg-blue-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Select" icon="↖" active={tool === "select"} onClick={() => setTool("select")} shortcut="V" />
        <ToolBtn label="Line" icon="╱" active={tool === "line"} onClick={() => setTool("line")} shortcut="L" dragToolId="line" />
        <ToolBtn label="Polyline" icon="⌐" active={tool === "polyline"} onClick={() => setTool("polyline")} shortcut="PL" dragToolId="polyline" />
        <ToolBtn label="Rectangle" icon="▭" active={tool === "rectangle"} onClick={() => setTool("rectangle")} shortcut="REC" dragToolId="rectangle" />
        <ToolBtn label="Circle" icon="○" active={tool === "circle"} onClick={() => setTool("circle")} shortcut="C" dragToolId="circle" />
        <ToolBtn label="Arc" icon="⌒" active={tool === "arc"} onClick={() => setTool("arc")} shortcut="A" dragToolId="arc" />
        <ToolBtn label="Polygon" icon="⬡" active={tool === "polygon"} onClick={() => setTool("polygon")} dragToolId="polygon" />
        <ToolBtn label="Ellipse" icon="⬭" active={tool === "ellipse"} onClick={() => setTool("ellipse")} dragToolId="ellipse" />
        <ToolBtn label="Spline" icon="∿" active={tool === "spline"} onClick={() => setTool("spline")} disabled />
        <ToolBtn label="Hatch" icon="▓" active={tool === "hatch"} onClick={() => setTool("hatch")} shortcut="H" dragToolId="hatch" />
      </div>

      <Divider />

      {/* ─── 2. MODIFY ────────────────────────────────────────────────────── */}
      <SectionHeader label="Modify" color="bg-yellow-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Move" icon="✥" active={tool === "move"} onClick={() => setTool("move")} shortcut="M" />
        <ToolBtn label="Copy" icon="⧉" active={tool === "copy"} onClick={() => setTool("copy")} shortcut="CO" />
        <ToolBtn label="Rotate" icon="↻" active={tool === "rotate"} onClick={() => setTool("rotate")} shortcut="RO" />
        <ToolBtn label="Scale" icon="⤢" active={tool === "scale"} onClick={() => setTool("scale")} shortcut="SC" />
        <div className="flex gap-1 px-1">
          <button onClick={onMirrorH} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors" title="Mirror Horizontal (over Y axis)">⇔ Mir H</button>
          <button onClick={onMirrorV} className="flex-1 text-[10px] font-bold py-1.5 rounded border border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors" title="Mirror Vertical (over X axis)">⇕ Mir V</button>
        </div>
        <ToolBtn label="Offset" icon="⊟" active={tool === "offset"} onClick={() => setTool("offset")} shortcut="O" disabled />
        <ToolBtn label="Trim" icon="✂" active={tool === "trim"} onClick={() => setTool("trim")} shortcut="TR" disabled />
        <ToolBtn label="Extend" icon="↔" active={tool === "extend"} onClick={() => setTool("extend")} shortcut="EX" disabled />
        <ToolBtn label="Stretch" icon="⤡" active={tool === "stretch"} onClick={() => setTool("stretch")} disabled />
        <ToolBtn label="Fillet" icon="⌔" active={tool === "fillet"} onClick={() => setTool("fillet")} shortcut="F" disabled />
        <ToolBtn label="Chamfer" icon="⊿" active={tool === "chamfer"} onClick={() => setTool("chamfer")} shortcut="CHA" disabled />
      </div>

      <Divider />

      {/* ─── 3. ANNOTATE ──────────────────────────────────────────────────── */}
      <SectionHeader label="Annotate" color="bg-green-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Text" icon="T" active={tool === "text"} onClick={() => setTool("text")} shortcut="T" dragToolId="text" />
        <ToolBtn label="Multiline Text" icon="¶" active={tool === "mtext"} onClick={() => setTool("mtext")} disabled />
        <ToolBtn label="Dimension" icon="📏" active={tool === "dimension"} onClick={() => setTool("dimension")} shortcut="D" dragToolId="dimension" />
        <ToolBtn label="Linear Dim" icon="⊢" active={tool === "dim-linear"} onClick={() => setTool("dim-linear")} disabled />
        <ToolBtn label="Angular Dim" icon="∠" active={tool === "dim-angular"} onClick={() => setTool("dim-angular")} disabled />
        <ToolBtn label="Leader" icon="➤" active={tool === "leader"} onClick={() => setTool("leader")} dragToolId="leader" />
        <ToolBtn label="Mark Number" icon="#" active={tool === "mark"} onClick={() => setTool("mark")} disabled />
      </div>

      <Divider />

      {/* ─── 4. BLOCKS ────────────────────────────────────────────────────── */}
      <SectionHeader label="Blocks" color="bg-purple-500" />
      <div className="px-1 space-y-0.5 mb-2">
        <ToolBtn label="Insert Block" icon="⊞" active={tool === "insert"} onClick={() => setTool("insert")} shortcut="I" />
        <ToolBtn label="Create Block" icon="⊡" active={false} onClick={() => {}} disabled />
        <ToolBtn label="Explode" icon="⊠" active={false} onClick={() => {}} disabled />
      </div>
      {/* Category tabs */}
      <div className="px-2 pb-1">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CATEGORY_META) as BlockCategory[]).map((cat) => {
            const m = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                onClick={() => setBlockCategory(cat)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border transition-colors ${
                  blockCategory === cat
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    : "bg-transparent border-slate-200 dark:border-[#1E293B] text-gray-600 hover:text-gray-300 hover:border-slate-500"
                }`}
                title={m.label}
              >
                {m.icon}
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-400 mt-1 px-0.5">{CATEGORY_META[blockCategory].label} — drag or click to place</p>
      </div>
      {/* Block grid for active category */}
      <div className="px-2 pb-2">
        <div className="grid grid-cols-3 gap-1 max-h-52 overflow-y-auto pr-0.5">
          {BLOCK_CATALOG.filter(b => b.category === blockCategory).map((b) => (
            <button
              key={b.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("blockId", b.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => {
                const cx = (window.innerWidth / 2 - panOffset.x) / zoom;
                const cy = (window.innerHeight / 2 - panOffset.y) / zoom;
                insertBlock(b.id, cx, cy);
              }}
              className="flex flex-col items-center justify-center bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:border-cyan-500/50 hover:bg-cyan-500/5 rounded p-1.5 transition-colors cursor-grab active:cursor-grabbing"
            >
              <span className="text-base leading-none">{b.icon}</span>
              <span className="text-[7px] text-slate-400 dark:text-gray-500 mt-0.5 font-mono text-center leading-tight">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* ─── 5. LAYERS ────────────────────────────────────────────────────── */}
      <SectionHeader label="Layers" color="bg-amber-700" />
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400 dark:text-gray-500 transition-colors duration-300 font-mono">{layers.length} layer(s)</span>
          <button
            onClick={addLayer}
            className="text-[9px] font-bold text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded hover:bg-cyan-500/10 transition-colors"
          >
            + NEW
          </button>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                activeLayerId === layer.id
                  ? "bg-slate-200 dark:bg-[#1E293B] transition-colors duration-300 border border-gray-600"
                  : "hover:bg-slate-100 dark:bg-[#11161D] transition-colors duration-300 border border-transparent"
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                className={`text-xs transition-colors ${layer.visible ? "text-cyan-400" : "text-gray-600"}`}
              >
                {layer.visible ? "👁" : "○"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                className={`text-xs transition-colors ${layer.locked ? "text-red-400" : "text-gray-600"}`}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: layer.style?.strokeColor || "#38BDF8" }}
              />
              {layerEditId === layer.id ? (
                <input
                  autoFocus
                  defaultValue={layer.name}
                  onBlur={(e) => { renameLayer(layer.id, e.target.value); setLayerEditId(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { renameLayer(layer.id, e.currentTarget.value); setLayerEditId(null); } }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-white dark:bg-[#0B0E14] transition-colors duration-300 text-xs text-slate-900 dark:text-white transition-colors duration-300 font-mono border border-cyan-500/50 rounded px-1 outline-none"
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); setLayerEditId(layer.id); }}
                  className={`flex-1 text-[11px] font-mono truncate ${activeLayerId === layer.id ? "text-slate-900 dark:text-white transition-colors duration-300" : "text-slate-500 dark:text-gray-400 transition-colors duration-300"}`}
                >
                  {layer.name}
                </span>
              )}
              {layers.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                  className="text-[9px] text-gray-600 hover:text-red-400 px-0.5 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ─── 6. PROPERTIES ────────────────────────────────────────────────── */}
      <SectionHeader label="Properties" color="bg-red-500" />
      <div className="px-3 pb-2 space-y-2">
        {selectedElement ? (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "X", value: selectedElement.x?.toFixed(1) ?? "—" },
                { label: "Y", value: selectedElement.y?.toFixed(1) ?? "—" },
                { label: "W", value: selectedElement.width?.toFixed(1) ?? "—" },
                { label: "H", value: selectedElement.height?.toFixed(1) ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-600 uppercase">{label}</span>
                  <div className="bg-white dark:bg-[#0B0E14] transition-colors duration-300 border border-slate-200 dark:border-[#1E293B] transition-colors duration-300 rounded px-2 py-1 text-[10px] font-mono text-cyan-300">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-gray-600 uppercase mb-1">Layer</span>
              <div className="bg-white dark:bg-[#0B0E14] transition-colors duration-300 border border-slate-200 dark:border-[#1E293B] transition-colors duration-300 rounded px-2 py-1 text-[10px] font-mono text-cyan-300">
                {activeLayer?.name ?? "—"}
              </div>
            </div>
          </>
        ) : (
          <div className="text-[10px] text-gray-600 italic py-1 px-1">
            Select an object to inspect
          </div>
        )}
      </div>



      <Divider />

      {/* ─── 9. AI ASSISTANT ──────────────────────────────────────────────── */}
      <SectionHeader label="AI Assistant" color="bg-cyan-500" />
      <div className="px-3 pb-2">
        <div className="bg-gradient-to-b from-cyan-950/30 to-[#0B0E14] border border-cyan-500/20 rounded-lg p-3 space-y-2">
          <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">🔥 AI-Powered CAD</p>
          <textarea
            value={aiInput}
            onChange={(e) => { setAiInput(e.target.value); setAiPrompt?.(e.target.value); }}
            placeholder="Describe what to draw...&#10;e.g. 'a 10x8m apartment with 2 bedrooms'"
            rows={3}
            className="w-full bg-white dark:bg-[#0B0E14] transition-colors duration-300 border border-slate-200 dark:border-[#1E293B] transition-colors duration-300 focus:border-cyan-500/50 rounded p-2 text-[10px] font-mono text-gray-200 placeholder-gray-600 outline-none resize-none transition-colors"
          />

          {/* Status bar */}
          {aiStatus && (
            <div className={`text-[9px] font-mono px-2 py-1.5 rounded border ${
              aiStatus.type === "success" ? "bg-green-950/40 border-green-500/30 text-green-400" :
              aiStatus.type === "error"   ? "bg-red-950/40 border-red-500/30 text-red-400" :
              "bg-cyan-950/40 border-cyan-500/30 text-cyan-400"
            }`}>
              {aiStatus.msg}
            </div>
          )}

          <div className="flex gap-1">
            <button
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiInput.trim()}
              className={`flex-1 text-slate-900 text-[9px] font-black py-1.5 rounded transition-colors ${
                aiLoading || !aiInput.trim()
                  ? "bg-cyan-800 cursor-not-allowed"
                  : "bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
              }`}
            >
              {aiLoading ? "⏳ Thinking..." : "⚡ GENERATE"}
            </button>
            <button
              onClick={() => { setAiInput(""); setAiStatus(null); }}
              className="bg-slate-200 dark:bg-[#1E293B] transition-colors duration-300 hover:bg-[#2A3441] text-slate-700 dark:text-gray-300 transition-colors duration-300 text-[9px] font-bold px-2 py-1.5 rounded transition-colors"
              title="Clear"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {["10x8m apartment", "2 bedrooms + bathroom", "open office 20x15m", "floor plan with hallway"].map((s) => (
              <button
                key={s}
                onClick={() => setAiInput(s)}
                className="text-[8px] bg-slate-200 dark:bg-[#1E293B] transition-colors duration-300 hover:bg-cyan-500/10 hover:text-cyan-400 text-slate-400 dark:text-gray-500 transition-colors duration-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#1E293B] transition-colors duration-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
