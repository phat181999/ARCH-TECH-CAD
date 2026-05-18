import { useState } from "react";
import { generateDrawingFromPrompt } from "../services/aiDrawingService";

// ─── Icons (inline SVG paths) ────────────────────────────────────────────────
const Icon = ({ d, size = 4 }: { d: string; size?: number }) => (
  <svg className={`w-${size} h-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 pt-4 pb-1.5`}>
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className="text-[9px] font-black tracking-widest uppercase text-gray-400">{label}</span>
    </div>
  );
}

// ─── Tool Button ──────────────────────────────────────────────────────────────
function ToolBtn({
  label,
  icon,
  active,
  onClick,
  shortcut,
  disabled,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded transition-all text-left group ${
        active
          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
          : disabled
          ? "text-gray-600 cursor-not-allowed"
          : "text-gray-400 hover:bg-[#1E293B] hover:text-gray-200 border border-transparent"
      }`}
    >
      <span className="text-sm w-4 text-center flex-shrink-0">{icon}</span>
      <span className="text-[11px] font-semibold flex-1">{label}</span>
      {shortcut && (
        <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${active ? "bg-cyan-500/20 text-cyan-400" : "bg-[#1E293B] text-gray-600 group-hover:text-gray-400"}`}>
          {shortcut}
        </span>
      )}
    </button>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-[#1E293B] mx-3 my-2" />;
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <button
        onClick={onChange}
        className={`relative w-8 h-4 rounded-full transition-colors ${value ? "bg-cyan-500" : "bg-[#1E293B]"}`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

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
  setPanOffset: (p: { x: number; y: number }) => void;
  onImportDxf?: () => void;
  onExportSvg?: () => void;
  onExportDxf?: () => void;
  onExportPng?: () => void;
  insertBlock: (id: string, x: number, y: number) => void;
  selectedElement?: any;
  aiPrompt?: string;
  setAiPrompt?: (s: string) => void;
  onAiGenerate?: () => void;
  addElements?: (els: any[]) => void;
  authToken?: string;
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
  setPanOffset,
  onImportDxf,
  onExportSvg,
  onExportDxf,
  onExportPng,
  insertBlock,
  selectedElement,
  aiPrompt = "",
  setAiPrompt,
  onAiGenerate,
  addElements,
  authToken,
}: CadSidebarProps) {
  const [snapEndpoint, setSnapEndpoint] = useState(true);
  const [snapMidpoint, setSnapMidpoint] = useState(true);
  const [snapCenter, setSnapCenter] = useState(true);
  const [snapIntersection, setSnapIntersection] = useState(false);
  const [aiInput, setAiInput] = useState(aiPrompt);
  const [layerEditId, setLayerEditId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

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
      addElements?.(result.elements);
      setAiStatus({ type: "success", msg: `✅ Added ${result.elements.length} element(s) to canvas.` });
    }
    setTimeout(() => setAiStatus(null), 5000);
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <aside className="w-[220px] bg-[#0D1117] border-r border-[#1E293B] flex flex-col h-full overflow-y-auto text-gray-300 select-none">

      {/* ─── 1. DRAW ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Draw" color="bg-blue-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Select" icon="↖" active={tool === "select"} onClick={() => setTool("select")} shortcut="V" />
        <ToolBtn label="Line" icon="╱" active={tool === "line"} onClick={() => setTool("line")} shortcut="L" />
        <ToolBtn label="Polyline" icon="⌐" active={tool === "polyline"} onClick={() => setTool("polyline")} shortcut="PL" />
        <ToolBtn label="Rectangle" icon="▭" active={tool === "rectangle"} onClick={() => setTool("rectangle")} shortcut="REC" />
        <ToolBtn label="Circle" icon="○" active={tool === "circle"} onClick={() => setTool("circle")} shortcut="C" />
        <ToolBtn label="Arc" icon="⌒" active={tool === "arc"} onClick={() => setTool("arc")} shortcut="A" />
        <ToolBtn label="Polygon" icon="⬡" active={tool === "polygon"} onClick={() => setTool("polygon")} />
        <ToolBtn label="Ellipse" icon="⬭" active={tool === "ellipse"} onClick={() => setTool("ellipse")} />
        <ToolBtn label="Spline" icon="∿" active={tool === "spline"} onClick={() => setTool("spline")} disabled />
        <ToolBtn label="Hatch" icon="▓" active={tool === "hatch"} onClick={() => setTool("hatch")} shortcut="H" />
      </div>

      <Divider />

      {/* ─── 2. MODIFY ────────────────────────────────────────────────────── */}
      <SectionHeader label="Modify" color="bg-yellow-500" />
      <div className="px-1 space-y-0.5">
        <ToolBtn label="Move" icon="✥" active={tool === "move"} onClick={() => setTool("move")} shortcut="M" />
        <ToolBtn label="Copy" icon="⧉" active={tool === "copy"} onClick={() => setTool("copy")} shortcut="CO" />
        <ToolBtn label="Rotate" icon="↻" active={tool === "rotate"} onClick={() => setTool("rotate")} shortcut="RO" />
        <ToolBtn label="Scale" icon="⤢" active={tool === "scale"} onClick={() => setTool("scale")} shortcut="SC" />
        <ToolBtn label="Mirror" icon="⇔" active={tool === "mirror"} onClick={() => setTool("mirror")} shortcut="MI" disabled />
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
        <ToolBtn label="Text" icon="T" active={tool === "text"} onClick={() => setTool("text")} shortcut="T" />
        <ToolBtn label="Multiline Text" icon="¶" active={tool === "mtext"} onClick={() => setTool("mtext")} disabled />
        <ToolBtn label="Dimension" icon="📏" active={tool === "dimension"} onClick={() => setTool("dimension")} shortcut="D" />
        <ToolBtn label="Linear Dim" icon="⊢" active={tool === "dim-linear"} onClick={() => setTool("dim-linear")} disabled />
        <ToolBtn label="Angular Dim" icon="∠" active={tool === "dim-angular"} onClick={() => setTool("dim-angular")} disabled />
        <ToolBtn label="Leader" icon="➤" active={tool === "leader"} onClick={() => setTool("leader")} />
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
      {/* Block grid */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: "door", icon: "🚪", label: "Door" },
            { id: "window", icon: "🪟", label: "Win" },
            { id: "desk", icon: "🪑", label: "Desk" },
            { id: "chair", icon: "💺", label: "Chair" },
            { id: "bed", icon: "🛏", label: "Bed" },
            { id: "bath", icon: "🛁", label: "Bath" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => insertBlock(b.id, 400, 300)}
              className="flex flex-col items-center justify-center bg-[#11161D] border border-[#1E293B] hover:border-cyan-500/50 hover:bg-cyan-500/5 rounded p-2 transition-colors"
            >
              <span className="text-lg">{b.icon}</span>
              <span className="text-[8px] text-gray-500 mt-0.5 font-mono">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* ─── 5. LAYERS ────────────────────────────────────────────────────── */}
      <SectionHeader label="Layers" color="bg-amber-700" />
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 font-mono">{layers.length} layer(s)</span>
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
                  ? "bg-[#1E293B] border border-gray-600"
                  : "hover:bg-[#11161D] border border-transparent"
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
                  className="flex-1 bg-[#0B0E14] text-xs text-white font-mono border border-cyan-500/50 rounded px-1 outline-none"
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); setLayerEditId(layer.id); }}
                  className={`flex-1 text-[11px] font-mono truncate ${activeLayerId === layer.id ? "text-white" : "text-gray-400"}`}
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
                  <div className="bg-[#0B0E14] border border-[#1E293B] rounded px-2 py-1 text-[10px] font-mono text-cyan-300">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-gray-600 uppercase mb-1">Layer</span>
              <div className="bg-[#0B0E14] border border-[#1E293B] rounded px-2 py-1 text-[10px] font-mono text-cyan-300">
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

      {/* ─── 7. VIEW / NAVIGATION ─────────────────────────────────────────── */}
      <SectionHeader label="View" color="bg-orange-500" />
      <div className="px-1 space-y-0.5 mb-1">
        <ToolBtn label="Pan" icon="✋" active={tool === "pan"} onClick={() => setTool("pan")} shortcut="P" />
      </div>
      <div className="px-3 pb-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom / 1.25))}
            className="flex-1 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] text-gray-300 text-xs font-bold py-1 rounded transition-colors"
          >
            − Zoom Out
          </button>
          <button
            onClick={() => setZoom(zoom * 1.25)}
            className="flex-1 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] text-gray-300 text-xs font-bold py-1 rounded transition-colors"
          >
            + Zoom In
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
            className="flex-1 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] text-gray-300 text-[10px] font-bold py-1 rounded transition-colors"
          >
            Fit Screen
          </button>
          <button
            onClick={() => setZoom(1)}
            className="flex-1 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] text-gray-300 text-[10px] font-bold py-1 rounded transition-colors"
          >
            Reset View
          </button>
        </div>
        <div className="flex items-center justify-between bg-[#0B0E14] border border-[#1E293B] rounded px-2 py-1">
          <span className="text-[9px] text-gray-600 font-mono uppercase">Zoom</span>
          <span className="text-[11px] font-mono font-bold text-cyan-400">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <Divider />

      {/* ─── 8. SNAP / GRID ───────────────────────────────────────────────── */}
      <SectionHeader label="Snap / Grid" color="bg-amber-800" />
      <div className="px-2 pb-2 space-y-0.5">
        <ToggleRow label="Snap" icon="⊕" value={snapEnabled} onChange={() => setSnapEnabled(!snapEnabled)} />
        <ToggleRow label="Grid" icon="⊞" value={gridVisible} onChange={() => setGridVisible(!gridVisible)} />
        <ToggleRow label="Ortho" icon="⊣" value={orthoEnabled} onChange={() => setOrthoEnabled(!orthoEnabled)} />
        <div className="pt-1 pl-1">
          <p className="text-[8px] font-bold text-gray-600 uppercase tracking-wider mb-1">Object Snap</p>
          <div className="space-y-0.5">
            <ToggleRow label="Endpoint" icon="◉" value={snapEndpoint} onChange={() => setSnapEndpoint(!snapEndpoint)} />
            <ToggleRow label="Midpoint" icon="◈" value={snapMidpoint} onChange={() => setSnapMidpoint(!snapMidpoint)} />
            <ToggleRow label="Center" icon="◎" value={snapCenter} onChange={() => setSnapCenter(!snapCenter)} />
            <ToggleRow label="Intersection" icon="✕" value={snapIntersection} onChange={() => setSnapIntersection(!snapIntersection)} />
          </div>
        </div>
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
            className="w-full bg-[#0B0E14] border border-[#1E293B] focus:border-cyan-500/50 rounded p-2 text-[10px] font-mono text-gray-200 placeholder-gray-600 outline-none resize-none transition-colors"
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
              className="bg-[#1E293B] hover:bg-[#2A3441] text-gray-300 text-[9px] font-bold px-2 py-1.5 rounded transition-colors"
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
                className="text-[8px] bg-[#1E293B] hover:bg-cyan-500/10 hover:text-cyan-400 text-gray-500 px-1.5 py-0.5 rounded border border-[#1E293B] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* ─── 10. IMPORT / EXPORT ──────────────────────────────────────────── */}
      <SectionHeader label="Import / Export" color="bg-yellow-600" />
      <div className="px-3 pb-4 space-y-2">
        <button
          onClick={onImportDxf}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] rounded text-[10px] font-bold text-gray-300 transition-colors"
        >
          <span>📥</span> Import DXF
        </button>
        <div className="grid grid-cols-2 gap-1">
          {[
            { label: "PNG", icon: "🖼", onClick: onExportPng },
            { label: "SVG", icon: "📐", onClick: onExportSvg },
            { label: "DXF", icon: "📋", onClick: onExportDxf },
            { label: "PDF", icon: "📄", onClick: () => window.print() },
          ].map(({ label, icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex items-center justify-center gap-1 py-2 bg-[#11161D] hover:bg-[#1E293B] border border-[#1E293B] hover:border-cyan-500/30 rounded text-[10px] font-bold text-gray-300 hover:text-cyan-400 transition-colors"
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
