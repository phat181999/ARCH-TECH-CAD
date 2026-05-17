import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls } from "@react-three/drei";
import * as THREE from "three";

// Convert 2D elements to 3D meshes
function elementToMesh(el, blockDefs) {
  if (!el) return null;

  const color = el.strokeColor || "#1f2937";
  const fillColor = el.fillColor && el.fillColor !== "transparent" ? el.fillColor : null;

  if (el.type === "rectangle") {
    const geometry = new THREE.BoxGeometry(el.width || 1, 0.2, el.height || 1);
    const material = new THREE.MeshStandardMaterial({
      color: fillColor || color,
      transparent: !fillColor,
      opacity: fillColor ? 1 : 0.3,
      wireframe: !fillColor,
    });
    return (
      <mesh
        key={el.id}
        geometry={geometry}
        material={material}
        position={[(el.x || 0) + (el.width || 0) / 2, 0, (el.y || 0) + (el.height || 0) / 2]}
      />
    );
  }

  if (el.type === "circle") {
    const geometry = new THREE.CylinderGeometry(el.radius || 1, el.radius || 1, 0.2, 32);
    const material = new THREE.MeshStandardMaterial({
      color: fillColor || color,
      transparent: !fillColor,
      opacity: fillColor ? 1 : 0.3,
      wireframe: !fillColor,
    });
    return (
      <mesh
        key={el.id}
        geometry={geometry}
        material={material}
        position={[el.cx || 0, 0, el.cy || 0]}
      />
    );
  }

  if (el.type === "line") {
    const points = [
      new THREE.Vector3(el.x1 || 0, 0, el.y1 || 0),
      new THREE.Vector3(el.x2 || 0, 0, el.y2 || 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    return <line key={el.id} geometry={geometry} material={material} />;
  }

  if (el.type === "block") {
    const blockDef = blockDefs?.[el.blockId];
    if (!blockDef) return null;
    return (
      <group
        key={el.id}
        position={[el.x || 0, 0, el.y || 0]}
        scale={[el.scale || 1, 1, el.scale || 1]}
        rotation={[0, ((el.rotation || 0) * Math.PI) / 180, 0]}
      >
        {blockDef.elements.map((be) => elementToMesh(be, blockDefs))}
      </group>
    );
  }

  return null;
}

function Scene({ elements, blockDefs, selectedIds, onSelect }) {
  const meshes = useMemo(() => {
    return elements.map((el) => elementToMesh(el, blockDefs)).filter(Boolean);
  }, [elements, blockDefs]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <Grid
        position={[0, -0.1, 0]}
        args={[200, 200]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#6b7280"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#9ca3af"
        fadeDistance={500}
      />
      {meshes}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={500}
      />
    </>
  );
}

export default function ThreeViewer({ elements, blockDefs, visible }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 bg-gray-900">
      <Canvas
        camera={{ position: [100, 100, 100], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true }}
      >
        <Scene elements={elements} blockDefs={blockDefs} />
      </Canvas>
    </div>
  );
}