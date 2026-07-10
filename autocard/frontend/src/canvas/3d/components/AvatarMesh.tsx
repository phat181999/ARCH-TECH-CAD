// Walking avatar body for the room-to-room walkthrough tool. Same
// proportions as the static scale Mannequin in ThreeViewer.tsx, with a
// simple leg-swing cycle read from a ref (not a prop) so the parent
// controller can drive it without forcing a React re-render every frame.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function AvatarMesh({ walkingRef }: { walkingRef: React.RefObject<boolean> }) {
  // Groups (not meshes) so each swinging limb carries its hand/shoe along
  // with it instead of leaving them behind mid-stride.
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (walkingRef.current) phase.current += dt * 9;
    const swing = walkingRef.current ? Math.sin(phase.current) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.6;
    if (armR.current) armR.current.rotation.x = swing * 0.6;
  });

  // Same low-poly business-suit look as the static scale Mannequin
  // (ThreeViewer.tsx) — flat-shaded faceted geometry, white collar, tie,
  // charcoal jacket + trousers, dark hair/shoes — so the walkthrough figure
  // reads as the same person instead of a cruder single-color placeholder.
  const skin  = <meshStandardMaterial color="#d9a679" roughness={0.85} flatShading />;
  const hair  = <meshStandardMaterial color="#2e2418" roughness={0.9} flatShading />;
  const suit  = <meshStandardMaterial color="#2e3340" roughness={0.8} flatShading />;
  const shirt = <meshStandardMaterial color="#f2f2ef" roughness={0.8} flatShading />;
  const tie   = <meshStandardMaterial color="#1c1f26" roughness={0.7} flatShading />;
  const shoe  = <meshStandardMaterial color="#141414" roughness={0.6} flatShading />;

  return (
    <group>
      <mesh position={[0, 1.7, -0.02]} castShadow><icosahedronGeometry args={[0.13, 0]} />{hair}</mesh>
      <mesh position={[0, 1.62, 0]} castShadow><icosahedronGeometry args={[0.15, 1]} />{skin}</mesh>
      <mesh position={[0, 1.48, 0]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.08, 6]} />{skin}</mesh>
      <mesh position={[-0.05, 1.42, 0.09]} rotation={[0.3, 0, 0.5]} castShadow><boxGeometry args={[0.07, 0.1, 0.02]} />{shirt}</mesh>
      <mesh position={[0.05, 1.42, 0.09]} rotation={[0.3, 0, -0.5]} castShadow><boxGeometry args={[0.07, 0.1, 0.02]} />{shirt}</mesh>
      <mesh position={[0, 1.28, 0.12]} castShadow><boxGeometry args={[0.045, 0.28, 0.015]} />{tie}</mesh>
      <mesh position={[0, 1.13, 0]} castShadow><capsuleGeometry args={[0.2, 0.4, 2, 8]} />{suit}</mesh>
      <mesh position={[-0.1, 1.32, 0.1]} rotation={[0.2, 0, 0.4]} castShadow><boxGeometry args={[0.1, 0.2, 0.015]} />{suit}</mesh>
      <mesh position={[0.1, 1.32, 0.1]} rotation={[0.2, 0, -0.4]} castShadow><boxGeometry args={[0.1, 0.2, 0.015]} />{suit}</mesh>

      <group ref={armL} position={[-0.27, 1.06, 0]} rotation={[0, 0, Math.PI / 26]}>
        <mesh castShadow><capsuleGeometry args={[0.06, 0.42, 2, 8]} />{suit}</mesh>
        <mesh position={[0, -0.27, 0]} castShadow><icosahedronGeometry args={[0.055, 0]} />{skin}</mesh>
      </group>
      <group ref={armR} position={[0.27, 1.06, 0]} rotation={[0, 0, -Math.PI / 26]}>
        <mesh castShadow><capsuleGeometry args={[0.06, 0.42, 2, 8]} />{suit}</mesh>
        <mesh position={[0, -0.27, 0]} castShadow><icosahedronGeometry args={[0.055, 0]} />{skin}</mesh>
      </group>

      <group ref={legL} position={[-0.1, 0.38, 0]}>
        <mesh castShadow><capsuleGeometry args={[0.085, 0.52, 2, 8]} />{suit}</mesh>
        <mesh position={[0, -0.335, 0.04]} castShadow><boxGeometry args={[0.09, 0.06, 0.19]} />{shoe}</mesh>
      </group>
      <group ref={legR} position={[0.1, 0.38, 0]}>
        <mesh castShadow><capsuleGeometry args={[0.085, 0.52, 2, 8]} />{suit}</mesh>
        <mesh position={[0, -0.335, 0.04]} castShadow><boxGeometry args={[0.09, 0.06, 0.19]} />{shoe}</mesh>
      </group>
    </group>
  );
}
