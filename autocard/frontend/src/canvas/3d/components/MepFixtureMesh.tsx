// Wall-mounted MEP fixtures (công tắc, ổ cắm, hộp nối, tủ điện, van, co ống).
// Anchor = 2D marker rect center; `elevation` (cm) is the mounting height;
// `rotation` matches the wall angle so plates sit flush against the wall.
import type { DrawingElement } from "../../../types";

export function MepFixtureMesh({ el, cx, cz }: { el: DrawingElement; cx: number; cz: number }) {
  const x = (el.x ?? 0) + (el.width ?? 0) / 2 - cx;
  const z = (el.y ?? 0) + (el.height ?? 0) / 2 - cz;
  const y = (el.elevation as number | undefined) ?? 110;
  const rotY = -((el.rotation ?? 0) * Math.PI) / 180;
  const kind = el.fixtureType ?? "switch";

  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {kind === "switch" && (
        <>
          <mesh castShadow><boxGeometry args={[18, 28, 3]} /><meshStandardMaterial color="#f4efe6" roughness={0.35} /></mesh>
          <mesh position={[0, 0, 2.5]} castShadow><boxGeometry args={[8, 12, 2]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>
        </>
      )}
      {kind === "socket" && (
        <>
          <mesh castShadow><boxGeometry args={[18, 28, 3]} /><meshStandardMaterial color="#f4efe6" roughness={0.35} /></mesh>
          <mesh position={[0, 0, 2.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[8, 8, 2, 20]} /><meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          {[-2.5, 2.5].map((px) => (
            <mesh key={px} position={[px, 2, 3.6]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 2, 10]} /><meshStandardMaterial color="#2b2b2b" />
            </mesh>
          ))}
        </>
      )}
      {kind === "juncbox" && (
        <>
          <mesh position={[0, -10, 0]} castShadow><boxGeometry args={[26, 1.5, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[-13, 0, 0]} castShadow><boxGeometry args={[1.5, 20, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[13, 0, 0]} castShadow><boxGeometry args={[1.5, 20, 18]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 0, -9]} castShadow><boxGeometry args={[26, 20, 1.5]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 0, 9]} castShadow><boxGeometry args={[26, 20, 1.5]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          {[-6, 2, 10].map((px) => (
            <mesh key={px} position={[px, -5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[2, 2, 5, 10]} /><meshStandardMaterial color="#d9832e" roughness={0.4} />
            </mesh>
          ))}
        </>
      )}
      {kind === "dboard" && (
        <>
          <mesh position={[0, 0, -6]} castShadow><boxGeometry args={[50, 40, 2]} /><meshStandardMaterial color="#d9c9a8" roughness={0.55} /></mesh>
          <mesh position={[0, 5, -1]} castShadow><boxGeometry args={[42, 2, 3]} /><meshStandardMaterial color="#9aa0a6" metalness={0.7} roughness={0.35} /></mesh>
          {[-14, 0, 14].map((px) => (
            <group key={px}>
              <mesh position={[px, 13, 1]} castShadow><boxGeometry args={[8, 16, 7]} /><meshStandardMaterial color="#2b2b2b" roughness={0.5} /></mesh>
              <mesh position={[px, 19, 4]} castShadow><boxGeometry args={[3, 6, 2]} /><meshStandardMaterial color="#d8442e" roughness={0.35} /></mesh>
            </group>
          ))}
          <mesh position={[0, -8, -2]} castShadow><boxGeometry args={[42, 2, 1.5]} /><meshStandardMaterial color="#c79a4b" metalness={0.85} roughness={0.25} /></mesh>
        </>
      )}
      {kind === "valve" && (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[9, 9, 22, 16]} /><meshStandardMaterial color="#2f6fb0" roughness={0.45} metalness={0.2} /></mesh>
          <mesh position={[0, 12, 0]} castShadow><cylinderGeometry args={[1.5, 1.5, 14, 8]} /><meshStandardMaterial color="#c79a4b" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[0, 20, 0]} castShadow><boxGeometry args={[16, 3, 5]} /><meshStandardMaterial color="#d8442e" roughness={0.4} /></mesh>
          {[-18, 18].map((px) => (
            <mesh key={px} position={[px, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[5, 5, 14, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
            </mesh>
          ))}
        </>
      )}
      {kind === "elbow" && (
        <>
          <mesh position={[-14, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[14, 5, 12, 20, Math.PI / 2]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
          <mesh position={[-29, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[5, 5, 30, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
          <mesh position={[-14, 29, 0]} castShadow>
            <cylinderGeometry args={[5, 5, 30, 12]} /><meshStandardMaterial color="#8b96a0" roughness={0.55} />
          </mesh>
        </>
      )}
    </group>
  );
}
