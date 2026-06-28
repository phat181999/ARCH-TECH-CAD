import { useMemo } from "react";
import * as THREE from "three";
import type { Season, NeighborhoodContext } from "../../../stores/slices/sceneSlice";

interface NeighborDef {
  offsetX: number;
  offsetZ: number;
  width: number;
  depth: number;
  floors: number;
  facadeColor: string;
  roofType: "flat" | "gable";
}

const FLOOR_HEIGHT = 300; // units per storey

// Slot positions around the lot (relative to scene origin)
const SUBURBAN_SLOTS: Omit<NeighborDef, "floors" | "facadeColor" | "roofType">[] = [
  { offsetX: -900,  offsetZ:  0,    width: 600, depth: 500 },
  { offsetX:  900,  offsetZ:  0,    width: 550, depth: 480 },
  { offsetX:  0,    offsetZ: -900,  width: 700, depth: 450 },
  { offsetX: -900,  offsetZ: -600,  width: 500, depth: 400 },
  { offsetX:  900,  offsetZ: -600,  width: 520, depth: 420 },
  { offsetX:  0,    offsetZ: -1400, width: 650, depth: 500 },
];

const URBAN_SLOTS: Omit<NeighborDef, "floors" | "facadeColor" | "roofType">[] = [
  { offsetX: -550,  offsetZ:  0,    width: 350, depth: 500 },
  { offsetX:  550,  offsetZ:  0,    width: 380, depth: 500 },
  { offsetX: -900,  offsetZ:  0,    width: 320, depth: 500 },
  { offsetX:  900,  offsetZ:  0,    width: 340, depth: 500 },
  { offsetX:  0,    offsetZ: -800,  width: 700, depth: 400 },
  { offsetX:  0,    offsetZ: -1200, width: 700, depth: 400 },
];

const HIGHRISE_SLOTS: Omit<NeighborDef, "floors" | "facadeColor" | "roofType">[] = [
  { offsetX: -1400, offsetZ: -800,  width: 800, depth: 600 },
  { offsetX:  1400, offsetZ: -800,  width: 750, depth: 600 },
  { offsetX:  0,    offsetZ: -1800, width: 900, depth: 700 },
  { offsetX: -800,  offsetZ: -1600, width: 600, depth: 500 },
  { offsetX:  800,  offsetZ: -1600, width: 650, depth: 550 },
  { offsetX:  0,    offsetZ: -2400, width: 1000, depth: 800 },
];

const FACADE_COLORS = ["#e8d5b0", "#c9b99a", "#d4c5a9", "#b8a88a", "#e2cfa8", "#d8c4a0"];
const URBAN_COLORS  = ["#8a9ba8", "#7a8b95", "#6b7d87", "#95a8b5", "#8597a3", "#7b8f9a"];

function getSlots(ctx: NeighborhoodContext): Omit<NeighborDef, "floors" | "facadeColor" | "roofType">[] {
  if (ctx === "urban")    return URBAN_SLOTS;
  if (ctx === "highrise") return HIGHRISE_SLOTS;
  return SUBURBAN_SLOTS;
}

function buildNeighborDefs(ctx: NeighborhoodContext, count: number): NeighborDef[] {
  const slots   = getSlots(ctx);
  const isHigh  = ctx === "highrise";
  const isUrban = ctx === "urban";
  return slots.slice(0, count).map((slot, i) => ({
    ...slot,
    floors: isHigh
      ? 6 + Math.floor(i * 1.5)
      : isUrban
        ? 3 + (i % 3)
        : 1 + (i % 2),
    facadeColor: isUrban
      ? URBAN_COLORS[i % URBAN_COLORS.length]
      : FACADE_COLORS[i % FACADE_COLORS.length],
    roofType: isUrban || isHigh ? "flat" : (i % 3 === 0 ? "gable" : "flat"),
  }));
}

// Simple window grid texture
function makeWindowTexture(floors: number, facadeColor: string): THREE.CanvasTexture {
  const W = 256, H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = facadeColor;
  ctx.fillRect(0, 0, W, H);

  const cols = 3, rows = floors * 2;
  const winW = W / (cols * 2.5), winH = H / (rows * 2.5);
  ctx.fillStyle = "#b8d4f0";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * (W / cols) - winW / 2;
      const y = (r + 0.5) * (H / rows) - winH / 2;
      ctx.fillRect(x, y, winW, winH);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

interface NeighborBuildingsProps {
  context: NeighborhoodContext;
  count: number;
  season: Season;
}

function SingleNeighbor({ def, season }: { def: NeighborDef; season: Season }) {
  const bodyHeight = def.floors * FLOOR_HEIGHT;
  const texture    = useMemo(() => makeWindowTexture(def.floors, def.facadeColor), [def.floors, def.facadeColor]);
  const snowCap    = season === "winter";

  return (
    <group position={[def.offsetX, 0, def.offsetZ]}>
      {/* Building body */}
      <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[def.width, bodyHeight, def.depth]} />
        <meshStandardMaterial map={texture} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Gable roof */}
      {def.roofType === "gable" && (
        <mesh position={[0, bodyHeight + 80, 0]} castShadow>
          <coneGeometry args={[Math.max(def.width, def.depth) * 0.7, 160, 4]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
        </mesh>
      )}

      {/* Snow cap in winter */}
      {snowCap && (
        <mesh position={[0, bodyHeight + (def.roofType === "gable" ? 165 : 4), 0]}>
          <boxGeometry args={[def.width + 10, 8, def.depth + 10]} />
          <meshStandardMaterial color="#e8f0f8" roughness={0.5} metalness={0} />
        </mesh>
      )}
    </group>
  );
}

export function NeighborBuildings({ context, count, season }: NeighborBuildingsProps) {
  const defs = useMemo(
    () => buildNeighborDefs(context, Math.min(count, 6)),
    [context, count]
  );

  if (context === "none" || count === 0 || defs.length === 0) return null;

  return (
    <group>
      {defs.map((def, i) => (
        <SingleNeighbor key={i} def={def} season={season} />
      ))}
    </group>
  );
}
