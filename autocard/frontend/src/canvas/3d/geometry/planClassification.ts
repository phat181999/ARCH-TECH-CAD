import type { BlockDef, DrawingElement } from "../../../types";
import type { Bounds, HousePlan } from "../types";

export function isRectangle(el: DrawingElement): el is DrawingElement & { x: number; y: number; width: number; height: number } {
  return el.type === "rectangle" && typeof el.x === "number" && typeof el.y === "number" && typeof el.width === "number" && typeof el.height === "number";
}

export function labelOf(el: DrawingElement): string {
  return typeof el.label === "string" ? el.label.toLowerCase() : "";
}

export function classifyPlan(elements: DrawingElement[]): HousePlan {
  const shell = elements.find((el) => isRectangle(el) && (el.archType === "meta" || labelOf(el).startsWith("house"))) ?? null;

  return elements.reduce<HousePlan>((acc, el) => {
    const label = labelOf(el);
    if (shell && el.id === shell.id) {
      return acc;
    }
    // Walls: lines OR polylines with archType="wall"
    if (el.archType === "wall" && (el.type === "line" || el.type === "polyline")) {
      acc.walls.push(el);
      return acc;
    }
    if (el.archType === "door") {
      acc.doors.push(el);
      return acc;
    }
    if (el.archType === "window") {
      acc.windows.push(el);
      return acc;
    }
    if ((el.archType === "room" && (el.type === "text" || el.type === "hatch")) || (isRectangle(el) && (label.includes("bedroom") || label.includes("room") || label.includes("kitchen") || label.includes("bath")))) {
      acc.rooms.push(el);
      return acc;
    }
    acc.loose.push(el);
    return acc;
  }, { shell, rooms: [], doors: [], windows: [], walls: [], loose: [] });
}

// Local (unscaled, unrotated) AABB of a block definition's sub-elements, in the
// block's own coordinate space — mirrors the per-type extents used in
// getPlanBounds so a block's footprint is measured the same way as any other element.
function blockDefLocalBounds(def: BlockDef): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const be of def.elements) {
    if (isRectangle(be)) {
      minX = Math.min(minX, be.x); minY = Math.min(minY, be.y);
      maxX = Math.max(maxX, be.x + be.width); maxY = Math.max(maxY, be.y + be.height);
    } else if ((be.type === "circle" || be.type === "arc") && typeof be.cx === "number" && typeof be.cy === "number") {
      const radius = typeof be.r === "number" ? be.r : (typeof be.radius === "number" ? be.radius : 0);
      minX = Math.min(minX, be.cx - radius); minY = Math.min(minY, be.cy - radius);
      maxX = Math.max(maxX, be.cx + radius); maxY = Math.max(maxY, be.cy + radius);
    } else if (be.type === "line" && typeof be.x1 === "number" && typeof be.y1 === "number" && typeof be.x2 === "number" && typeof be.y2 === "number") {
      minX = Math.min(minX, be.x1, be.x2); minY = Math.min(minY, be.y1, be.y2);
      maxX = Math.max(maxX, be.x1, be.x2); maxY = Math.max(maxY, be.y1, be.y2);
    } else if (Array.isArray(be.points)) {
      for (const p of be.points) {
        if (p && typeof p.x === "number" && typeof p.y === "number") {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
      }
    } else if ((be.type === "text" || be.type === "mark") && typeof be.x === "number" && typeof be.y === "number") {
      // Point-only, matching getPlanBounds' own top-level text/mark treatment below —
      // several real block defs (section-arrow, north-arrow, elevation-marker) carry
      // label text placed outside their line/circle geometry's bbox, so skipping this
      // type would still under-report those blocks' footprint after scaling.
      minX = Math.min(minX, be.x); minY = Math.min(minY, be.y);
      maxX = Math.max(maxX, be.x); maxY = Math.max(maxY, be.y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

export function getPlanBounds(elements: DrawingElement[], blockDefs?: Record<string, BlockDef>): Bounds | null {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  for (const el of elements) {
    if (isRectangle(el)) {
      minX = Math.min(minX, el.x);
      minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxZ = Math.max(maxZ, el.y + el.height);
    } else if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number") {
      const radius = typeof el.r === "number" ? el.r : (typeof el.radius === "number" ? el.radius : 0);
      minX = Math.min(minX, el.cx - radius);
      minZ = Math.min(minZ, el.cy - radius);
      maxX = Math.max(maxX, el.cx + radius);
      maxZ = Math.max(maxZ, el.cy + radius);
    } else if (el.type === "line" && typeof el.x1 === "number" && typeof el.y1 === "number" && typeof el.x2 === "number" && typeof el.y2 === "number") {
      minX = Math.min(minX, el.x1, el.x2);
      minZ = Math.min(minZ, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2);
      maxZ = Math.max(maxZ, el.y1, el.y2);
    } else if ((el.type === "polyline" || el.type === "spline" || el.type === "leader" || el.type === "hatch") && Array.isArray(el.points)) {
      for (const p of el.points) {
        if (p && typeof p.x === "number" && typeof p.y === "number") {
          minX = Math.min(minX, p.x);
          minZ = Math.min(minZ, p.y);
          maxX = Math.max(maxX, p.x);
          maxZ = Math.max(maxZ, p.y);
        }
      }
    } else if (el.type === "block" && typeof el.x === "number" && typeof el.y === "number") {
      // Block footprint = insertion point + scaled local bounds of its definition
      // (matches the render transform in FlatElementMesh/ElementRenderer.drawBlock:
      // translate(x,y) → scale(scale) → rotate). Rotation is ignored here and we use
      // an axis-aligned box of the unrotated footprint — conservative but simple,
      // which is fine for camera/grid/fog framing (not a collision system).
      const def = blockDefs?.[el.blockId ?? ""];
      const local = def ? blockDefLocalBounds(def) : null;
      const scale = typeof el.scale === "number" ? el.scale : 1;
      if (local) {
        minX = Math.min(minX, el.x + local.minX * scale);
        minZ = Math.min(minZ, el.y + local.minY * scale);
        maxX = Math.max(maxX, el.x + local.maxX * scale);
        maxZ = Math.max(maxZ, el.y + local.maxY * scale);
      } else {
        // No block definition available (e.g. pre-insertion DXF import bounds check)
        // — fall back to the insertion point so bounds stay finite.
        minX = Math.min(minX, el.x);
        minZ = Math.min(minZ, el.y);
        maxX = Math.max(maxX, el.x);
        maxZ = Math.max(maxZ, el.y);
      }
    } else if ((el.type === "text" || el.type === "mark") && typeof el.x === "number" && typeof el.y === "number") {
      minX = Math.min(minX, el.x);
      minZ = Math.min(minZ, el.y);
      maxX = Math.max(maxX, el.x);
      maxZ = Math.max(maxZ, el.y);
    } else if (el.type === "arc" && typeof el.cx === "number" && typeof el.cy === "number") {
      const radius = typeof el.r === "number" ? el.r : (typeof el.radius === "number" ? el.radius : 0);
      minX = Math.min(minX, el.cx - radius);
      minZ = Math.min(minZ, el.cy - radius);
      maxX = Math.max(maxX, el.cx + radius);
      maxZ = Math.max(maxZ, el.cy + radius);
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return { minX, minZ, maxX, maxZ };
}

// Returns the archType inferred from an AIA/NCS layer name, "skip" for annotation
// layers that should never be extruded, or undefined when the name gives no signal.
// Estimates a reasonable wall extrusion height from the median line length.
// For architectural drawings, a typical wall segment is 2-6m long and wall
// height is ~90% of that. Falls back to userWallHeight for hand-drawn plans.
export function computeAutoWallHeight(elements: DrawingElement[], userWallHeight: number): number {
  const lengths: number[] = [];
  for (const el of elements) {
    if (el.type === "line" &&
      typeof el.x1 === "number" && typeof el.y1 === "number" &&
      typeof el.x2 === "number" && typeof el.y2 === "number") {
      const l = Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
      if (l > 0) lengths.push(l);
    }
  }
  if (lengths.length === 0) return userWallHeight;
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  return Math.max(userWallHeight, Math.min(median * 0.9, 50000));
}


export function inferArchTypeFromLayer(layerId: string | undefined): DrawingElement["archType"] | "skip" | undefined {
  if (!layerId) return undefined;
  const id = layerId.toUpperCase().trim();

  // ── AIA/NCS standard (English) ───────────────────────────────────────────
  if (/WALL/.test(id)) return "wall";
  if (/\bDOOR\b|^DOOR$/.test(id)) return "door";
  if (/WIND|GLAZ|CURT/.test(id)) return "window";
  if (/ROOM|AREA|SPCE/.test(id)) return "room";
  if (/FLOR|SLAB/.test(id)) return "floor";
  if (/GRID|COLS|BEAM/.test(id)) return "grid";
  if (/ANNO|DIM|NOTE|SYMB|LABL|MARK|HATCH|PATT|STAIR|EQPM|FURN/.test(id)) return "skip";

  // ── Text / annotation (broad) ────────────────────────────────────────────
  // Must come BEFORE wall/door checks to avoid misclassifying TXT as wall
  if (/^TXT$|^T$|^TEXT|\bTEXT\b|CHU|FONT|ANNT|CHT/.test(id)) return "skip";

  // ── Vietnamese walls / structure ─────────────────────────────────────────
  if (/TU[OÔ]NG|TUONG|BTCT|GACH|KET.?CAU|KHUNG/.test(id)) return "wall";
  if (/^MB$|MAT.?BANG/.test(id)) return "wall"; // mặt bằng (floor plan layer)

  // ── Vietnamese doors ─────────────────────────────────────────────────────
  if (/^CUA$|CUA.?DI|CUADI|CANH.?CUA|MO.?CUA/.test(id)) return "door";

  // ── Vietnamese windows ───────────────────────────────────────────────────
  if (/CUA.?SO|CUASO|KINH/.test(id)) return "window";

  // ── Vietnamese ignore layers ──────────────────────────────────────────────
  // Dimensions / annotations
  if (/^KT$|KICH.?THUOC|CAO.?DO|DO.?CAO|NET.*KICH|KICHTHUOC/.test(id)) return "skip";
  if (/KY.?HIEU|CHU.?THICH|GHI.?CHU/.test(id)) return "skip";
  // Electrical / lighting
  if (/LAMP|LIGHT|BONG|DEN\b|CONG.?TAC|O.?CAM|DIEN/.test(id)) return "skip";
  // Plumbing / water
  if (/NUOC|NDNUOC|NDET|NUOCLANH|NUOCNONG|THOATNUOC|CAP.?NUOC/.test(id)) return "skip";
  // Plants / landscape
  if (/^HOA$|CAY.?XANH|LANDSCAPE|THUC.?VAT/.test(id)) return "skip";
  // Stairs
  if (/THANG|CAU.?THANG/.test(id)) return "skip";
  // Sections / elevations
  if (/MAT.?DU[NG]|MATTRUOC|MATBAC|MATNAM|MATDONG|MATTAY/.test(id)) return "skip";
  if (/MAT.?CAT|MATCAT|\bMC\b|\bCAT\b/.test(id)) return "skip";
  // Overview / total plan (bản vẽ tổng thể — not a single floor)
  if (/TONG.?THE|TONGTHE|TONGMAT|OVERVIEW/.test(id)) return "skip";
  // Hidden/net lines (đường nét khuất, bao bọc)
  if (/^NET|NETVE|NETBAO|NETTHAY|NET.?VE|NET.?BAO/.test(id)) return "skip";
  // Furniture / equipment
  if (/NOI.?THAT|DO.?GOC|THIET.?BI|SANITARY|TOILET|SINK|BATH/.test(id)) return "skip";
  // Columns
  if (/COT.?THAY|COTTHAY|COT/.test(id)) return "skip";
  // Supplement/misc
  if (/BSUNG|BO.?SUNG/.test(id)) return "skip";
  // Floor/storey layers (Vietnamese: lầu, tầng, sàn)
  if (/^\d*LAM$|^\d*TANG$|^\d*SAN$|^\d+LAM\b/i.test(id)) return "skip";

  // ── Numeric / lineweight layers (common in Vietnamese CAD practice) ──────
  // Layers named with just numbers or decimals ("0.7", "07", "10 0.5") are
  // lineweight conventions, not architectural elements.
  if (/^\d[\d. ]*$/.test(id.trim()) && id !== "0") return "skip";
  // Generic "LAYERnn" layers
  if (/^LAYER\d+$/i.test(id)) return "skip";

  return undefined;
}


export type LayerOverride = Record<string, "wall" | "door" | "window" | "slab" | "ignore">;

// Classifies elements using layer names (AIA/NCS). An optional `override` map
// (layerId → type, from the import wizard) takes precedence over name inference.
// Falls back to treating all lines as walls when the layer name gives no signal.
export function layerClassify(elements: DrawingElement[], override?: LayerOverride): {
  walls: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  loose: DrawingElement[];
} {
  const walls: DrawingElement[] = [];
  const doors: DrawingElement[] = [];
  const windows: DrawingElement[] = [];
  const loose: DrawingElement[] = [];

  // First pass: classify by override / layer name inference
  // Track how many elements have a positive wall signal vs unknown
  let namedWallCount = 0;
  let unknownLineCount = 0;

  // Categorize each element
  const classified: { el: DrawingElement; type: string }[] = [];
  for (const el of elements) {
    const ov = override && el.layerId ? override[el.layerId] : undefined;
    const inferred = ov ?? inferArchTypeFromLayer(el.layerId);
    classified.push({ el, type: inferred ?? "unknown" });
    if ((inferred === "wall") && el.type === "line") namedWallCount++;
    if (!inferred && el.type === "line") unknownLineCount++;
  }

  // Decide fallback strategy:
  // If we have named wall layers (e.g. TUONG, WALL), don't promote unknown lines
  // to walls — they're likely annotations, sections, or elevation lines that
  // would pollute the 3D model. Only fallback to "all lines = walls" when
  // there are NO named walls at all (user drew everything on layer 0).
  const hasNamedWalls = namedWallCount > 0;

  for (const { el, type } of classified) {
    if (type === "ignore" || type === "skip" || type === "slab") { loose.push(el); continue; }
    if (type === "wall" && el.type === "line") { walls.push(el); continue; }
    if (type === "wall" && el.type === "polyline") { walls.push(el); continue; }
    if (type === "door") { doors.push(el); continue; }
    if (type === "window") { windows.push(el); continue; }
    // Unknown layer — fallback depends on whether named walls exist
    if (!hasNamedWalls && el.type === "line") {
      walls.push(el); // no wall layers found at all → old behavior
    } else {
      loose.push(el); // has named walls → don't pollute with unknowns
    }
  }

  return { walls, doors, windows, loose };
}

export function roomBoundsFromBoundary(room: import("../../../types").ArchitecturalPlan["rooms"][number]) {
  if (!room.boundary.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  room.boundary.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
