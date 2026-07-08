// src/canvas/3d/components/ViewRenderer.tsx
// Standalone line-art renderer for the Views tab — a separate, lightweight
// <Canvas> (not the interactive 3D viewer's scene) that draws walls/roof as
// edge-only geometry through a fixed orthographic camera. Kept independent
// of ThreeViewer.tsx on purpose (matches the 3D-first doc's Phase 1B:
// "embedded Canvas riêng... không dùng chung với 3D scene để tránh
// conflict") so nothing here can destabilize the interactive 3D viewer.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";
import { getPlanBounds } from "../geometry/planClassification";
import { buildWallSegmentsFromSemanticWalls } from "../geometry/wallGeometry";
import { RoofGenerator, type RoofType } from "../geometry/RoofGenerator";
import { sheetFrustum, type SheetView, type SectionLine } from "../geometry/sheetCamera";
import { generateDimensions } from "../geometry/autoDimension";
import { SectionCutTool } from "../controllers/SectionCutTool";

const LINE_COLOR = "#1f2937";

function CameraAim({ target, up }: { target: [number, number, number]; up: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.up.set(...up);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, target, up]);
  return null;
}

// THREE.js requires the renderer to opt into per-material `clippingPlanes`
// support (it's off by default for perf). This Canvas is its own dedicated
// WebGLRenderer instance (see the file header comment), so enabling this here
// has no effect on ThreeViewer.tsx's separate renderer.
function LocalClipping() {
  const { gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
}

// Downloads the current WebGL frame as a PNG whenever `requestId` changes to
// a new truthy value. Must live inside the <Canvas> tree (like CameraAim) to
// get `gl` via useThree. Same trigger-prop pattern as DrawingSheetExporter.
function ExportOnRequest({ requestId, label, onDone }: { requestId: number; label: string; onDone?: () => void }) {
  const { gl, scene, camera } = useThree();
  const prevId = useRef(0);
  useEffect(() => {
    if (requestId === 0 || requestId === prevId.current) return;
    prevId.current = requestId;
    // WebGLRenderer defaults to preserveDrawingBuffer: false, so the drawing
    // buffer content read by toDataURL() is only reliable immediately after a
    // synchronous render() call in the same tick — same reason
    // DrawingSheetExporter.tsx calls gl.render(scene, cam) right before its
    // own toDataURL(). Without this, R3F's async render-loop frame can
    // already be swapped/cleared by the time this effect runs, producing a
    // blank/transparent PNG.
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label}.png`;
    a.click();
    onDone?.();
  }, [requestId, gl, scene, camera, label, onDone]);
  return null;
}

export interface ViewRendererProps {
  elements: DrawingElement[];
  view: SheetView;
  sectionLine?: SectionLine;
  width: number;
  height: number;
  wallHeight: number;
  roofType?: RoofType;
  roofPitch?: number;
  showDimensions?: boolean;
  drawingSectionCut?: boolean;
  onSectionCutDrawn?: (line: { x1: number; y1: number; x2: number; y2: number }) => void;
  exportRequestId?: number;
  onExported?: () => void;
  exportLabel?: string;
}

export function ViewRenderer({ elements, view, sectionLine, width, height, wallHeight, roofType = "gable", roofPitch = 30, showDimensions = false, drawingSectionCut = false, onSectionCutDrawn, exportRequestId = 0, onExported, exportLabel = "view" }: ViewRendererProps) {
  const rawBounds = useMemo(() => getPlanBounds(elements), [elements]);
  const walls = useMemo(
    () => elements.filter((el) => el.archType === "wall" && (el.type === "line" || el.type === "polyline")),
    [elements],
  );
  const segments = useMemo(() => buildWallSegmentsFromSemanticWalls(walls), [walls]);

  // Hooks below must run unconditionally on every render (Rules of Hooks) —
  // localBounds is null when there's nothing to bound, and the roofGeometry
  // memo below tolerates that by returning null itself, so the hook count
  // stays stable across a rawBounds null -> non-null transition on the same
  // component instance (e.g. elements populate after an empty first render).
  const cx = rawBounds ? (rawBounds.minX + rawBounds.maxX) / 2 : 0;
  const cz = rawBounds ? (rawBounds.minZ + rawBounds.maxZ) / 2 : 0;
  // Memoized so SectionCutTool's pointer-listener effect (which depends on
  // `center` by reference) doesn't re-attach on every unrelated render —
  // same fix ThreeViewer already applies to its own `center` prop.
  const center = useMemo(() => ({ cx, cz }), [cx, cz]);
  const localBounds = rawBounds
    ? { minX: rawBounds.minX - cx, maxX: rawBounds.maxX - cx, minZ: rawBounds.minZ - cz, maxZ: rawBounds.maxZ - cz }
    : null;
  const footprintWidth = localBounds ? Math.max(1, localBounds.maxX - localBounds.minX) : 1;
  const footprintDepth = localBounds ? Math.max(1, localBounds.maxZ - localBounds.minZ) : 1;
  const roofGeometry = useMemo(
    () => (!rawBounds || view === "plan" ? null : RoofGenerator.generate(roofType, rawBounds.minX, rawBounds.minZ, footprintWidth, footprintDepth, wallHeight, roofPitch)),
    [rawBounds?.minX, rawBounds?.minZ, view, roofType, footprintWidth, footprintDepth, wallHeight, roofPitch],
  );
  const dimensions = useMemo(() => (showDimensions ? generateDimensions(walls) : []), [showDimensions, walls]);
  // Section clip plane: discards geometry between the camera and the cut
  // line, revealing what's behind it (the interior), instead of rendering
  // the full unclipped model like a directional elevation would. Duplicates
  // sheetFrustum's nx/nz/midX/midZ math on purpose (same file-local pattern
  // as roofGeometry/dimensions above) — this MUST stay identical to
  // sheetFrustum's section branch or the plane misaligns from the camera.
  const clipPlanes = useMemo(() => {
    if (view !== "section" || !sectionLine) return [];
    const dx = sectionLine.x2 - sectionLine.x1, dz = sectionLine.z2 - sectionLine.z1;
    const len = Math.hypot(dx, dz);
    if (len === 0) return [];
    const midX = (sectionLine.x1 + sectionLine.x2) / 2, midZ = (sectionLine.z1 + sectionLine.z2) / 2;
    const nx = -dz / len, nz = dx / len; // unit normal, points FROM the cut line TOWARD the camera
    // Clip plane's normal must point AWAY from the camera (toward the far/
    // interior side) so THREE.js discards the near side (normal·X + constant < 0).
    const clipNormal = new THREE.Vector3(-nx, 0, -nz);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(clipNormal, new THREE.Vector3(midX, 0, midZ));
    return [plane];
  }, [view, sectionLine]);
  // @react-three/drei's <Edges> (fat lines via three-stdlib's LineMaterial,
  // a custom ShaderMaterial) does NOT visually honor `clippingPlanes` in this
  // stack, even though the plane is correctly assigned to the material and
  // `gl.localClippingEnabled` is on — verified empirically by screenshotting
  // an isolated Edges box against this exact plane. `clippingPlanes` is still
  // passed to every material below (correct per-fragment behavior for any
  // solid material, and harmless for line materials), but the wall/roof
  // wireframes that are actually visible in this renderer only disappear
  // because we skip mounting them below when they're entirely on the
  // camera's (discarded) side of the cut plane. A wall that straddles the
  // cut line itself is left fully visible (no per-fragment slice) — an
  // acceptable simplification since this line-art renderer has no poché/
  // cut-fill rendering anyway.
  const clipPlane = clipPlanes[0] ?? null;
  const visibleSegments = useMemo(() => {
    if (!clipPlane) return segments;
    return segments.filter((seg) => {
      const hw = seg.width / 2, hd = seg.depth / 2;
      const wx = seg.centerX - cx, wz = seg.centerZ - cz; // world position, matching <group position={[-cx,0,-cz]}>
      const corners: [number, number][] = [
        [wx - hw, wz - hd], [wx - hw, wz + hd], [wx + hw, wz - hd], [wx + hw, wz + hd],
      ];
      return corners.some(([x, z]) => clipPlane.distanceToPoint(new THREE.Vector3(x, 0, z)) >= 0);
    });
  }, [segments, clipPlane, cx, cz]);
  const roofFullyClipped = useMemo(() => {
    if (!clipPlane || !roofGeometry) return false;
    roofGeometry.computeBoundingBox();
    const bb = roofGeometry.boundingBox;
    if (!bb) return false;
    const corners: [number, number][] = [
      [bb.min.x - cx, bb.min.z - cz], [bb.min.x - cx, bb.max.z - cz],
      [bb.max.x - cx, bb.min.z - cz], [bb.max.x - cx, bb.max.z - cz],
    ];
    return corners.every(([x, z]) => clipPlane.distanceToPoint(new THREE.Vector3(x, 0, z)) < 0);
  }, [clipPlane, roofGeometry, cx, cz]);
  // Build the THREE.Line objects once per `dimensions` change instead of on every
  // render (camera churn, unrelated prop changes, etc.) — matches the memoization
  // convention in LineMeshes.tsx (geometry/material recreated only when coordinates change).
  const dimensionLines = useMemo(
    () => dimensions.map((d) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(d.x1, 1, d.y1),
        new THREE.Vector3(d.x2, 1, d.y2),
      ]);
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#2563eb" }));
    }),
    [dimensions],
  );

  if (!rawBounds || !localBounds) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-[10px] text-slate-500 bg-white rounded">
        Chưa có gì để hiển thị
      </div>
    );
  }

  const frustum = sheetFrustum(localBounds, view, wallHeight, 400, 100, sectionLine);

  return (
    <Canvas
      style={{ width, height, background: "#ffffff" }}
      orthographic
      camera={{ left: frustum.left, right: frustum.right, top: frustum.top, bottom: frustum.bottom, near: 0.1, far: 20000, position: frustum.position, up: frustum.up }}
    >
      <CameraAim target={frustum.target} up={frustum.up} />
      <LocalClipping />
      <ExportOnRequest requestId={exportRequestId} label={exportLabel} onDone={onExported} />
      <group position={[-cx, 0, -cz]}>
        {visibleSegments.map((seg) => (
          <mesh key={seg.id} position={[seg.centerX, (seg.heightOverride ?? wallHeight) / 2, seg.centerZ]}>
            <boxGeometry args={[seg.width, seg.heightOverride ?? wallHeight, seg.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} clippingPlanes={clipPlanes} />
            <Edges color={LINE_COLOR} clippingPlanes={clipPlanes} />
          </mesh>
        ))}
        {roofGeometry && !roofFullyClipped && (
          <mesh geometry={roofGeometry}>
            <meshBasicMaterial transparent opacity={0} depthWrite={false} clippingPlanes={clipPlanes} />
            <Edges color={LINE_COLOR} clippingPlanes={clipPlanes} />
          </mesh>
        )}
        {dimensions.map((d, i) => (
          <group key={`${d.x1},${d.y1},${d.x2},${d.y2}`}>
            <primitive object={dimensionLines[i]} />
            <Html position={[(d.x1 + d.x2) / 2, 1, (d.y1 + d.y2) / 2]} center zIndexRange={[10, 20]}>
              <div className="bg-white/90 text-blue-700 font-mono text-[8px] font-bold px-1 rounded whitespace-nowrap select-none pointer-events-none">
                {d.label}
              </div>
            </Html>
          </group>
        ))}
      </group>
      {/* Mounted as a sibling of the -cx,-cz offset group above, NOT nested inside
          it: raycastGround() already returns points in this Canvas's absolute
          (world) space, which is the *centered* space the camera itself lives in
          (sheetFrustum is built from localBounds). Nesting SectionCutTool inside
          the offset group would apply the -cx,-cz shift a second time to its
          preview line, visually detaching it from the walls it's meant to align
          with — same reason RidgeLineController is mounted as a sibling of the
          equivalent offset group in ThreeViewer.tsx, not inside it. */}
      {drawingSectionCut && onSectionCutDrawn && (
        <SectionCutTool center={center} onCommit={onSectionCutDrawn} />
      )}
    </Canvas>
  );
}
