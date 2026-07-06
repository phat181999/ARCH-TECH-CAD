// Shared pointer→ray→(ground plane | scene meshes) casting for 3D tools.
// Replaces the per-controller copy-pasted `toGround` helpers.
import { useCallback, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export function useToolRaycast() {
  const { camera, gl, scene } = useThree();
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const toRay = useCallback((event: PointerEvent | MouseEvent): THREE.Raycaster => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    return raycaster;
  }, [camera, gl]);

  const raycastGround = useCallback((event: PointerEvent | MouseEvent): THREE.Vector3 | null => {
    const hit = new THREE.Vector3();
    return toRay(event).ray.intersectPlane(groundPlane, hit) ? hit : null;
  }, [toRay, groundPlane]);

  const raycastMeshes = useCallback((event: PointerEvent | MouseEvent): THREE.Intersection | null => {
    const hits = toRay(event).intersectObjects(scene.children, true);
    return hits.find((h) => h.object instanceof THREE.Mesh && h.object.visible) ?? null;
  }, [toRay, scene]);

  return { raycastGround, raycastMeshes };
}
