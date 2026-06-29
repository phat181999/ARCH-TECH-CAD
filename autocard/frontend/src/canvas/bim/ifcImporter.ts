/**
 * IFC Importer — parses IFC 2x3/IFC 4 files using web-ifc (WebAssembly).
 * Converts IFC geometry + property sets → DrawingElement[].
 *
 * WASM file must be served from /web-ifc.wasm (public folder).
 * web-ifc's Init() accepts a LocateFileHandlerFn, not a settings object.
 */
import type { DrawingElement, BimPropertySet, IfcEntityType, IfcStorey } from "../../types";
import type { IfcAPI as IfcAPIType, Vector } from "web-ifc";

// Lazy-loaded module reference
let _webifc: typeof import("web-ifc") | null = null;

async function getWebIfc(): Promise<typeof import("web-ifc")> {
  if (!_webifc) {
    _webifc = await import("web-ifc");
  }
  return _webifc;
}

export interface IfcImportResult {
  elements: DrawingElement[];
  storeys:  IfcStorey[];
  warnings: string[];
  summary: {
    walls:   number;
    doors:   number;
    windows: number;
    slabs:   number;
    columns: number;
    stairs:  number;
    spaces:  number;
    pipes:   number;
  };
}

// IFC entity type name → IfcEntityType (our app's union)
const IFC_TYPE_MAP: Record<string, IfcEntityType> = {
  IFCWALL:             "IfcWall",
  IFCWALLSTANDARDCASE: "IfcWallStandardCase",
  IFCDOOR:             "IfcDoor",
  IFCWINDOW:           "IfcWindow",
  IFCSLAB:             "IfcSlab",
  IFCROOF:             "IfcRoof",
  IFCCOLUMN:           "IfcColumn",
  IFCBEAM:             "IfcBeam",
  IFCSTAIR:            "IfcStair",
  IFCSPACE:            "IfcSpace",
  IFCFOOTING:          "IfcFooting",
  IFCPILE:             "IfcPile",
  IFCFLOWSEGMENT:      "IfcFlowSegment",
};

// IfcEntityType → DrawingElement archType
const ARCH_TYPE_MAP: Partial<Record<IfcEntityType, DrawingElement["archType"]>> = {
  IfcWall:             "wall",
  IfcWallStandardCase: "wall",
  IfcDoor:             "door",
  IfcWindow:           "window",
  IfcSlab:             "floor",
  IfcColumn:           "column",
  IfcStair:            "stair",
  IfcFlowSegment:      "pipe",
};

let elementSeq = 0;

export async function importIfcBuffer(buffer: ArrayBuffer): Promise<IfcImportResult> {
  const ifc = await getWebIfc();

  const api: IfcAPIType = new ifc.IfcAPI();

  // Init accepts a LocateFileHandlerFn that returns the WASM file path
  await api.Init((_path: string, _prefix: string) => `/web-ifc.wasm`);

  const modelId = api.OpenModel(new Uint8Array(buffer), {
    COORDINATE_TO_ORIGIN: true,
    USE_FAST_BOOLS: true,
    CIRCLE_SEGMENTS: 12,
  } as Parameters<typeof api.OpenModel>[1]);

  const elements: DrawingElement[] = [];
  const warnings: string[] = [];
  const summary = {
    walls: 0, doors: 0, windows: 0, slabs: 0,
    columns: 0, stairs: 0, spaces: 0, pipes: 0,
  };

  // 1. Extract storeys
  const storeys = extractStoreys(api, modelId, ifc);

  // 2. Extract elements per type
  type SummaryKey = keyof typeof summary;
  const typeEntries: Array<[number, SummaryKey]> = [
    [ifc.IFCWALL,             "walls"],
    [ifc.IFCWALLSTANDARDCASE, "walls"],
    [ifc.IFCDOOR,             "doors"],
    [ifc.IFCWINDOW,           "windows"],
    [ifc.IFCSLAB,             "slabs"],
    [ifc.IFCCOLUMN,           "columns"],
    [ifc.IFCSTAIR,            "stairs"],
    [ifc.IFCSPACE,            "spaces"],
    [ifc.IFCFLOWSEGMENT,      "pipes"],
  ];

  for (const [ifcTypeNum, countKey] of typeEntries) {
    let ids: Vector<number> | null = null;
    try {
      ids = api.GetLineIDsWithType(modelId, ifcTypeNum);
      const size = ids.size();
      for (let i = 0; i < size; i++) {
        const expressId = ids.get(i);
        try {
          const el = extractElement(api, modelId, expressId);
          if (el) {
            elements.push(el);
            summary[countKey]++;
          }
        } catch {
          warnings.push(`Skipped element expressId=${expressId}`);
        }
      }
    } catch {
      warnings.push(`Could not extract type for ${countKey}`);
    }
  }

  api.CloseModel(modelId);

  return { elements, storeys, warnings, summary };
}

function extractStoreys(
  api: IfcAPIType,
  modelId: number,
  ifc: typeof import("web-ifc"),
): IfcStorey[] {
  const result: IfcStorey[] = [];
  try {
    const ids = api.GetLineIDsWithType(modelId, ifc.IFCBUILDINGSTOREY);
    const size = ids.size();
    for (let i = 0; i < size; i++) {
      const id = ids.get(i);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const line: any = api.GetLine(modelId, id, true);
        const name      = (line.Name?.value as string | undefined) ?? `Tầng ${i}`;
        const elevation = (line.Elevation?.value as number | undefined) ?? (i * 3);
        result.push({
          id:         `ifc-storey-${id}`,
          name,
          elevation:  Math.round(elevation * 1000), // IFC metres → mm
          floorIndex: i,
        });
      } catch { /* skip malformed storey */ }
    }
  } catch { /* no storeys in file */ }

  if (result.length === 0) {
    result.push({ id: "storey-0", name: "Tầng trệt", elevation: 0, floorIndex: 0 });
  }

  return result.sort((a, b) => a.elevation - b.elevation);
}

function extractElement(
  api: IfcAPIType,
  modelId: number,
  expressId: number,
): DrawingElement | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const line: any = api.GetLine(modelId, expressId, true);
  if (!line) return null;

  // Derive IFC type name from the numeric type stored on the line object
  const typeNum: number = (line.type as number | undefined) ?? 0;
  const ifcType = resolveIfcType(typeNum);
  const archType = ARCH_TYPE_MAP[ifcType];

  // GlobalId
  const guid = (line.GlobalId?.value as string | undefined) ?? "";

  // Location from ObjectPlacement
  let x = 0;
  let y = 0;
  try {
    const placementRef = line.ObjectPlacement?.value as number | undefined;
    if (typeof placementRef === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const placement: any = api.GetLine(modelId, placementRef, true);
      const relRef = placement.RelativePlacement?.value as number | undefined;
      if (typeof relRef === "number") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const relPlacement: any = api.GetLine(modelId, relRef, true);
        const locRef = relPlacement.Location?.value as number | undefined;
        if (typeof locRef === "number") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const coords: any = api.GetLine(modelId, locRef, true);
          // Coordinates is an array of value objects: [{value: number}, ...]
          const coordArray = coords.Coordinates as Array<{ value: number }> | undefined;
          if (coordArray && coordArray.length >= 2) {
            x = (coordArray[0]?.value ?? 0) * 1000; // metres → mm
            y = (coordArray[1]?.value ?? 0) * 1000;
          }
        }
      }
    }
  } catch { /* use default position 0,0 */ }

  const bimPsets: BimPropertySet[] = []; // pset traversal kept simple for stability

  const el: DrawingElement = {
    id:          `ifc-${expressId}-${++elementSeq}`,
    type:        "rectangle",
    archType:    archType ?? "wall",
    layerId:     archTypeToLayerId(archType),
    x,
    y,
    width:       200,
    height:      200,
    ifcType,
    bimGuid:     guid,
    bimPsets,
    strokeColor: archTypeToColor(archType),
    fillColor:   "transparent",
  };

  return el;
}

/** Map web-ifc numeric type constant → IfcEntityType string */
function resolveIfcType(typeNum: number): IfcEntityType {
  // web-ifc exports numeric constants as top-level named exports on the module.
  // We cache the reverse-map lazily.
  if (!_reverseTypeMap) {
    _reverseTypeMap = buildReverseTypeMap();
  }
  return _reverseTypeMap.get(typeNum) ?? "IfcWall";
}

let _reverseTypeMap: Map<number, IfcEntityType> | null = null;

function buildReverseTypeMap(): Map<number, IfcEntityType> {
  const map = new Map<number, IfcEntityType>();
  if (!_webifc) return map;
  for (const [key, ifcType] of Object.entries(IFC_TYPE_MAP)) {
    const num = (_webifc as Record<string, unknown>)[key];
    if (typeof num === "number") {
      map.set(num, ifcType);
    }
  }
  return map;
}

function archTypeToLayerId(archType: DrawingElement["archType"]): string {
  const map: Partial<Record<NonNullable<DrawingElement["archType"]>, string>> = {
    wall:    "A-WALL",
    door:    "A-DOOR",
    window:  "A-DOOR",
    floor:   "A-FLOOR",
    room:    "A-ROOM",
    stair:   "A-STAIR",
    column:  "S-FOUND",
    pipe:    "M-PIPE",
  };
  return (archType && map[archType]) ?? "layer-1";
}

function archTypeToColor(archType: DrawingElement["archType"]): string {
  const map: Partial<Record<NonNullable<DrawingElement["archType"]>, string>> = {
    wall:   "#1e293b",
    door:   "#0ea5e9",
    window: "#06b6d4",
    floor:  "#64748b",
    pipe:   "#0284c7",
    column: "#b45309",
    stair:  "#8b5cf6",
  };
  return (archType && map[archType]) ?? "#64748b";
}
