import { useMemo } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { getDefaultPsets } from "../../bim/defaultPsets";
import type { BimPropertySet, BimPropertyValue, IfcEntityType } from "../../../types";

// Map archType → IfcEntityType
const ARCH_TO_IFC: Record<string, IfcEntityType> = {
  wall:               "IfcWall",
  door:               "IfcDoor",
  window:             "IfcWindow",
  floor:              "IfcSlab",
  stair:              "IfcStair",
  column:             "IfcColumn",
  "foundation-strip": "IfcFooting",
  "foundation-spread":"IfcFooting",
  "foundation-pile":  "IfcPile",
  "foundation-raft":  "IfcSlab",
  "grade-beam":       "IfcBeam",
};

export function BimPropertiesPanel() {
  const selectedIds        = useDrawingStore((s) => s.selectedElementIds);
  const elements           = useDrawingStore((s) => s.elements);
  const elementPsets       = useDrawingStore((s) => s.elementPsets);
  const quantityCache      = useDrawingStore((s) => s.quantityCache);
  const updatePsetProperty = useDrawingStore((s) => s.updatePsetProperty);

  const selectedId = selectedIds[0];
  const el = selectedId ? elements.find((e) => e.id === selectedId) : null;

  const ifcType: IfcEntityType | undefined = el
    ? (el.ifcType ?? (el.archType ? ARCH_TO_IFC[el.archType] : undefined))
    : undefined;

  const psets: BimPropertySet[] = useMemo(() => {
    if (!el) return [];
    const stored = elementPsets[el.id];
    if (stored && stored.length > 0) return stored;
    return ifcType ? getDefaultPsets(ifcType) : [];
  }, [el, elementPsets, ifcType]);

  const quantities = el ? quantityCache[el.id] : undefined;

  if (!el) {
    return (
      <div className="p-4 text-slate-500 text-xs text-center">
        Chọn một element để xem BIM properties
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-slate-300 font-semibold">{ifcType ?? el.archType ?? el.type}</div>
          {el.bimGuid && <div className="text-slate-600 font-mono text-[9px]">{String(el.bimGuid)}</div>}
        </div>
        <span className="bg-blue-900/60 text-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
          BIM
        </span>
      </div>

      {/* Property Sets */}
      {psets.map((pset) => (
        <div key={pset.name} className="flex flex-col gap-1.5">
          <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-700 pb-1">
            {pset.name}
          </div>
          {Object.entries(pset.properties).map(([key, prop]) => (
            <PropertyRow
              key={key}
              label={key}
              prop={prop}
              onChange={(val) => updatePsetProperty(el.id, pset.name, key, val)}
            />
          ))}
        </div>
      ))}

      {/* Quantities (read-only, auto-computed) */}
      {quantities && Object.keys(quantities).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-700 pb-1">
            Qto_BaseQuantities (auto)
          </div>
          {(Object.entries(quantities) as [string, number | undefined][]).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-slate-400">{key}</span>
              <span className="text-slate-200 font-mono">
                {typeof val === "number" ? val.toFixed(3) : String(val)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyRow({
  label,
  prop,
  onChange,
}: {
  label: string;
  prop: BimPropertyValue;
  onChange: (val: BimPropertyValue) => void;
}) {
  const inputClass =
    "bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-100 focus:outline-none focus:border-blue-400 text-xs w-full";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400 shrink-0 w-28 truncate" title={label}>{label}</span>
      <div className="flex-1">
        {prop.type === "boolean" && (
          <button
            onClick={() => onChange({ ...prop, value: !prop.value })}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              prop.value ? "bg-green-700 text-green-200" : "bg-slate-600 text-slate-400"
            }`}
          >
            {prop.value ? "Yes" : "No"}
          </button>
        )}
        {prop.type === "string" && (
          <input
            type="text"
            value={prop.value}
            onChange={(e) => onChange({ ...prop, value: e.target.value })}
            className={inputClass}
          />
        )}
        {prop.type === "number" && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={prop.value}
              onChange={(e) => onChange({ ...prop, value: Number(e.target.value) })}
              className={inputClass}
            />
            {prop.unit && <span className="text-slate-500 text-[9px] shrink-0">{prop.unit}</span>}
          </div>
        )}
        {prop.type === "enum" && (
          <select
            value={prop.value}
            onChange={(e) => onChange({ ...prop, value: e.target.value })}
            className={inputClass}
          >
            {prop.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
