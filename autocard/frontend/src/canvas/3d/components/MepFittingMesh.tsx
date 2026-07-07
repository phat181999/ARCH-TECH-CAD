// Renders the fitting appropriate to a joint/end detected by computeMepJoints.
// Round systems get a sphere at bends (fills any bend angle without needing
// the exact angle — a true mitred elbow is a stretch goal, see the design
// spec's Phase 9); electric always gets a box, matching how conduit actually
// turns corners through a junction box rather than bending smoothly.
import type { MepJoint } from "../geometry/mepJoints";

const UNITS_PER_MM = 0.1; // matches PipeMesh.tsx's own conversion
const SYSTEM_COLORS: Record<string, string> = {
  water: "#0284c7", hvac: "#06b6d4", drain: "#ea580c", electric: "#ca8a04", gas: "#dc2626",
};

export function MepFittingMesh({ joint, cx, cz }: { joint: MepJoint; cx: number; cz: number }) {
  const radius = (joint.diameter / 2) * UNITS_PER_MM;
  const position: [number, number, number] = [joint.x - cx, joint.elevation, joint.y - cz];
  const color = SYSTEM_COLORS[joint.system] ?? SYSTEM_COLORS.water;

  if (joint.system === "electric") {
    const s = Math.max(radius * 3, 3);
    return (
      <mesh position={position} castShadow>
        <boxGeometry args={[s, s, s]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
      </mesh>
    );
  }

  if (joint.kind === "joint") {
    return (
      <mesh position={position} castShadow>
        <sphereGeometry args={[radius * 1.15, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.4} />
      </mesh>
    );
  }

  if (joint.system === "drain") {
    return (
      <mesh position={position} castShadow>
        <cylinderGeometry args={[radius * 1.3, radius * 1.3, radius * 0.8, 16]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.7} />
      </mesh>
    );
  }

  if (joint.system === "hvac") {
    return (
      <mesh position={position} castShadow>
        <boxGeometry args={[radius * 2.4, radius * 0.6, radius * 2.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} metalness={0.2} />
      </mesh>
    );
  }

  // water / gas — valve body + handle disc
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[radius * 1.4, radius * 1.4, radius * 1.2, 12]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[0, radius, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.6, radius * 1.6, radius * 0.3, 12]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}
