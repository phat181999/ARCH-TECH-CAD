import * as THREE from "three";

export type RoofType = "flat" | "gable" | "hip" | "shed";

export class RoofGenerator {
  public static generate(
    type: RoofType,
    x: number,
    z: number,
    width: number,
    depth: number,
    wallHeight: number,
    pitchAngle: number = 30
  ): THREE.BufferGeometry {
    const wh = wallHeight;
    const rad = (pitchAngle * Math.PI) / 180;
    
    // Ridge/Peak height based on pitch angle and half span
    const span = Math.min(width, depth);
    const rh = Math.max(10, (span / 2) * Math.tan(rad));

    const geo = new THREE.BufferGeometry();
    let verts: number[] = [];

    // Corner vertices at wall height level
    const A = [x,         wh, z];
    const B = [x + width, wh, z];
    const C = [x + width, wh, z + depth];
    const D = [x,         wh, z + depth];

    switch (type) {
      case "flat": {
        // A simple flat slab of height 4 units
        const sh = 4; // slab height
        const A_t = [x,         wh + sh, z];
        const B_t = [x + width, wh + sh, z];
        const C_t = [x + width, wh + sh, z + depth];
        const D_t = [x,         wh + sh, z + depth];

        verts = [
          // Top Face
          ...A_t, ...C_t, ...B_t,
          ...A_t, ...D_t, ...C_t,
          // Bottom Face (inside/ceiling)
          ...A, ...B, ...C,
          ...A, ...C, ...D,
          // Front Side
          ...A, ...B_t, ...A_t,
          ...A, ...B, ...B_t,
          // Right Side
          ...B, ...C_t, ...B_t,
          ...B, ...C, ...C_t,
          // Back Side
          ...C, ...D_t, ...C_t,
          ...C, ...D, ...D_t,
          // Left Side
          ...D, ...A_t, ...D_t,
          ...D, ...A, ...A_t,
        ];
        break;
      }

      case "gable": {
        const isWide = width >= depth;
        if (isWide) {
          // Ridge runs along X
          const E = [x,         wh + rh, z + depth / 2];
          const F = [x + width, wh + rh, z + depth / 2];
          verts = [
            // front slope (A -> B -> F -> E)
            ...A, ...B, ...F,
            ...A, ...F, ...E,
            // back slope (C -> D -> E -> F)
            ...C, ...D, ...E,
            ...C, ...E, ...F,
            // left gable wall
            ...A, ...E, ...D,
            // right gable wall
            ...B, ...C, ...F,
          ];
        } else {
          // Ridge runs along Z
          const E = [x + width / 2, wh + rh, z];
          const F = [x + width / 2, wh + rh, z + depth];
          verts = [
            // left slope (A -> D -> F -> E)
            ...A, ...D, ...F,
            ...A, ...F, ...E,
            // right slope (B -> E -> F -> C)
            ...B, ...E, ...F,
            ...B, ...F, ...C,
            // front gable wall
            ...A, ...B, ...E,
            // back gable wall
            ...D, ...F, ...C,
          ];
        }
        break;
      }

      case "hip": {
        const isWide = width >= depth;
        const s = span / 2; // offset to start hip slopes

        if (isWide) {
          // Ridge points shifted in by s from left/right
          const E = [x + s,         wh + rh, z + depth / 2];
          const F = [x + width - s, wh + rh, z + depth / 2];

          verts = [
            // front slope (A -> B -> F -> E)
            ...A, ...B, ...F,
            ...A, ...F, ...E,
            // back slope (C -> D -> E -> F)
            ...C, ...D, ...E,
            ...C, ...E, ...F,
            // left hip slope (A -> E -> D)
            ...A, ...E, ...D,
            // right hip slope (B -> C -> F)
            ...B, ...C, ...F,
          ];
        } else {
          // Ridge points shifted in by s from top/bottom
          const E = [x + width / 2, wh + rh, z + s];
          const F = [x + width / 2, wh + rh, z + depth - s];

          verts = [
            // left slope (A -> D -> F -> E)
            ...A, ...D, ...F,
            ...A, ...F, ...E,
            // right slope (B -> E -> F -> C)
            ...B, ...E, ...F,
            ...B, ...F, ...C,
            // front hip slope (A -> B -> E)
            ...A, ...B, ...E,
            // back hip slope (D -> F -> C)
            ...D, ...F, ...C,
          ];
        }
        break;
      }

      case "shed": {
        // A single slope: rising from A/D side (wallHeight) to B/C side (wallHeight + rh)
        const A_h = A;
        const D_h = D;
        const B_h = [x + width, wh + rh, z];
        const C_h = [x + width, wh + rh, z + depth];

        verts = [
          // Top Sloped Face
          ...A_h, ...B_h, ...C_h,
          ...A_h, ...C_h, ...D_h,
          // Front side wall (A -> B_h -> B)
          ...A, ...B_h, ...B,
          ...A, ...A_h, ...B_h,
          // Right side wall (B -> C_h -> C)
          ...B, ...C_h, ...C,
          ...B, ...B_h, ...C_h,
          // Back side wall (C -> D_h -> D)
          ...C, ...D_h, ...D,
          ...C, ...C_h, ...D_h,
          // Left side wall (D -> A_h -> A)
          ...D, ...A_h, ...A,
          ...D, ...D_h, ...A_h,
        ];
        break;
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.computeVertexNormals();
    return geo;
  }
}
