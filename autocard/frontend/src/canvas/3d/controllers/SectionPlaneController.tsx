// Visualizes the active section plane and lets the user drag it along its
// axis. Dragging updates sceneSlice.section.offset live.
import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";

export function SectionPlaneController({ span, orbitTarget }: { span: number; orbitTarget: [number, number, number] }) {
  const section = useDrawingStore((s) => s.section);
  const setSection = useDrawingStore((s) => s.setSection);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ mouse: number; offset: number }>({ mouse: 0, offset: 0 });

  if (!section.enabled) return null;

  const size = Math.max(600, span * 1.2);
  const pos: [number, number, number] =
    section.axis === "x" ? [section.offset, size / 4, orbitTarget[2]]
    : section.axis === "y" ? [orbitTarget[0], section.offset, orbitTarget[2]]
    : [orbitTarget[0], size / 4, section.offset];
  const rot: [number, number, number] =
    section.axis === "x" ? [0, Math.PI / 2, 0]
    : section.axis === "y" ? [-Math.PI / 2, 0, 0]
    : [0, 0, 0];

  return (
    <group>
      <mesh
        position={pos}
        rotation={rot}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          startRef.current = { mouse: section.axis === "y" ? e.clientY : e.clientX, offset: section.offset };
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          e.stopPropagation();
          const cur = section.axis === "y" ? e.clientY : e.clientX;
          const delta = (section.axis === "y" ? -(cur - startRef.current.mouse) : cur - startRef.current.mouse) * (span / 500);
          setSection({ offset: startRef.current.offset + delta });
        }}
        onPointerUp={() => setDragging(false)}
      >
        <planeGeometry args={[size, size / 2]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={dragging ? 0.25 : 0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html position={[pos[0], pos[1] + size / 4 + 10, pos[2]]} center>
        <div className="bg-blue-700/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap select-none">
          Section {section.axis.toUpperCase()} — drag to move
        </div>
      </Html>
    </group>
  );
}
