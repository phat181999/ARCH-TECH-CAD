/**
 * ClashDetector — finds geometric conflicts between building elements.
 *
 * Hard clash  : elements physically intersect (e.g. pipe through wall)
 * Soft clash  : clearance zone violated (e.g. door swing blocked)
 */
import type { DrawingElement } from "../../types";

// ── Constants ────────────────────────────────────────────────
const DEFAULT_WALL_THICKNESS   = 200;  // mm
const DEFAULT_DOOR_WIDTH       = 900;  // mm
const DEFAULT_SWING_CLEARANCE  = 100;  // mm extra beyond door width
const PIPE_WALL_SNAP_TOLERANCE = 50;   // mm — pipe endpoint proximity to wall
const COLUMN_OVERLAP_THRESHOLD = 0.5;  // 50% of column area before flagging

export type ClashType     = "hard" | "soft";
export type ClashSeverity = "critical" | "major" | "minor";

export interface Clash {
  id:          string;
  type:        ClashType;
  severity:    ClashSeverity;
  elementAId:  string;
  elementBId:  string;
  description: string;
  position:    { x: number; y: number };  // 2D drawing coords centroid
}

// ── 2D geometry helpers ──────────────────────────────────────

interface Seg { x1: number; y1: number; x2: number; y2: number }
interface Rect { x: number; y: number; w: number; h: number }

/** Axis-aligned bounding box of a line segment, expanded by margin */
function segBbox(s: Seg, margin = 0): Rect {
  return {
    x: Math.min(s.x1, s.x2) - margin,
    y: Math.min(s.y1, s.y2) - margin,
    w: Math.abs(s.x2 - s.x1) + margin * 2,
    h: Math.abs(s.y2 - s.y1) + margin * 2,
  };
}

function bboxOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Project point P onto segment AB. Returns t ∈ [0,1] and closest point. */
function projectPointOnSeg(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { t: number; cx: number; cy: number; dist: number } {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return { t: 0, cx: ax, cy: ay, dist: Math.hypot(px - ax, py - ay) };
  const t  = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return { t, cx, cy, dist: Math.hypot(px - cx, py - cy) };
}

/** Distance between two segments in 2D (minimum) */
function segToSegDist(a: Seg, b: Seg): number {
  const d1 = projectPointOnSeg(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2).dist;
  const d2 = projectPointOnSeg(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2).dist;
  const d3 = projectPointOnSeg(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2).dist;
  const d4 = projectPointOnSeg(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2).dist;
  return Math.min(d1, d2, d3, d4);
}

function midpoint(s: Seg): { x: number; y: number } {
  return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
}

function toSeg(el: DrawingElement): Seg | null {
  if (el.x1 === undefined || el.x2 === undefined || el.y1 === undefined || el.y2 === undefined)
    return null;
  return { x1: el.x1 as number, y1: el.y1 as number, x2: el.x2 as number, y2: el.y2 as number };
}

// ── Hard clash: pipe intersects wall ─────────────────────────

function checkPipeWallClashes(
  pipes: DrawingElement[],
  walls: DrawingElement[],
  clashes: Clash[],
): void {
  for (const pipe of pipes) {
    const pipeSeg = toSeg(pipe);
    if (!pipeSeg) continue;

    const pipeElev   = (pipe["elevation"] ?? 250) as number;  // cm
    const pipeSystem = (pipe["pipeSystem"] ?? "water") as string;

    for (const wall of walls) {
      const wallSeg = toSeg(wall);
      if (!wallSeg) continue;

      const thickness = (wall.wallThickness ?? DEFAULT_WALL_THICKNESS) as number;
      const halfThick = thickness / 2;

      // Check if pipe passes through wall volume (2D: pipe segment enters wall's expanded bbox)
      const wallBbox = segBbox(wallSeg, halfThick);
      const pipeBbox = segBbox(pipeSeg, 0);

      if (!bboxOverlap(wallBbox, pipeBbox)) continue;

      // Finer check: distance between segments < wall half-thickness
      const dist = segToSegDist(pipeSeg, wallSeg);
      if (dist < halfThick - PIPE_WALL_SNAP_TOLERANCE) {
        const pos = midpoint(pipeSeg);
        clashes.push({
          id:          `clash-pw-${pipe.id}-${wall.id}`,
          type:        "hard",
          severity:    "critical",
          elementAId:  pipe.id,
          elementBId:  wall.id,
          description: `Ống ${pipeSystem} Ø${(pipe["pipeDiameter"] ?? 50) as number}mm đâm xuyên tường (cao ${pipeElev}cm)`,
          position:    pos,
        });
      }
    }
  }
}

// ── Soft clash: door swing clearance ─────────────────────────

function checkDoorSwingClashes(
  doors: DrawingElement[],
  otherElements: DrawingElement[],
  clashes: Clash[],
): void {
  for (const door of doors) {
    if (door.x === undefined || door.y === undefined) continue;

    const dw    = (door.openingWidth ?? door.width ?? DEFAULT_DOOR_WIDTH) as number;
    const swing = (door["swing"] ?? 90) as number;  // degrees

    // Swing zone: approximate as a square region in front of door
    const swingSize = dw + DEFAULT_SWING_CLEARANCE;
    const doorX     = door.x as number;
    const doorY     = (door.y ?? 0) as number;

    // Swing zone bounding box (axis-aligned approximation)
    const swingRect: Rect = {
      x: doorX - swingSize / 2,
      y: doorY,
      w: swingSize,
      h: swingSize,
    };

    for (const other of otherElements) {
      if (other.id === door.id) continue;
      if (other.archType === "wall" || other.archType === "door") continue;

      // Get other's bbox
      let otherRect: Rect | null = null;
      if (other.x !== undefined && other.width !== undefined && other.height !== undefined) {
        otherRect = {
          x: other.x as number,
          y: (other.y ?? 0) as number,
          w: other.width as number,
          h: other.height as number,
        };
      }

      if (!otherRect) continue;

      if (bboxOverlap(swingRect, otherRect)) {
        clashes.push({
          id:          `clash-ds-${door.id}-${other.id}`,
          type:        "soft",
          severity:    "major",
          elementAId:  door.id,
          elementBId:  other.id,
          description: `Cửa va chạm ${other.archType ?? other.type} khi mở (vùng quay ${swing}°)`,
          position:    { x: doorX, y: doorY },
        });
      }
    }
  }
}

// ── Column–Wall overlap (hard) ────────────────────────────────

function checkColumnWallClashes(
  columns: DrawingElement[],
  walls: DrawingElement[],
  clashes: Clash[],
): void {
  for (const col of columns) {
    if (col.x === undefined || col.width === undefined) continue;
    const colRect: Rect = {
      x: col.x as number,
      y: (col.y ?? 0) as number,
      w: (col.width  ?? 250) as number,
      h: (col.height ?? col.width ?? 250) as number,
    };

    for (const wall of walls) {
      const wallSeg = toSeg(wall);
      if (!wallSeg) continue;

      const thickness = (wall.wallThickness ?? DEFAULT_WALL_THICKNESS) as number;
      const wallRect  = segBbox(wallSeg, thickness / 2);

      if (bboxOverlap(colRect, wallRect)) {
        const overlapX    = Math.min(colRect.x + colRect.w, wallRect.x + wallRect.w) - Math.max(colRect.x, wallRect.x);
        const overlapY    = Math.min(colRect.y + colRect.h, wallRect.y + wallRect.h) - Math.max(colRect.y, wallRect.y);
        const overlapArea = Math.max(0, overlapX) * Math.max(0, overlapY);
        const colArea     = colRect.w * colRect.h;

        // Flag if overlap > COLUMN_OVERLAP_THRESHOLD of column footprint
        if (overlapArea > colArea * COLUMN_OVERLAP_THRESHOLD) {
          clashes.push({
            id:          `clash-cw-${col.id}-${wall.id}`,
            type:        "hard",
            severity:    "minor",
            elementAId:  col.id,
            elementBId:  wall.id,
            description: `Cột chồng lên tường (overlap ${((overlapArea / colArea) * 100).toFixed(0)}%)`,
            position:    { x: colRect.x + colRect.w / 2, y: colRect.y + colRect.h / 2 },
          });
        }
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────

export function detectClashes(elements: DrawingElement[]): Clash[] {
  const clashes: Clash[] = [];

  const walls   = elements.filter((e) => e.archType === "wall"   || (e.type === "line" && !e.archType));
  const pipes   = elements.filter((e) => e.archType === "pipe");
  const doors   = elements.filter((e) => e.archType === "door");
  const columns = elements.filter((e) => e.archType === "column");
  const others  = elements.filter((e) => e.archType !== "wall" && e.archType !== "door");

  checkPipeWallClashes(pipes, walls, clashes);
  checkDoorSwingClashes(doors, others, clashes);
  checkColumnWallClashes(columns, walls, clashes);

  return clashes;
}

// ── BCF Export ────────────────────────────────────────────────

/** Export clashes as BCF (BIM Collaboration Format) JSON — simple BCF 2.1 subset */
export function exportBcf(clashes: Clash[], projectName = "ARCH-TECH-CAD"): string {
  const issues = clashes.map((c, i) => ({
    Guid:        c.id,
    CreationDate: new Date().toISOString(),
    Title:       c.description,
    Priority:    c.severity === "critical" ? "Critical" : c.severity === "major" ? "Major" : "Normal",
    TopicType:   c.type === "hard" ? "Clash" : "SoftClash",
    TopicStatus: "Open",
    Index:       i,
    Labels:      [c.type],
    Viewpoints: [
      {
        Guid:       `vp-${c.id}`,
        Snapshot:   null,
        Components: {
          ClashingComponents: [
            { IfcGuid: c.elementAId },
            { IfcGuid: c.elementBId },
          ],
        },
      },
    ],
  }));

  return JSON.stringify(
    {
      ProjectExtensionSchema: "https://github.com/buildingSMART/BCF-API",
      Project:    { Name: projectName },
      Topics:     issues,
      ExportDate: new Date().toISOString(),
      Generator:  "ARCH-TECH-CAD",
    },
    null,
    2,
  );
}
