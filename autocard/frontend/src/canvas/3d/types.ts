import type * as THREE from "three";
import type { DrawingElement } from "../../types";

export type ViewAngle = "perspective" | "top" | "front" | "back" | "left" | "right" | null;

export interface WallSegment {
  id?: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
}

export interface Bounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface DrawingState {
  plane: THREE.Plane;
  basisMatrix: THREE.Matrix4;
  normal: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  origin: THREE.Vector3;
  points2D: THREE.Vector2[];
  points3D: THREE.Vector3[];
}

export interface ClosedShapeState {
  points2D: THREE.Vector2[];
  basisMatrix: THREE.Matrix4;
  normal: THREE.Vector3;
  origin: THREE.Vector3;
}

export type ShapeWithDepth = ClosedShapeState & { depth: number; id: string };

export interface HousePlan {
  shell: DrawingElement | null;
  rooms: DrawingElement[];
  doors: DrawingElement[];
  windows: DrawingElement[];
  walls: DrawingElement[];
  loose: DrawingElement[];
}
