import * as THREE from "three";

// Import shaders as strings using Vite's ?raw query
import vertexShader   from "../shaders/triplanarWall.vert.glsl?raw";
import fragmentShader from "../shaders/triplanarWall.frag.glsl?raw";

export interface TriplanarWallOptions {
  color?:      string | number;
  roughness?:  number;
  metalness?:  number;
  tileScale?:  number;
}

export function createTriplanarWallMaterial(options: TriplanarWallOptions = {}): THREE.ShaderMaterial {
  const color = new THREE.Color(options.color ?? "#c8bfb0");

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor:      { value: color },
      uRoughness:  { value: options.roughness  ?? 0.85 },
      uMetalness:  { value: options.metalness  ?? 0.0 },
      uTileScale:  { value: options.tileScale  ?? 8.0 },
      uLightDir:   { value: new THREE.Vector3(1, 2, 1).normalize() },
      uLightColor: { value: new THREE.Color(1, 0.97, 0.9) },
      uAmbient:    { value: 0.35 },
    },
    side: THREE.FrontSide,
  });
}
