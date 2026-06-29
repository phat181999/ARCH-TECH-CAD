import { create } from "zustand";
import { createCanvasSlice, type CanvasSlice } from "./slices/canvasSlice";
import { createElementSlice, type ElementSlice } from "./slices/elementSlice";
import { createLayerSlice, type LayerSlice } from "./slices/layerSlice";
import { createBlockSlice, type BlockSlice } from "./slices/blockSlice";
import { createDrawingSlice, type DrawingSlice } from "./slices/drawingSlice";
import { createArchitectureSlice, type ArchitectureSlice } from "./slices/architectureSlice";
import { createCollaborationSlice, type CollaborationSlice } from "./slices/collaborationSlice";
import { createMeasurementSlice, type MeasurementSlice } from "./slices/measurementSlice";
import { createSceneSlice, type SceneSlice } from "./slices/sceneSlice";
import { createBimSlice, type BimSlice } from "./slices/bimSlice";

export type DrawingStore = CanvasSlice &
  ElementSlice &
  LayerSlice &
  BlockSlice &
  DrawingSlice &
  ArchitectureSlice &
  CollaborationSlice &
  MeasurementSlice &
  SceneSlice &
  BimSlice;

export const useDrawingStore = create<DrawingStore>()((...a) => ({
  ...createCanvasSlice(...a),
  ...createElementSlice(...a),
  ...createLayerSlice(...a),
  ...createBlockSlice(...a),
  ...createDrawingSlice(...a),
  ...createArchitectureSlice(...a),
  ...createCollaborationSlice(...a),
  ...createMeasurementSlice(...a),
  ...createSceneSlice(...a),
  ...createBimSlice(...a),
}));
