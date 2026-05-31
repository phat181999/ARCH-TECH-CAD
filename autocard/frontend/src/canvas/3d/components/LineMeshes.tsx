import { useMemo } from "react";
import * as THREE from "three";
import type { DrawingElement } from "../../../types";

export function LineMesh3D({ el, color, hovered, activeTool, onPointerOver, onPointerOut, onClick }: {
  el: DrawingElement; color: string; hovered: boolean; activeTool?: string;
  onPointerOver: (e: any) => void; onPointerOut: () => void; onClick: (e: any) => void;
}) {
  const lineObj = useMemo(() => {
    if (typeof el.x1 !== "number" || typeof el.y1 !== "number" || typeof el.x2 !== "number" || typeof el.y2 !== "number") return null;
    const pts = [new THREE.Vector3(el.x1, 0.2, el.y1), new THREE.Vector3(el.x2, 0.2, el.y2)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: hovered && activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.x1, el.y1, el.x2, el.y2, color, hovered, activeTool]);

  if (!lineObj) return null;
  return (
    <group onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
      <primitive object={lineObj} />
    </group>
  );
}

export function PolylineMesh3D({ el, color, hovered, activeTool, onPointerOver, onPointerOut, onClick }: {
  el: DrawingElement; color: string; hovered: boolean; activeTool?: string;
  onPointerOver: (e: any) => void; onPointerOut: () => void; onClick: (e: any) => void;
}) {
  const lineObj = useMemo(() => {
    if (!Array.isArray(el.points) || el.points.length < 2) return null;
    const pts = (el.points as { x: number; y: number }[]).map(p => new THREE.Vector3(p.x, 0.2, p.y));
    if (el.closed) pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: hovered && activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.points, el.closed, color, hovered, activeTool]);

  if (!lineObj) return null;
  return (
    <group onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
      <primitive object={lineObj} />
    </group>
  );
}

export function ArcMesh3D({ el, color, hovered, activeTool, onPointerOver, onPointerOut, onClick }: {
  el: DrawingElement; color: string; hovered: boolean; activeTool?: string;
  onPointerOver: (e: any) => void; onPointerOut: () => void; onClick: (e: any) => void;
}) {
  const lineObj = useMemo(() => {
    if (typeof el.cx !== "number" || typeof el.cy !== "number" || typeof el.radius !== "number") return null;
    const startAngle = typeof el.startAngle === "number" ? el.startAngle * Math.PI / 180 : 0;
    const endAngle = typeof el.endAngle === "number" ? el.endAngle * Math.PI / 180 : Math.PI * 2;
    const segments = 32;
    const pts: THREE.Vector3[] = [];
    const span = endAngle > startAngle ? endAngle - startAngle : endAngle - startAngle + Math.PI * 2;
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + (span * i) / segments;
      pts.push(new THREE.Vector3(el.cx + Math.cos(a) * el.radius, 0.2, el.cy + Math.sin(a) * el.radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: hovered && activeTool === "eraser" ? "#ef4444" : color });
    return new THREE.Line(geo, mat);
  }, [el.cx, el.cy, el.radius, el.startAngle, el.endAngle, color, hovered, activeTool]);

  if (!lineObj) return null;
  return (
    <group onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
      <primitive object={lineObj} />
    </group>
  );
}

/** Renders a flat rectangle as 4 clean edges on the ground — no internal diagonals. Supports rotation around center. */
export function RectOutline3D({ cx, cz, w, d, rotY, color, onPointerOver, onPointerOut, onClick }: {
  cx: number; cz: number; w: number; d: number; rotY: number; color: string;
  onPointerOver: (e: any) => void; onPointerOut: () => void; onClick: (e: any) => void;
}) {
  const lineObj = useMemo(() => {
    // 4 corners of the rectangle in local space (centered at origin), going round
    const hw = w / 2, hd = d / 2;
    const corners = [
      new THREE.Vector3(-hw, 0, -hd),
      new THREE.Vector3( hw, 0, -hd),
      new THREE.Vector3( hw, 0,  hd),
      new THREE.Vector3(-hw, 0,  hd),
      new THREE.Vector3(-hw, 0, -hd), // close the loop
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(corners);
    const mat = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geo, mat);
  }, [w, d, color]);

  return (
    <group
      position={[cx, 0.2, cz]}
      rotation={[0, rotY, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <primitive object={lineObj} />
    </group>
  );
}

/** Renders a flat circle outline on the ground plane. */
export function CircleOutline3D({ cx, cy, r, color, onPointerOver, onPointerOut, onClick }: {
  cx: number; cy: number; r: number; color: string;
  onPointerOver: (e: any) => void; onPointerOut: () => void; onClick: (e: any) => void;
}) {
  const lineObj = useMemo(() => {
    const segments = 48;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geo, mat);
  }, [r, color]);

  return (
    <group
      position={[cx, 0.2, cy]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <primitive object={lineObj} />
    </group>
  );
}
