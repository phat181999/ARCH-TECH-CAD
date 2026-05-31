import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { DrawingState, ShapeWithDepth } from "../types";

export function DrawOnFaceController({
  activeTool,
  onDrawingClosed,
  activeDrawingState,
  setActiveDrawingState
}: {
  activeTool: string;
  onDrawingClosed: (points2D: THREE.Vector2[], basisMatrix: THREE.Matrix4, normal: THREE.Vector3, origin: THREE.Vector3) => void;
  activeDrawingState: DrawingState | null;
  setActiveDrawingState: React.Dispatch<React.SetStateAction<DrawingState | null>>;
}) {
  const { camera, scene, gl } = useThree();
  const [previewPoint, setPreviewPoint] = useState<THREE.Vector3 | null>(null);
  const [isNearStart, setIsNearStart] = useState(false);

  useEffect(() => {
    if (activeTool !== "line") {
      setPreviewPoint(null);
      setIsNearStart(false);
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
        if (
          obj instanceof THREE.Mesh &&
          obj.name !== "grid" &&
          obj.visible &&
          !obj.name.includes("helper") &&
          obj.geometry
        ) {
          targets.push(obj);
        }
      });

      if (!activeDrawingState) {
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (!hit.face) return;

          const hitNormal = hit.face.normal.clone();
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
          hitNormal.applyMatrix3(normalMatrix).normalize();

          const hitPoint = hit.point;

          let u = new THREE.Vector3();
          let v = new THREE.Vector3();
          if (Math.abs(hitNormal.y) > 0.999) {
            u.set(1, 0, 0);
            v.set(0, 0, 1).projectOnPlane(hitNormal).normalize();
            u.projectOnPlane(hitNormal).normalize();
          } else {
            u.crossVectors(new THREE.Vector3(0, 1, 0), hitNormal).normalize();
            v.crossVectors(hitNormal, u).normalize();
          }

          const basisMatrix = new THREE.Matrix4().makeBasis(u, v, hitNormal);
          basisMatrix.setPosition(hitPoint);

          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(hitNormal, hitPoint);

          setActiveDrawingState({
            plane,
            basisMatrix,
            normal: hitNormal,
            u,
            v,
            origin: hitPoint,
            points2D: [new THREE.Vector2(0, 0)],
            points3D: [hitPoint.clone()],
          });
        }
      } else {
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(activeDrawingState.plane, intersection)) {
          const startPt = activeDrawingState.points3D[0];
          const dist = startPt.distanceTo(intersection);

          if (dist < 15 && activeDrawingState.points2D.length >= 3) {
            onDrawingClosed(
              activeDrawingState.points2D,
              activeDrawingState.basisMatrix,
              activeDrawingState.normal,
              activeDrawingState.origin
            );
            setActiveDrawingState(null);
            setPreviewPoint(null);
            setIsNearStart(false);
          } else {
            const relative = intersection.clone().sub(activeDrawingState.origin);
            const uCoord = relative.dot(activeDrawingState.u);
            const vCoord = relative.dot(activeDrawingState.v);

            setActiveDrawingState({
              ...activeDrawingState,
              points2D: [...activeDrawingState.points2D, new THREE.Vector2(uCoord, vCoord)],
              points3D: [...activeDrawingState.points3D, intersection.clone()],
            });
          }
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

      if (!activeDrawingState) {
        const targets: THREE.Object3D[] = [];
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.visible && obj.name !== "grid" && !obj.name.includes("helper")) {
            targets.push(obj);
          }
        });
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
          setPreviewPoint(intersects[0].point);
        } else {
          setPreviewPoint(null);
        }
        setIsNearStart(false);
      } else {
        const intersection = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(activeDrawingState.plane, intersection)) {
          const startPt = activeDrawingState.points3D[0];
          const dist = startPt.distanceTo(intersection);

          if (dist < 15 && activeDrawingState.points2D.length >= 3) {
            setPreviewPoint(startPt.clone());
            setIsNearStart(true);
          } else {
            setPreviewPoint(intersection.clone());
            setIsNearStart(false);
          }
        } else {
          setPreviewPoint(null);
        }
      }
    };

    gl.domElement.addEventListener("pointerdown", handlePointerDown);
    gl.domElement.addEventListener("pointermove", handlePointerMove);

    return () => {
      gl.domElement.removeEventListener("pointerdown", handlePointerDown);
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
    };
  }, [activeTool, activeDrawingState, camera, scene, gl, onDrawingClosed, setActiveDrawingState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDrawingState(null);
        setPreviewPoint(null);
        setIsNearStart(false);
      } else if (event.key === "Enter" && activeDrawingState && activeDrawingState.points2D.length >= 3) {
        onDrawingClosed(
          activeDrawingState.points2D,
          activeDrawingState.basisMatrix,
          activeDrawingState.normal,
          activeDrawingState.origin
        );
        setActiveDrawingState(null);
        setPreviewPoint(null);
        setIsNearStart(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDrawingState, onDrawingClosed, setActiveDrawingState]);

  if (!activeDrawingState || activeDrawingState.points3D.length === 0) {
    if (previewPoint && activeTool === "line") {
      return (
        <mesh position={previewPoint}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#22d3ee" depthTest={false} />
        </mesh>
      );
    }
    return null;
  }

  const linesPoints = [...activeDrawingState.points3D];
  if (previewPoint) {
    linesPoints.push(previewPoint);
  }

  return (
    <group>
      <primitive object={(() => {
        const geometry = new THREE.BufferGeometry().setFromPoints(linesPoints);
        const material = new THREE.LineBasicMaterial({ color: "#22d3ee", linewidth: 3 });
        return new THREE.Line(geometry, material);
      })()} />
      {previewPoint && (
        <mesh position={previewPoint}>
          <sphereGeometry args={[isNearStart ? 2.5 : 1.5, 16, 16]} />
          <meshBasicMaterial color={isNearStart ? "#22c55e" : "#22d3ee"} />
        </mesh>
      )}
    </group>
  );
}

export function DrawnPolygonShape({ shape }: { shape: ShapeWithDepth }) {
  const groupRef = useRef<THREE.Group>(null);

  const threeShape = useMemo(() => {
    const s = new THREE.Shape();
    const pts = shape.points2D;
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i].x, pts[i].y);
    }
    s.closePath();
    return s;
  }, [shape.points2D]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.matrix.copy(shape.basisMatrix);
      groupRef.current.matrixAutoUpdate = false;
    }
  }, [shape.basisMatrix]);

  const hasExtrusion = Math.abs(shape.depth) > 0.01;

  return (
    <group ref={groupRef}>
      {hasExtrusion ? (
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[threeShape, { depth: shape.depth, bevelEnabled: false }]} />
          <meshStandardMaterial color="#e8edf2" side={THREE.DoubleSide} />
          <Edges color="#3a4a5a" threshold={10} />
        </mesh>
      ) : (
        <mesh receiveShadow>
          <shapeGeometry args={[threeShape]} />
          <meshStandardMaterial
            color="#e8edf2"
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1.0}
            polygonOffsetUnits={-1.0}
          />
          <Edges color="#3a4a5a" threshold={10} />
        </mesh>
      )}
    </group>
  );
}
