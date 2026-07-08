// src/canvas/3d/components/ViewRenderer.tsx
// Standalone line-art renderer for the Views tab — a separate, lightweight
// <Canvas> (not the interactive 3D viewer's scene) that draws walls/roof as
// edge-only geometry through a fixed orthographic camera. Kept independent
// of ThreeViewer.tsx on purpose (matches the 3D-first doc's Phase 1B:
// "embedded Canvas riêng... không dùng chung với 3D scene để tránh
// conflict") so nothing here can destabilize the interactive 3D viewer.
import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { getPlanBounds } from "../geometry/planClassification";
import { buildWallSegmentsFromSemanticWalls } from "../geometry/wallGeometry";
import { RoofGenerator, type RoofType } from "../geometry/RoofGenerator";
import { sheetFrustum, type SheetView, type SectionLine } from "../geometry/sheetCamera";

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

export interface ViewRendererProps {
  elements: DrawingElement[];
  view: SheetView;
  sectionLine?: SectionLine;
  width: number;
  height: number;
  wallHeight: number;
  roofType?: RoofType;
  roofPitch?: number;
}

export function ViewRenderer({ elements, view, sectionLine, width, height, wallHeight, roofType = "gable", roofPitch = 30 }: ViewRendererProps) {
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
  const localBounds = rawBounds
    ? { minX: rawBounds.minX - cx, maxX: rawBounds.maxX - cx, minZ: rawBounds.minZ - cz, maxZ: rawBounds.maxZ - cz }
    : null;
  const footprintWidth = localBounds ? Math.max(1, localBounds.maxX - localBounds.minX) : 1;
  const footprintDepth = localBounds ? Math.max(1, localBounds.maxZ - localBounds.minZ) : 1;
  const roofGeometry = useMemo(
    () => (!localBounds || view === "plan" ? null : RoofGenerator.generate(roofType, localBounds.minX, localBounds.minZ, footprintWidth, footprintDepth, wallHeight, roofPitch)),
    [localBounds, view, roofType, footprintWidth, footprintDepth, wallHeight, roofPitch],
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
      <group position={[-cx, 0, -cz]}>
        {segments.map((seg) => (
          <mesh key={seg.id} position={[seg.centerX, (seg.heightOverride ?? wallHeight) / 2, seg.centerZ]}>
            <boxGeometry args={[seg.width, seg.heightOverride ?? wallHeight, seg.depth]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color={LINE_COLOR} />
          </mesh>
        ))}
        {roofGeometry && (
          <mesh geometry={roofGeometry}>
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color={LINE_COLOR} />
          </mesh>
        )}
      </group>
    </Canvas>
  );
}
