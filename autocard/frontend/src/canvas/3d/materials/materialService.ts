import * as THREE from "three";
import { resolveProceduralTexture } from "./proceduralTextures";
import { MaterialRegistry, type CatalogMaterial } from "./materialRegistry";

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

const PATTERN_TEXTURES: Record<string, string> = {
  brick: "brick", wood: "wood", stone: "marble", shingle: "roof_tile",
};

const SIDE_MAP: Record<string, THREE.Side> = {
  double: THREE.DoubleSide, front: THREE.FrontSide, back: THREE.BackSide,
};

export function catalogToMaterialProps(m: CatalogMaterial): MaterialProps {
  const texDir = m.pattern ? PATTERN_TEXTURES[m.pattern] : undefined;
  return {
    color: m.color,
    roughness: m.roughness ?? 0.85,
    metalness: m.metalness ?? 0.0,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side ? SIDE_MAP[m.side] : undefined,
    albedoMap: m.albedoMap ?? (texDir ? `/textures/${texDir}/albedo.jpg` : undefined),
    normalMap: m.normalMap ?? (texDir ? `/textures/${texDir}/normal.jpg` : undefined),
    roughnessMap: m.roughnessMap,
  };
}

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

    const entry = MaterialRegistry.get(name.toLowerCase()) ?? MaterialRegistry.get("plaster")!;
    const props = catalogToMaterialProps(entry);

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
    return MaterialRegistry.getByObjectType("wall").concat(MaterialRegistry.getByObjectType("roof"))
      .filter((m) => m.quickAccess)
      .map((m) => ({ id: m.id, label: m.name, color: m.color }));
  }
}
