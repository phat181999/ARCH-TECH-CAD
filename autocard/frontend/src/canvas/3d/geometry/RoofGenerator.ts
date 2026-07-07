import * as THREE from "three";
import type { RidgeParams } from "./roofRidge";

export type RoofType = "flat" | "gable" | "hip" | "shed";

export class RoofGenerator {
  public static generate(
    type: RoofType,
    x: number,
    z: number,
    width: number,
    depth: number,
    wallHeight: number,
    pitchAngle: number = 30,
    ridge?: RidgeParams
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
        const isWide = ridge ? ridge.alongX : width >= depth;
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
        const isWide = ridge ? ridge.alongX : width >= depth;
        // Ridge segment length: user-drawn if provided (0 → pyramid), else the
        // legacy symmetric inset of span/2 per side.
        const extent = isWide ? width : depth;
        const ridgeLen = ridge
          ? Math.max(0, Math.min(ridge.ridgeLen, extent - 1))
          : Math.max(0, extent - span);
        const s = (extent - ridgeLen) / 2; // offset to start hip slopes

        if (isWide) {
          // Ridge points shifted in by s from left/right
          const E = [x + s,          wh + rh, z + depth / 2];
          const F = [x + extent - s, wh + rh, z + depth / 2];

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
          const F = [x + width / 2, wh + rh, z + extent - s];

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
        // Which corners are on the high edge: legacy rises toward +X; with a
        // ridge, the ridge's side of the footprint (highSide on the cross
        // axis) is the high edge.
        let highA = false, highB = true, highC = true, highD = false;
        if (ridge) {
          if (ridge.alongX) {           // slope runs across Z
            const plusZ = ridge.highSide >= 0;
            highA = !plusZ; highB = !plusZ; highC = plusZ; highD = plusZ;
          } else {                       // slope runs across X
            const plusX = ridge.highSide >= 0;
            highA = !plusX; highD = !plusX; highB = plusX; highC = plusX;
          }
        }
        const yFor = (high: boolean) => (high ? wh + rh : wh);
        const A_s = [x,         yFor(highA), z];
        const B_s = [x + width, yFor(highB), z];
        const C_s = [x + width, yFor(highC), z + depth];
        const D_s = [x,         yFor(highD), z + depth];

        verts = [
          // Top sloped face
          ...A_s, ...B_s, ...C_s,
          ...A_s, ...C_s, ...D_s,
          // Front side wall (A -> B edge)
          ...A, ...B_s, ...B,
          ...A, ...A_s, ...B_s,
          // Right side wall (B -> C edge)
          ...B, ...C_s, ...C,
          ...B, ...B_s, ...C_s,
          // Back side wall (C -> D edge)
          ...C, ...D_s, ...D,
          ...C, ...C_s, ...D_s,
          // Left side wall (D -> A edge)
          ...D, ...A_s, ...A,
          ...D, ...D_s, ...A_s,
        ];
        break;
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.computeVertexNormals();
    return geo;
  }
}
