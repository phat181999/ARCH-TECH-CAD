import { useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { worldToDrawingXY, makeWallElement, isValidWall } from "../geometry/wallDraw";
import { useDrawingStore } from "../../../stores/drawingStore";

// Click-click wall drawing in 3D. Raycasts the ground plane, previews the
// segment, and on the second click commits a wall as a DrawingElement
// (archType:"wall") to the active store — so it renders in 2D and 3D and
// persists. Chains: the end point becomes the next start. Escape ends the chain.
export function WallDrawController({
  activeTool,
  center,
}: {
  activeTool: string;
  center: { cx: number; cz: number };
}) {
  const { camera, scene, gl } = useThree();
  const [startWorld, setStartWorld] = useState<THREE.Vector3 | null>(null);
  const [hoverWorld, setHoverWorld] = useState<THREE.Vector3 | null>(null);
  const formatLength = useDrawingStore((s) => s.formatLength);

  const active = activeTool === "wall3d";

  // Raycast against the ground plane (y = 0) so clicks land on the floor even
  // where there is no geometry yet.
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    if (!active) {
      setStartWorld(null);
      setHoverWorld(null);
      return;
    }

    const toGround = (event: PointerEvent): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hit = new THREE.Vector3();
      return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return; // left click only
      const pt = toGround(event);
      if (!pt) return;
      if (!startWorld) {
        setStartWorld(pt.clone());
        return;
      }
      const a = worldToDrawingXY({ x: startWorld.x, z: startWorld.z }, center);
      const b = worldToDrawingXY({ x: pt.x, z: pt.z }, center);
      if (isValidWall(a, b)) {
        const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
        addElement(makeWallElement(a, b, {
          layerId: activeLayerId,
          strokeColor: currentStyle?.strokeColor,
        }));
      }
      setStartWorld(pt.clone()); // chain: continue from the last point
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pt = toGround(event);
      setHoverWorld(pt);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setStartWorld(null); setHoverWorld(null); }
    };
    const handleDblClick = () => { setStartWorld(null); };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("dblclick", handleDblClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("dblclick", handleDblClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, startWorld, camera, scene, gl, groundPlane, center]);

  if (!active) return null;

  const previewEnd = hoverWorld;
  const previewLen = startWorld && previewEnd
    ? startWorld.distanceTo(previewEnd) / 100 // 100 scene units = 1m (matches tape measure)
    : 0;

  return (
    <group>
      {startWorld && (
        <mesh position={startWorld}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#22c55e" depthTest={false} />
        </mesh>
      )}
      {startWorld && previewEnd && (
        <>
          <primitive object={(() => {
            const geo = new THREE.BufferGeometry().setFromPoints([startWorld, previewEnd]);
            return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#22c55e" }));
          })()} />
          <Html position={[(startWorld.x + previewEnd.x) / 2, 8, (startWorld.z + previewEnd.z) / 2]} center>
            <div className="bg-slate-900/90 text-emerald-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap shadow-md select-none">
              🧱 {formatLength(previewLen)}
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
