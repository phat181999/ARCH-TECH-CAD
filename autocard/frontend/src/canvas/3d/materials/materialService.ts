import * as THREE from "three";
import { resolveProceduralTexture } from "./proceduralTextures";

export interface MaterialProps {
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  // Enhanced PBR properties
  emissive?: string;
  emissiveIntensity?: number;
  // Texture paths (loaded lazily when useTextures=true)
  albedoMap?: string;
  normalMap?: string;
  roughnessMap?: string;
}

const MATERIAL_PRESETS: Record<string, MaterialProps> = {
  concrete: {
    color: "#8c8d8a",
    roughness: 0.85,
    metalness: 0.05,
    albedoMap: "/textures/concrete/albedo.jpg",
    normalMap: "/textures/concrete/normal.jpg",
    roughnessMap: "/textures/concrete/roughness.jpg",
  },
  brick: {
    color: "#b55a30",
    roughness: 0.95,
    metalness: 0.0,
    albedoMap: "/textures/brick/albedo.jpg",
    normalMap: "/textures/brick/normal.jpg",
    roughnessMap: "/textures/brick/roughness.jpg",
  },
  wood: {
    color: "#b48a53",
    roughness: 0.72,
    metalness: 0.0,
    albedoMap: "/textures/wood/albedo.jpg",
    normalMap: "/textures/wood/normal.jpg",
    roughnessMap: "/textures/wood/roughness.jpg",
  },
  glass: {
    color: "#c8e8f4",
    roughness: 0.04,
    metalness: 0.12,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  },
  steel: {
    color: "#9ca3af",
    roughness: 0.22,
    metalness: 0.9,
  },
  marble: {
    color: "#e8eae6",
    roughness: 0.12,
    metalness: 0.08,
    albedoMap: "/textures/marble/albedo.jpg",
    normalMap: "/textures/marble/normal.jpg",
  },
  plaster: {
    color: "#f5f5f0",
    roughness: 0.88,
    metalness: 0.0,
  },
  roof_tile: {
    color: "#994d3d",
    roughness: 0.82,
    metalness: 0.0,
    albedoMap: "/textures/roof_tile/albedo.jpg",
    normalMap: "/textures/roof_tile/normal.jpg",
  },
};

// Texture cache
const textureCache: Record<string, THREE.Texture> = {};

function loadTexture(path: string): THREE.Texture | null {
  if (textureCache[path]) return textureCache[path];

  // Prefer procedural canvas textures — zero network, zero 404s.
  const procedural = resolveProceduralTexture(path);
  if (procedural) {
    textureCache[path] = procedural;
    return procedural;
  }

  // Fallback: attempt file load (will 404 if file is missing, but safe).
  try {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(path);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    textureCache[path] = tex;
    return tex;
  } catch {
    return null;
  }
}

export class MaterialService {
  private static materials: Record<string, THREE.MeshStandardMaterial> = {};
  // When true, load PBR texture maps for materials (procedural canvas textures).
  static useTextures = true;

  static getMaterial(name: string): THREE.MeshStandardMaterial {
    const key = `${name.toLowerCase()}_${this.useTextures ? "tex" : "flat"}`;
    if (this.materials[key]) return this.materials[key];

    const props = MATERIAL_PRESETS[name.toLowerCase()] || MATERIAL_PRESETS.plaster;

    const matParams: THREE.MeshStandardMaterialParameters = {
      color: new THREE.Color(props.color),
      roughness: props.roughness,
      metalness: props.metalness,
      transparent: props.transparent ?? false,
      opacity: props.opacity ?? 1.0,
      side: props.side ?? THREE.DoubleSide,
    };

    if (props.emissive) {
      matParams.emissive = new THREE.Color(props.emissive);
      matParams.emissiveIntensity = props.emissiveIntensity ?? 0.1;
    }

    if (this.useTextures) {
      if (props.albedoMap) {
        const t = loadTexture(props.albedoMap);
        if (t) matParams.map = t;
      }
      if (props.normalMap) {
        const t = loadTexture(props.normalMap);
        if (t) matParams.normalMap = t;
      }
      if (props.roughnessMap) {
        const t = loadTexture(props.roughnessMap);
        if (t) matParams.roughnessMap = t;
      }
    }

    const mat = new THREE.MeshStandardMaterial(matParams);
    this.materials[key] = mat;
    return mat;
  }

  /** Toggle texture mode. Deliberately does NOT invalidate the cache: keys
      already encode the mode (`_tex`/`_flat`), so both generations coexist
      (bounded — one material per preset per mode). Bulk-disposing here made
      every consumer recreate its material in the same frame as the toggle,
      a visible stutter; now the first switch to a mode lazily creates at most
      one material per preset and every later toggle is a pure cache hit. */
  static setUseTextures(value: boolean) {
    this.useTextures = value;
  }

  static getPresetList(): { id: string; label: string; color: string }[] {
    return [
      { id: "plaster",   label: "Vôi trát",   color: "#f5f5f0" },
      { id: "concrete",  label: "Bê tông",     color: "#8c8d8a" },
      { id: "brick",     label: "Gạch đỏ",     color: "#b55a30" },
      { id: "wood",      label: "Gỗ",          color: "#b48a53" },
      { id: "steel",     label: "Thép",        color: "#9ca3af" },
      { id: "marble",    label: "Đá cẩm thạch",color: "#e8eae6" },
      { id: "glass",     label: "Kính",        color: "#c8e8f4" },
      { id: "roof_tile", label: "Ngói mái",    color: "#994d3d" },
    ];
  }
}
