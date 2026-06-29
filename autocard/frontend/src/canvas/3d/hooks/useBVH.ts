/**
 * useBVH — builds a BVH (Bounding Volume Hierarchy) acceleration structure on
 * a BufferGeometry for fast raycasting. Used by selection and clash detection.
 *
 * Patches THREE.Mesh.raycast globally once so all meshes in the scene benefit
 * from accelerated picking without per-mesh opt-in.
 *
 * Note: the project has two copies of three-mesh-bvh in node_modules (one
 * nested inside @react-three/drei, one direct). To avoid a structural-type
 * mismatch between these two versions we use `unknown` as the intermediate
 * cast when attaching the BVH to the geometry.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

// Apply the BVH-backed raycast to every THREE.Mesh globally (idempotent)
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * useBVHGeometry — memoises BVH construction so it only runs when the
 * geometry reference changes (e.g. after a DXF reload).
 *
 * @param geometry  The BufferGeometry to accelerate
 * @returns         The same geometry reference with `.boundsTree` attached
 */
export function useBVHGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return useMemo(() => {
    if (!geometry || !geometry.attributes.position) return geometry;
    // Use double cast (via unknown) to bridge the structural mismatch between
    // the two installed copies of three-mesh-bvh (direct vs nested in
    // @react-three/drei). The runtime shape is correct; this is purely a
    // type-level workaround for the duplicated package.
    (geometry as unknown as Record<string, unknown>).boundsTree =
      new MeshBVH(geometry) as unknown;
    return geometry;
  }, [geometry]);
}
