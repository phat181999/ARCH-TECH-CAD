import { ArchitecturalPlan, DrawingElement, Point, Layer, ToolType } from "../types";
import { drawSnapIndicator, SnapResult } from "./snap";
import { WallEngine } from "../core/wallEngine";
import { WallEntity } from "../core/entities";
import { GridRenderer } from "./renderers/GridRenderer";
import { StyleManager } from "./renderers/StyleManager";
import { ElementRenderer } from "./renderers/ElementRenderer";
import { ArchitecturalRenderer } from "./renderers/ArchitecturalRenderer";
import { PreviewRenderer } from "./renderers/PreviewRenderer";
import { CollabRenderer } from "./renderers/CollabRenderer";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  panOffset: Point;
  zoom: number;
  gridVisible: boolean;
  elements: DrawingElement[];
  selectedElementIds: string[];
  layers: Layer[];
  tool: ToolType;
  isDrawing: boolean;
  startPoint: Point | null;
  dragPoint: Point | null;
  currentPolylineId: string | null;
  snapPoint: SnapResult | null;
  hoveredElementId?: string | null;
  collabCursors: Record<string, {x?: number, y?: number}>;
  collabUsers: any[];
  blockDefs: Record<string, any>;
  architecturalPlan: ArchitecturalPlan | null;
  isDarkMode?: boolean;
  operationPivot?: Point | null;
  typedValue?: string;
}

export class CadEngine {
  private grid = new GridRenderer();
  private style = new StyleManager();
  private elements: ElementRenderer;
  private arch: ArchitecturalRenderer;
  private preview: PreviewRenderer;
  private collab = new CollabRenderer();

  constructor() {
    this.elements = new ElementRenderer(this.style);
    this.arch = new ArchitecturalRenderer(this.style);
    this.preview = new PreviewRenderer(this.style);
  }

  public render(params: RenderContext): void {
    const {
      ctx, width, height, panOffset, zoom, gridVisible, elements,
      selectedElementIds, layers, tool, isDrawing, startPoint, dragPoint,
      currentPolylineId, snapPoint, hoveredElementId, collabCursors, collabUsers, blockDefs, architecturalPlan, isDarkMode,
      operationPivot, typedValue
    } = params;

    const devicePixelRatio = window.devicePixelRatio || 1;
    ctx.canvas.width = width * devicePixelRatio;
    ctx.canvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    this.grid.draw(ctx, width, height, panOffset, zoom, gridVisible);

    // Build layer map
    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const layerMap: Record<string, Layer> = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    const visibleElements = architecturalPlan ? elements.filter((el) => !el.archType) : elements;
    const manualWalls = visibleElements.filter(
      (el) => el.type === "wall" && visibleLayerIds.includes(el.layerId) && el.start && el.end
    ) as any as WallEntity[];

    if (architecturalPlan) {
      this.arch.drawPlan(ctx, architecturalPlan, layerMap, !!isDarkMode, manualWalls);
    }

    const allWalls = [
      ...manualWalls,
      ...(architecturalPlan?.walls || []).map((w) => ({
        id: w.id,
        type: "wall",
        start: { x: w.x1, y: w.y1 },
        end: { x: w.x2, y: w.y2 },
        thickness: w.thickness || 20,
      })),
    ];

    if (manualWalls.length > 0) {
      const computedPolygons = WallEngine.computePolygons(manualWalls);
      this.style.applyLayerStyle(ctx, "A-WALL", layerMap, !!isDarkMode);
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#1e293b";
      computedPolygons.forEach((poly) => {
        ctx.beginPath();
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        for (let i = 1; i < poly.points.length; i++) {
          ctx.lineTo(poly.points[i].x, poly.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    const openings = visibleElements.filter(
      (el) => el.type === "opening" && visibleLayerIds.includes(el.layerId)
    ) as any[];
    if (openings.length > 0) {
      this.arch.drawOpenings(ctx, openings, allWalls, !!isDarkMode);
    }

    visibleElements.forEach((el) => {
      if (!visibleLayerIds.includes(el.layerId)) return;
      if (el.type === "wall" || el.type === "opening") return;
      this.elements.drawElement(ctx, el, selectedElementIds.includes(el.id), layerMap, blockDefs, !!isDarkMode, el.id === hoveredElementId);
    });

    // Draw grip handles on top of all elements
    selectedElementIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el) this.elements.drawGrips(ctx, el, zoom, !!isDarkMode);
    });

    this.preview.drawPreview(
      ctx, tool, isDrawing, startPoint, dragPoint, currentPolylineId, elements, layerMap, !!isDarkMode,
      selectedElementIds, blockDefs, operationPivot, typedValue
    );

    this.collab.drawCursors(ctx, collabCursors, collabUsers, zoom, panOffset);

    ctx.restore();

    // Draw snap indicator AFTER restore() — in screen space so size is always consistent
    if (snapPoint) {
      const sx = snapPoint.point.x * zoom + panOffset.x;
      const sy = snapPoint.point.y * zoom + panOffset.y;
      drawSnapIndicator(ctx, { x: sx, y: sy }, snapPoint.type);
    }
  }
}
