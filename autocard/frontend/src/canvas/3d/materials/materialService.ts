import * as THREE from "three";

export interface MaterialProps {
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  roughnessMap?: THREE.Texture;
}

const MATERIAL_PRESETS: Record<string, MaterialProps> = {
  concrete: {
    color: "#8c8d8a",
    roughness: 0.8,
    metalness: 0.1,
  },
  brick: {
    color: "#b55a30",
    roughness: 0.95,
    metalness: 0.0,
  },
  wood: {
    color: "#b48a53",
    roughness: 0.7,
    metalness: 0.0,
  },
  glass: {
    color: "#a9d3e8",
    roughness: 0.1,
    metalness: 0.95,
    transparent: true,
    opacity: 0.35,
  },
  steel: {
    color: "#9ca3af",
    roughness: 0.25,
    metalness: 0.85,
  },
  marble: {
    color: "#e5e7eb",
    roughness: 0.15,
    metalness: 0.1,
  },
  plaster: {
    color: "#fafafa",
    roughness: 0.9,
    metalness: 0.0,
  },
  roof_tile: {
    color: "#994d3d",
    roughness: 0.85,
    metalness: 0.0,
  }
};

export class MaterialService {
  private static materials: Record<string, THREE.MeshStandardMaterial> = {};

  public static getMaterial(name: string): THREE.MeshStandardMaterial {
    const key = name.toLowerCase();
    if (this.materials[key]) {
      return this.materials[key];
    }

    const props = MATERIAL_PRESETS[key] || MATERIAL_PRESETS.plaster;
    
    // Create material with standard parameters
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(props.color),
      roughness: props.roughness,
      metalness: props.metalness,
      transparent: props.transparent || false,
      opacity: props.opacity !== undefined ? props.opacity : 1.0,
      side: THREE.DoubleSide,
    });

    // Procedural noise or simple patterns can be added here if needed in the future
    this.materials[key] = mat;
    return mat;
  }

  public static getPresetList(): { id: string; label: string; color: string }[] {
    return [
      { id: "plaster", label: "Plaster", color: "#fafafa" },
      { id: "concrete", label: "Concrete", color: "#8c8d8a" },
      { id: "brick", label: "Brick", color: "#b55a30" },
      { id: "wood", label: "Wood", color: "#b48a53" },
      { id: "steel", label: "Steel", color: "#9ca3af" },
      { id: "marble", label: "Marble", color: "#e5e7eb" },
      { id: "glass", label: "Glass", color: "#a9d3e8" },
      { id: "roof_tile", label: "Roof Tile", color: "#994d3d" },
    ];
  }
}
