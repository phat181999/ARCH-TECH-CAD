// Walking avatar body for the room-to-room walkthrough tool. Same
// proportions as the static scale Mannequin in ThreeViewer.tsx, with a
// simple leg-swing cycle read from a ref (not a prop) so the parent
// controller can drive it without forcing a React re-render every frame.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function AvatarMesh({ walkingRef }: { walkingRef: React.RefObject<boolean> }) {
  const legL = useRef<THREE.Mesh>(null!);
  const legR = useRef<THREE.Mesh>(null!);
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (walkingRef.current) phase.current += dt * 9;
    const swing = walkingRef.current ? Math.sin(phase.current) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });

  const mat = <meshStandardMaterial color="#fb7185" roughness={0.7} />;
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow><cylinderGeometry args={[0.22, 0.2, 0.85, 8]} />{mat}</mesh>
      <mesh position={[0, 1.62, 0]} castShadow><sphereGeometry args={[0.17, 12, 12]} />{mat}</mesh>
      <mesh ref={legL} position={[-0.12, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
      <mesh ref={legR} position={[0.12, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.075, 0.66, 6]} />{mat}
      </mesh>
    </group>
  );
}
