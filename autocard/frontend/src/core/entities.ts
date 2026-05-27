import { Point } from "../types";

export interface BaseEntity {
  id: string;
  type: string;
  layerId: string;
  visible: boolean;
  metadata?: Record<string, unknown>;
}

export interface WallEntity extends BaseEntity {
  type: "wall";
  start: Point;
  end: Point;
  thickness: number;
}

export interface RoomEntity extends BaseEntity {
  type: "room";
  boundary: Point[];
  area: number;
  label: string;
  labelX: number;
  labelY: number;
  wallIds: string[];
}

export interface OpeningEntity extends BaseEntity {
  type: "opening";
  openingType: "door" | "window";
  hostWallId: string;
  position: Point;
  width: number;
  swingDirection?: "left-in" | "right-in" | "left-out" | "right-out";
}

export type CADEntity = WallEntity | RoomEntity | OpeningEntity;
