/**
 * ThreeDPropertiesPanel — docked at the bottom of the 2D canvas editor.
 * Shows 3D-specific properties of the currently selected element.
 * Editing any value calls updateElement → both 2D and 3D update live.
 */
import { useDrawingStore } from "../stores/drawingStore";
import type { DrawingElement } from "../types";

// Floor finish options for the select input
const FLOOR_FINISH_OPTIONS: { value: string; label: string }[] = [
  { value: "concrete", label: "Concrete" },
  { value: "tile",     label: "Tile" },
  { value: "wood",     label: "Wood" },
  { value: "screed",   label: "Screed" },
];

// Pipe system options for the select input
const PIPE_SYSTEM_OPTIONS: { value: string; label: string }[] = [
  { value: "water",    label: "Water" },
  { value: "hvac",     label: "HVAC" },
  { value: "drain",    label: "Drain" },
  { value: "electric", label: "Electric" },
  { value: "gas",      label: "Gas" },
];

export function ThreeDPropertiesPanel() {
  const selectedElementIds = useDrawingStore((s) => s.selectedElementIds);
  const elements           = useDrawingStore((s) => s.elements);
  const updateElement      = useDrawingStore((s) => s.updateElement);

  const selectedId = selectedElementIds.length > 0 ? selectedElementIds[0] : null;
  const el = selectedId ? elements.find((e) => e.id === selectedId) : null;
  if (!el) return null;

  const isWall    = el.archType === "wall" || el.type === "line";
  const isFloor   = el.archType === "floor";
  const isPipe    = el.archType === "pipe";
  const isStair   = el.archType === "stair";
  const hasPushPull = (el as Record<string, unknown>).pushPullDepth !== undefined;
  const hasHeight   = (el as Record<string, unknown>).wallHeightOverride !== undefined;
  const editedIn3D  = (el as Record<string, unknown>).editedIn3D === true;

  // Only show if the element has any 3D properties
  const has3DProps = isWall || isFloor || isPipe || isStair || hasPushPull || hasHeight || editedIn3D;
  if (!has3DProps) return null;

  const numInput = (
    label: string,
    value: number | undefined,
    key: string,
    unit = "cm",
    min = 0,
    max = 9999,
  ) => (
    <label key={key} className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) =>
            updateElement(el.id, { [key]: Number(e.target.value) } as Partial<DrawingElement>)
          }
          className="w-20 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-400"
        />
        <span className="text-[10px] text-slate-500">{unit}</span>
      </div>
    </label>
  );

  const selectInput = (
    label: string,
    value: string | undefined,
    key: string,
    options: { value: string; label: string }[],
  ) => (
    <label key={key} className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) =>
          updateElement(el.id, { [key]: e.target.value } as Partial<DrawingElement>)
        }
        className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const elData = el as Record<string, unknown>;

  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-slate-800 border-t border-slate-700 text-white shrink-0 overflow-x-auto">
      {/* Header */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">3D Props</span>
        {editedIn3D && (
          <span className="bg-purple-600 text-white text-[8px] font-bold px-1 rounded">3D</span>
        )}
      </div>

      <div className="w-px h-6 bg-slate-600 shrink-0" />

      {/* Wall height override */}
      {isWall && numInput("Wall Height", elData.wallHeightOverride as number | undefined, "wallHeightOverride", "cm", 100, 2000)}

      {/* Elevation (floor, pipe, stair) */}
      {(isFloor || isPipe || isStair) &&
        numInput("Elevation", elData.elevation as number | undefined, "elevation", "cm")}

      {/* Floor finish */}
      {isFloor && selectInput("Finish", elData.floorFinish as string | undefined, "floorFinish", FLOOR_FINISH_OPTIONS)}

      {/* Pipe props */}
      {isPipe && numInput("Diameter", elData.pipeDiameter as number | undefined, "pipeDiameter", "mm", 15, 500)}
      {isPipe && selectInput("System", elData.pipeSystem as string | undefined, "pipeSystem", PIPE_SYSTEM_OPTIONS)}

      {/* Stair props */}
      {isStair && numInput("Step Rise", elData.stairRise as number | undefined, "stairRise", "cm", 10, 30)}
      {isStair && numInput("Total Rise", elData.totalRise as number | undefined, "totalRise", "cm", 100, 1000)}

      {/* Push-pull depth */}
      {hasPushPull &&
        numInput("Extrusion", elData.pushPullDepth as number | undefined, "pushPullDepth", "cm")}
    </div>
  );
}
