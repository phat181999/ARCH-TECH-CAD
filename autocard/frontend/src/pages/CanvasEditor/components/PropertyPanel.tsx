import React, { useState, useEffect, useRef } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useAuthStore } from "../../../stores/authStore";
import type { DrawingElement, Layer, Style } from "../../../types";

// ── Tiny shared sub-components ───────────────────────────────────────────────

function NumField({ label, value, onChange, disabled }: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-500 dark:text-slate-400 w-8 shrink-0 text-[10px]">{label}</span>
      <input
        type="number"
        value={value !== undefined ? +value.toFixed(1) : ""}
        disabled={disabled}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
      />
    </div>
  );
}

function ColorField({ label, value, onChange, disabled }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const safeHex = value?.startsWith("#") ? value : "#000000";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">{label}</span>
      <input
        type="color"
        value={safeHex}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-slate-300 dark:border-slate-600 shrink-0 disabled:opacity-50"
      />
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-[10px]">{label}</span>
      <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pt-2 pb-0.5 border-t border-slate-200 dark:border-slate-700/50 mt-1">
      {children}
    </p>
  );
}

function LayerSelect({ layerId, layers, onChange, disabled }: {
  layerId: string;
  layers: Layer[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Layer</span>
      <select
        value={layerId}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
      >
        {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </div>
  );
}

function LineTypeSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Line Type</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
        <option value="dashdot">Dash-Dot</option>
      </select>
    </div>
  );
}

// ── Mode panels ───────────────────────────────────────────────────────────────

function NoSelectionPanel({ layers, activeLayerId, setActiveLayer, currentStyle, setStyle, zoom, panOffset, tool, elementCount, disabled }: {
  layers: Layer[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  currentStyle: Style;
  setStyle: (s: Partial<Style>) => void;
  zoom: number;
  panOffset: { x: number; y: number };
  tool: string;
  elementCount: number;
  disabled?: boolean;
}) {
  return (
    <div className="px-3 py-2 space-y-1.5">
      <SectionLabel>Drawing Defaults</SectionLabel>
      <LayerSelect layerId={activeLayerId} layers={layers} onChange={setActiveLayer} disabled={disabled} />
      <ColorField label="Stroke" value={currentStyle.strokeColor} onChange={(v) => setStyle({ strokeColor: v })} disabled={disabled} />
      <ColorField
        label="Fill"
        value={currentStyle.fillColor === "transparent" ? "#ffffff" : currentStyle.fillColor}
        onChange={(v) => setStyle({ fillColor: v })}
        disabled={disabled}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Line W</span>
        <input
          type="range" min="0.5" max="20" step="0.5"
          value={currentStyle.lineWidth}
          disabled={disabled}
          onChange={(e) => setStyle({ lineWidth: parseFloat(e.target.value) })}
          className="flex-1 disabled:opacity-50"
        />
        <span className="text-[10px] font-mono text-slate-400 w-5 text-right">{currentStyle.lineWidth}</span>
      </div>
      <LineTypeSelect value={currentStyle.lineType} onChange={(v) => setStyle({ lineType: v })} disabled={disabled} />

      <SectionLabel>Viewport</SectionLabel>
      <InfoRow label="Zoom" value={`${Math.round(zoom * 100)}%`} />
      <InfoRow label="Origin X" value={Math.round(-panOffset.x / zoom)} />
      <InfoRow label="Origin Y" value={Math.round(-panOffset.y / zoom)} />

      <SectionLabel>Info</SectionLabel>
      <InfoRow label="Tool" value={tool} />
      <InfoRow label="Entities" value={elementCount} />
    </div>
  );
}

function SingleSelectionPanel({ el, layers, updateElement, disabled }: {
  el: DrawingElement;
  layers: Layer[];
  updateElement: (id: string, updates: Partial<DrawingElement>) => void;
  disabled?: boolean;
}) {
  const strokeWidth = el.strokeWidth ?? el.lineWidth ?? 2;
  const isArchBacked = !!el.archType;

  const geomSection = (() => {
    if (isArchBacked) {
      return <p className="text-[10px] text-slate-500 italic">Geometry managed by architectural plan.</p>;
    }
    switch (el.type) {
      case "circle":
        return (
          <>
            <NumField label="Cx" value={el.cx} onChange={(v) => updateElement(el.id, { cx: v })} disabled={disabled} />
            <NumField label="Cy" value={el.cy} onChange={(v) => updateElement(el.id, { cy: v })} disabled={disabled} />
            <NumField label="R" value={el.radius} onChange={(v) => updateElement(el.id, { radius: v })} disabled={disabled} />
          </>
        );
      case "arc":
        return (
          <>
            <NumField label="Cx" value={el.cx} onChange={(v) => updateElement(el.id, { cx: v })} disabled={disabled} />
            <NumField label="Cy" value={el.cy} onChange={(v) => updateElement(el.id, { cy: v })} disabled={disabled} />
            <NumField label="R" value={el.radius} onChange={(v) => updateElement(el.id, { radius: v })} disabled={disabled} />
          </>
        );
      case "line":
        return (
          <>
            <NumField label="X1" value={el.x1} onChange={(v) => updateElement(el.id, { x1: v })} disabled={disabled} />
            <NumField label="Y1" value={el.y1} onChange={(v) => updateElement(el.id, { y1: v })} disabled={disabled} />
            <NumField label="X2" value={el.x2} onChange={(v) => updateElement(el.id, { x2: v })} disabled={disabled} />
            <NumField label="Y2" value={el.y2} onChange={(v) => updateElement(el.id, { y2: v })} disabled={disabled} />
          </>
        );
      case "rectangle":
        return (
          <>
            <NumField label="X" value={el.x} onChange={(v) => updateElement(el.id, { x: v })} disabled={disabled} />
            <NumField label="Y" value={el.y} onChange={(v) => updateElement(el.id, { y: v })} disabled={disabled} />
            <NumField label="W" value={el.width} onChange={(v) => updateElement(el.id, { width: v })} disabled={disabled} />
            <NumField label="H" value={el.height} onChange={(v) => updateElement(el.id, { height: v })} disabled={disabled} />
          </>
        );
      case "text":
        return (
          <>
            <NumField label="X" value={el.x} onChange={(v) => updateElement(el.id, { x: v })} disabled={disabled} />
            <NumField label="Y" value={el.y} onChange={(v) => updateElement(el.id, { y: v })} disabled={disabled} />
          </>
        );
      case "block":
        return (
          <>
            <NumField label="X" value={el.x} onChange={(v) => updateElement(el.id, { x: v })} disabled={disabled} />
            <NumField label="Y" value={el.y} onChange={(v) => updateElement(el.id, { y: v })} disabled={disabled} />
          </>
        );
      default:
        return null;
    }
  })();

  const hasFill = ["rectangle", "circle", "hatch", "ellipse", "polygon"].includes(el.type);

  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded capitalize">{el.type}</span>
        {isArchBacked && <span className="text-[9px] text-amber-400">arch</span>}
      </div>

      <SectionLabel>Style</SectionLabel>
      <LayerSelect layerId={el.layerId} layers={layers} onChange={(v) => updateElement(el.id, { layerId: v })} disabled={disabled} />
      <ColorField label="Stroke" value={el.strokeColor || "#1f2937"} onChange={(v) => updateElement(el.id, { strokeColor: v })} disabled={disabled} />
      {hasFill && (
        <ColorField
          label="Fill"
          value={el.fillColor && el.fillColor !== "transparent" ? el.fillColor : "#ffffff"}
          onChange={(v) => updateElement(el.id, { fillColor: v })}
          disabled={disabled}
        />
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Line W</span>
        <input
          type="range" min="0.5" max="20" step="0.5"
          value={strokeWidth}
          disabled={disabled}
          onChange={(e) => updateElement(el.id, { strokeWidth: parseFloat(e.target.value) })}
          className="flex-1 disabled:opacity-50"
        />
        <span className="text-[10px] font-mono text-slate-400 w-5 text-right">{strokeWidth}</span>
      </div>
      <LineTypeSelect value={el.lineType || "solid"} onChange={(v) => updateElement(el.id, { lineType: v })} disabled={disabled} />

      {geomSection && (
        <>
          <SectionLabel>Geometry</SectionLabel>
          {geomSection}
        </>
      )}
    </div>
  );
}

function MultiSelectionPanel({ selectedElements, layers, updateElements, disabled }: {
  selectedElements: DrawingElement[];
  layers: Layer[];
  updateElements: (ids: string[], updates: Partial<DrawingElement>) => void;
  disabled?: boolean;
}) {
  const ids = selectedElements.map((e) => e.id);
  const [layerId, setLayerId] = useState("");
  const [lineWidth, setLineWidth] = useState(2);

  const apply = (updates: Partial<DrawingElement>) => updateElements(ids, updates);

  return (
    <div className="px-3 py-2 space-y-1.5">
      <InfoRow label="Selected" value={`${selectedElements.length} entities`} />
      <SectionLabel>Batch Style</SectionLabel>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Layer</span>
        <select
          value={layerId}
          disabled={disabled}
          onChange={(e) => { setLayerId(e.target.value); if (e.target.value) apply({ layerId: e.target.value }); }}
          className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
        >
          <option value="">— unchanged —</option>
          {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Stroke</span>
        <input
          type="color"
          defaultValue="#1f2937"
          disabled={disabled}
          onChange={(e) => apply({ strokeColor: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-slate-300 dark:border-slate-600 disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Line W</span>
        <input
          type="range" min="0.5" max="20" step="0.5"
          value={lineWidth}
          disabled={disabled}
          onChange={(e) => { const v = parseFloat(e.target.value); setLineWidth(v); apply({ strokeWidth: v }); }}
          className="flex-1 disabled:opacity-50"
        />
        <span className="text-[10px] font-mono text-slate-400 w-5 text-right">{lineWidth}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 dark:text-slate-400 w-14 shrink-0 text-[10px]">Line Type</span>
        <select
          defaultValue="solid"
          disabled={disabled}
          onChange={(e) => apply({ lineType: e.target.value })}
          className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-900 dark:text-slate-200 outline-none focus:border-cyan-500 disabled:opacity-50"
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="dashdot">Dash-Dot</option>
        </select>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const PropertyPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);

  const elements = useDrawingStore((s) => s.elements);
  const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
  const layers = useDrawingStore((s) => s.layers);
  const activeLayerId = useDrawingStore((s) => s.activeLayerId);
  const setActiveLayer = useDrawingStore((s) => s.setActiveLayer);
  const currentStyle = useDrawingStore((s) => s.currentStyle);
  const setStyle = useDrawingStore((s) => s.setStyle);
  const zoom = useDrawingStore((s) => s.zoom);
  const panOffset = useDrawingStore((s) => s.panOffset);
  const tool = useDrawingStore((s) => s.tool);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const updateElements = useDrawingStore((s) => s.updateElements);

  const currentDrawing = useDrawingStore((s) => s.currentDrawing);
  const permissions = useDrawingStore((s) => s.permissions);
  const { user } = useAuthStore();

  const isOwner = currentDrawing && user && currentDrawing.user_id === user.id;
  const userPermission = permissions.find(
    (p) => p.user_id === user?.id || p.email === user?.email
  );
  const userRole = isOwner ? "owner" : (userPermission?.role || "viewer");
  const isReadOnly = userRole === "viewer";

  const selectedElements = elements.filter((e) => selectedElementIds.includes(e.id));
  const mode = selectedElementIds.length === 0 ? "none" : selectedElementIds.length === 1 ? "single" : "multi";
  const firstEl = selectedElements[0];

  const headerLabel = mode === "none"
    ? "No Selection"
    : mode === "single"
    ? firstEl?.type ?? "?"
    : `${selectedElementIds.length} selected`;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragDistance.current = 0;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      
      const deltaX = Math.abs(newX - position.x);
      const deltaY = Math.abs(newY - position.y);
      dragDistance.current += deltaX + deltaY;

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position.x, position.y]);

  const handleHeaderClick = () => {
    if (dragDistance.current < 5) {
      setCollapsed((c) => !c);
    }
  };

  return (
    <div
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? "grabbing" : "auto"
      }}
      className="absolute top-4 right-4 z-40 pointer-events-auto w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-[background-color,border-color]"
    >
      {/* Header / drag handle */}
      <div
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors select-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onClick={handleHeaderClick}
      >
        <div className="flex items-center gap-1.5 pointer-events-none">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Properties
          </span>
          <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
            {headerLabel}
          </span>
        </div>
        <span className="text-slate-400 text-[9px] pointer-events-none">{collapsed ? "▶" : "▼"}</span>
      </div>

      {!collapsed && (
        <div className="overflow-y-auto max-h-[60vh]">
          {mode === "none" && (
            <NoSelectionPanel
              layers={layers}
              activeLayerId={activeLayerId}
              setActiveLayer={setActiveLayer}
              currentStyle={currentStyle}
              setStyle={setStyle}
              zoom={zoom}
              panOffset={panOffset}
              tool={tool}
              elementCount={elements.length}
              disabled={isReadOnly}
            />
          )}
          {mode === "single" && firstEl && (
            <SingleSelectionPanel el={firstEl} layers={layers} updateElement={updateElement} disabled={isReadOnly} />
          )}
          {mode === "multi" && (
            <MultiSelectionPanel selectedElements={selectedElements} layers={layers} updateElements={updateElements} disabled={isReadOnly} />
          )}
        </div>
      )}
    </div>
  );
};
