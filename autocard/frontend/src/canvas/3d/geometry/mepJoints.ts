// Detects where MEP runs bend or end by shared endpoints — derived from the
// element list every render, not tracked while drawing, so it survives
// undo/redo, reload, and DXF-imported MEP with no extra state.
import type { DrawingElement } from "../../../types";

export interface MepJoint {
  system: string;
  x: number;
  y: number;
  elevation: number;
  diameter: number;
  kind: "joint" | "end";
}

export function computeMepJoints(pipes: DrawingElement[]): MepJoint[] {
  const map = new Map<string, { system: string; x: number; y: number; elevation: number; diameter: number; count: number }>();
  const keyOf = (sys: string, x: number, y: number, elev: number) => `${sys}|${Math.round(x)}|${Math.round(y)}|${Math.round(elev)}`;

  for (const el of pipes) {
    if (el.archType !== "pipe" || el.x1 == null || el.y1 == null || el.x2 == null || el.y2 == null) continue;
    const system = (el.pipeSystem as string | undefined) ?? "water";
    const elevation = (el.elevation as number | undefined) ?? 0;
    const diameter = (el.pipeDiameter as number | undefined) ?? 50;
    for (const p of [{ x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }]) {
      const k = keyOf(system, p.x, p.y, elevation);
      const cur = map.get(k) ?? { system, x: p.x, y: p.y, elevation, diameter, count: 0 };
      cur.count++;
      map.set(k, cur);
    }
  }

  return [...map.values()].map((v) => ({
    system: v.system, x: v.x, y: v.y, elevation: v.elevation, diameter: v.diameter,
    kind: v.count >= 2 ? "joint" : "end",
  }));
}
