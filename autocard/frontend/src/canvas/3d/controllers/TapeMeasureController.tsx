import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";

export function MeasurementLine({ start, end }: { start: THREE.Vector3, end: THREE.Vector3 }) {
  const points = useMemo(() => [start, end], [start, end]);
  const midpoint = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end]);
  const distance = useMemo(() => start.distanceTo(end) / 100, [start, end]); // 100 units = 1m
  const formatLength = useDrawingStore((state) => state.formatLength);

  return (
    <group>
      <primitive object={(() => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({ color: "#ef4444", dashSize: 4, gapSize: 2 });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        return line;
      })()} />
      <Html position={[midpoint.x, midpoint.y + 6, midpoint.z]} center>
        <div className="bg-slate-900/90 text-rose-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-rose-500/30 whitespace-nowrap shadow-md select-none">
          📏 {formatLength(distance)}
        </div>
      </Html>
    </group>
  );
}

export function TapeMeasureController({
  activeTool,
  measurePoints,
  setMeasurePoints
}: {
  activeTool: string;
  measurePoints: { start: THREE.Vector3 | null; end: THREE.Vector3 | null };
  setMeasurePoints: React.Dispatch<React.SetStateAction<{ start: THREE.Vector3 | null; end: THREE.Vector3 | null }>>;
}) {
  const { camera, scene, gl } = useThree();
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (activeTool !== "measure") {
      setHoverPoint(null);
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(x, y);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible) {
          targets.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(targets, true);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        if (!measurePoints.start) {
          setMeasurePoints({ start: pt.clone(), end: null });
        } else if (!measurePoints.end) {
          setMeasurePoints({ start: measurePoints.start, end: pt.clone() });
        } else {
          setMeasurePoints({ start: pt.clone(), end: null });
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const mouse = new THREE.Vector2(x, y);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const targets: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible) {
          targets.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(targets, true);
      if (intersects.length > 0) {
        setHoverPoint(intersects[0].point);
      } else {
        setHoverPoint(null);
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    gl.domElement.addEventListener("pointermove", handlePointerMove);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
    };
  }, [activeTool, measurePoints, camera, scene, gl, setMeasurePoints]);

  if (activeTool !== "measure") return null;

  const showStart = measurePoints.start;
  const showEnd = measurePoints.end || hoverPoint;

  return (
    <group>
      {showStart && (
        <mesh position={showStart}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} />
        </mesh>
      )}
      {showEnd && (
        <mesh position={showEnd}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} />
        </mesh>
      )}
      {showStart && showEnd && (
        <MeasurementLine start={showStart} end={showEnd} />
      )}
    </group>
  );
}
