// In-scene, click-to-select dimension editing: a rounded green handle (drag
// along the object's own axis/axes to resize) plus a small pill label (click
// to type an exact number, single-axis handles only), rendered directly at
// the object's position in the 3D scene. While dragging, the edge being
// resized highlights yellow and a floating "Measurements" panel tracks the
// live value(s) — mirrors the SketchUp-style reference the design was
// approved against: green square handles at every corner AND edge midpoint
// of a box, where a CORNER drags 2-3 dimensions at once (decomposed onto
// each axis independently) and an EDGE MIDPOINT drags exactly one.
import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";

/** One draggable axis of a handle. A handle with a single entry behaves like
 *  the original single-axis design; a handle with 2-3 entries (a box corner)
 *  drags every listed dimension simultaneously, each independently projected
 *  from the same mouse ray onto its own axis — the standard way multi-axis
 *  gizmo handles decompose a free 2D mouse drag into several 1D deltas. */
export interface DimensionAxisSpec {
  /** World-space direction this axis drags along (need not be normalized). */
  axis: [number, number, number];
  /** World-space distance covered by 1 unit of `value` moving along `axis`. */
  worldPerUnit: number;
  value: number;
  min: number;
  max?: number;
  /** Short label for this axis's row in the Measurements panel, e.g. "L". */
  label: string;
  unitLabel: string;
  onChange: (v: number) => void;
}

export interface DimensionHandleSpec {
  /** Stable key across re-renders of the same object (include the element id). */
  key: string;
  /** Short label shown in the pill (single-axis) or hover tooltip (multi-axis). */
  label: string;
  /** Full word shown in the Measurements panel while dragging. Falls back to `label`. */
  fullLabel?: string;
  /** World-space position the handle sits at. */
  origin: [number, number, number];
  color?: string;

  // --- Single-axis mode (original design: edge-midpoint handles, one value) ---
  value?: number;
  unitLabel?: string;
  min?: number;
  max?: number;
  /** World-space direction this handle drags along (need not be normalized). */
  axis?: [number, number, number];
  worldPerUnit?: number;
  /** World-space length of the yellow drag-edge highlight, drawn from `origin`
   *  backward along `axis`. Defaults to `value * worldPerUnit`. */
  edgeLength?: number;
  onChange?: (v: number) => void;

  // --- Multi-axis mode (box corners: 2-3 dimensions dragged at once) ---
  /** When set, this handle ignores the single-axis fields above and instead
   *  drags every listed axis independently — used for corner handles. */
  axes?: DimensionAxisSpec[];
}

const HANDLE_COLOR = "#2fbf6f";
const HANDLE_COLOR_ACTIVE = "#3fd47f";
const EDGE_HIGHLIGHT_COLOR = "#f5d90a";

/** Closest point (as a distance along `axis` from `origin`) between the given
 * world-space ray and the infinite line through `origin` in direction `axis`.
 * Standard closest-point-between-two-lines solve; returns null if the ray is
 * ~parallel to the axis (drag would be numerically unstable). */
function rayAxisDistance(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  origin: THREE.Vector3,
  axis: THREE.Vector3,
): number | null {
  const r = new THREE.Vector3().subVectors(rayOrigin, origin);
  const a = 1; // rayDir is normalized
  const bDot = rayDir.dot(axis);
  const e = 1; // axis is normalized
  const f = axis.dot(r);
  const c = rayDir.dot(r);
  const denom = a * e - bDot * bDot;
  if (Math.abs(denom) < 1e-6) return null;
  const t = (a * f - bDot * c) / denom;
  return t;
}

function clamp(v: number, min: number, max?: number) {
  let out = Math.max(min, v);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

interface DragAxisState {
  axis: THREE.Vector3;
  startValue: number;
  spec: DimensionAxisSpec;
}

function DimensionHandle({ spec }: { spec: DimensionHandleSpec }) {
  const { camera, gl } = useThree();
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const isMultiAxis = !!spec.axes && spec.axes.length > 0;
  const [text, setText] = useState(() => String(Math.round(spec.value ?? 0)));
  // Descriptive hover tooltip — a custom-styled div, not the `title`
  // attribute below (kept as an accessibility fallback). The native browser
  // tooltip has a ~1s hover delay and plain OS styling, so at a normal hover
  // speed it can look like nothing happens at all; this appears instantly,
  // matching object-scale-edit-demo.html's corner/edge/face tooltips.
  const tipText = isMultiAxis
    ? `Kéo để chỉnh đồng thời: ${spec.axes!.map((a) => a.label).join(" + ")}`
    : `Kéo để chỉnh ${spec.fullLabel ?? spec.label}`;
  // `spec.origin`/axis directions are LOCAL to whichever group DimensionHandles
  // happens to be mounted under (Scene root for some object types, a
  // `-cx,-cz`-shifted group for others — see ThreeViewer.tsx). Reading the
  // group's actual matrixWorld at drag start (rather than trusting local
  // coordinates as if they were already world-space) makes the drag math
  // correct regardless of that ancestor offset.
  const dragState = useRef<{ origin: THREE.Vector3; axes: DragAxisState[] } | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!editing && !isMultiAxis) setText(String(Math.round(spec.value ?? 0)));
  }, [spec.value, editing, isMultiAxis]);

  const ndcFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
    },
    [gl],
  );

  const handlePointerDown = useCallback(
    (e: any) => {
      e.stopPropagation();
      const group = groupRef.current;
      if (!group) return;
      if (controls) controls.enabled = false;
      const worldOrigin = new THREE.Vector3();
      group.getWorldPosition(worldOrigin);

      const axisEntries: DimensionAxisSpec[] = isMultiAxis
        ? spec.axes!
        : [{ axis: spec.axis!, worldPerUnit: spec.worldPerUnit!, value: spec.value!, min: spec.min!, max: spec.max, label: spec.label, unitLabel: spec.unitLabel!, onChange: spec.onChange! }];

      const axes: DragAxisState[] = axisEntries.map((ax) => {
        const axisLocal = new THREE.Vector3(...ax.axis);
        const worldAxisPoint = group.localToWorld(axisLocal.clone());
        const worldAxis = worldAxisPoint.sub(worldOrigin).normalize();
        return { axis: worldAxis, startValue: ax.value, spec: ax };
      });

      dragState.current = { origin: worldOrigin, axes };
      setDragging(true);
    },
    [controls, isMultiAxis, spec],
  );

  useEffect(() => {
    if (!dragging) return;

    const raycaster = new THREE.Raycaster();
    document.body.style.cursor = "grabbing";

    const onMove = (e: PointerEvent) => {
      const st = dragState.current;
      if (!st) return;
      const ndc = ndcFromEvent(e.clientX, e.clientY);
      raycaster.setFromCamera(ndc, camera);
      // Each axis is projected independently from the SAME ray — this is
      // what lets a corner handle move 2-3 dimensions at once: dragging
      // mostly sideways contributes almost entirely to the axis aligned with
      // that direction and near-zero to the others, exactly like a
      // multi-axis transform gizmo.
      for (const axState of st.axes) {
        const t = rayAxisDistance(raycaster.ray.origin, raycaster.ray.direction, st.origin, axState.axis);
        if (t === null) continue;
        const deltaValue = t / axState.spec.worldPerUnit;
        const next = clamp(axState.startValue + deltaValue, axState.spec.min, axState.spec.max);
        axState.spec.onChange(next);
      }
    };

    const onUp = () => {
      setDragging(false);
      dragState.current = null;
      if (controls) controls.enabled = true;
      document.body.style.cursor = "auto";
    };

    // pointerup is the normal end-of-drag path, but it never fires if the
    // pointer leaves the window (Alt-Tab, DevTools grabbing focus, the OS
    // showing a drag-and-drop cursor, etc.) or if the tab is backgrounded
    // mid-drag. Without a fallback, `dragging` stays true forever and
    // controls.enabled stays false forever — orbit dies and every click that
    // depends on this component being torn down cleanly breaks with it. Also
    // pointercancel (browser/OS aborts the gesture, e.g. an overlay grabs
    // capture, iOS Safari's edge-swipe gesture) never reaches onUp above.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      // If this effect is torn down mid-drag for any other reason (the
      // component unmounts because selection changed, Scene re-mounted,
      // etc.), the listeners above are gone too — restore controls/cursor
      // here so a stuck drag can never leave orbit disabled and the cursor
      // stuck on "grabbing".
      if (controls) controls.enabled = true;
      document.body.style.cursor = "auto";
    };
    // spec is captured fresh via closure each effect run — stable enough per-drag.
  }, [dragging, camera, controls, ndcFromEvent]);

  const commit = () => {
    if (isMultiAxis || !spec.onChange || spec.min === undefined) return;
    const n = Number(text);
    if (Number.isFinite(n)) spec.onChange(clamp(n, spec.min, spec.max));
    setEditing(false);
  };

  // Yellow drag-edge highlight — only meaningful for single-axis handles
  // (a corner dragging 2-3 dimensions at once doesn't have one single edge
  // to draw). Line from the handle back to the object's anchor along its axis.
  let edgePoints: [THREE.Vector3, THREE.Vector3] | null = null;
  if (!isMultiAxis && spec.axis) {
    const axisLen = Math.hypot(spec.axis[0], spec.axis[1], spec.axis[2]) || 1;
    const nx = spec.axis[0] / axisLen, ny = spec.axis[1] / axisLen, nz = spec.axis[2] / axisLen;
    const edgeLen = spec.edgeLength ?? (spec.value ?? 0) * (spec.worldPerUnit ?? 1);
    edgePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-nx * edgeLen, -ny * edgeLen, -nz * edgeLen)];
  }

  // The square and its label/panel share ONE Html anchor, laid out with
  // plain CSS (fixed pixel offsets) instead of a second 3D position for the
  // label. A world-unit offset for the label (the earlier approach) shrinks
  // to nothing on screen once the camera is far enough away — at typical
  // zoom the label ends up drawn right on top of the square instead of
  // beside it. Html already renders at a constant screen-pixel size, so a
  // constant CSS offset is the only thing that stays legible at every zoom.
  return (
    <group ref={groupRef} position={spec.origin}>
      {dragging && edgePoints && <Line points={edgePoints} color={EDGE_HIGHLIGHT_COLOR} lineWidth={3} depthTest={false} />}
      <Html zIndexRange={[30, 50]} style={{ pointerEvents: "none" }}>
        <div style={{ position: "relative", width: 0, height: 0 }}>
          {/* Fully invisible-until-hover turned out to be too hard to even
              find on a wall — walls (unlike FlatElementMesh/BlockElementMesh)
              don't get a selection-outline highlight of their own, so there
              was no cue at all pointing at where a corner/edge sits. Dimmed
              instead: a faint, small marker sits at the correct spot on the
              object at all times (so it reads as "attached" to the geometry,
              not floating free), and brightens to full size/opacity/color on
              hover or drag — the "no clutter" goal from before is still met
              since it's subtle rather than a solid bright square. */}
          <div
            onPointerDown={handlePointerDown}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            style={{
              position: "absolute",
              left: -14,
              top: -14,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: dragging ? HANDLE_COLOR_ACTIVE : HANDLE_COLOR,
                border: "2px solid #ffffff",
                boxShadow: dragging || hovered ? "0 0 0 4px rgba(47,191,111,0.28), 0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.4)",
                opacity: dragging || hovered ? 1 : 0.55,
                transform: `scale(${dragging ? 1.3 : hovered ? 1.1 : 0.7})`,
                transformOrigin: "center",
                transition: "opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease",
                pointerEvents: "none",
              }}
            />
          </div>
          {hovered && !dragging && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -20,
                transform: "translate(-50%, -100%)",
                background: "rgba(15,23,42,0.96)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#e2e8f0",
                fontSize: 10.5,
                fontWeight: 600,
                padding: "5px 9px",
                borderRadius: 8,
                whiteSpace: "nowrap",
                boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              {tipText}
            </div>
          )}
          {dragging ? (
            <div
              style={{
                position: "absolute",
                left: 16,
                top: -50,
                width: 168,
                border: "1px solid #6b7280",
                borderRadius: 5,
                overflow: "hidden",
                boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ background: "#3b6ea5", color: "#fff", padding: "3px 8px" }}>Measurements</div>
              {isMultiAxis ? (
                spec.axes!.map((ax) => (
                  <div key={ax.label} style={{ background: "#fdf6d8", padding: "4px 8px", display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #eadfa8" }}>
                    <span style={{ color: "#555" }}>{ax.label}</span>
                    <span style={{ fontWeight: 500, color: "#111" }}>
                      {Math.round(ax.value)}
                      {ax.unitLabel}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ background: "#fdf6d8", padding: "5px 8px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#555" }}>{spec.fullLabel ?? spec.label}</span>
                  <span style={{ fontWeight: 500, color: "#111" }}>
                    {Math.round(spec.value ?? 0)}
                    {spec.unitLabel}
                  </span>
                </div>
              )}
            </div>
          ) : !isMultiAxis ? (
            <div style={{ position: "absolute", left: 14, top: -10, pointerEvents: "auto" }}>
              {editing ? (
                <input
                  autoFocus
                  type="number"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-16 bg-slate-900 border border-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow-lg outline-none text-center"
                />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="bg-slate-900/95 border border-slate-700/70 hover:border-blue-500/70 rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-200 whitespace-nowrap select-none shadow-lg"
                  title={`Click to edit ${spec.label}`}
                >
                  <span className="text-slate-500">{spec.label}</span>{" "}
                  {Math.round(spec.value ?? 0)}
                  <span className="text-slate-500">{spec.unitLabel}</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

/** Renders one draggable handle + editable label per spec. Mount this only
 * while exactly one object is selected — each spec represents one editable
 * dimension (or, for a corner, several at once) of that object. */
export function DimensionHandles({ specs }: { specs: DimensionHandleSpec[] }) {
  return (
    <>
      {specs.map((spec) => (
        <DimensionHandle key={spec.key} spec={spec} />
      ))}
    </>
  );
}
