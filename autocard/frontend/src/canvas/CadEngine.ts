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

/** Returns a loose AABB for any element type in world-space coordinates. */
function getElementBounds(el: DrawingElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if (el.type === "line") {
    return { minX: Math.min(el.x1!, el.x2!), minY: Math.min(el.y1!, el.y2!), maxX: Math.max(el.x1!, el.x2!), maxY: Math.max(el.y1!, el.y2!) };
  }
  if (el.type === "circle" || el.type === "arc") {
    const r = (el.radius as number) || 0;
    return { minX: el.cx! - r, minY: el.cy! - r, maxX: el.cx! + r, maxY: el.cy! + r };
  }
  if (el.type === "ellipse") {
    const rx = (el as any).rx || 50, ry = (el as any).ry || 30;
    return { minX: el.cx! - rx, minY: el.cy! - ry, maxX: el.cx! + rx, maxY: el.cy! + ry };
  }
  if (el.type === "rectangle") {
    return { minX: el.x!, minY: el.y!, maxX: el.x! + (el.width || 0), maxY: el.y! + (el.height || 0) };
  }
  if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    if (!s || !e2) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX: Math.min(s.x, e2.x), minY: Math.min(s.y, e2.y), maxX: Math.max(s.x, e2.x), maxY: Math.max(s.y, e2.y) };
  }
  if (el.type === "dimension" || el.type === "dim-linear") {
    const pad = 50;
    return { minX: Math.min(el.x1!, el.x2!) - pad, minY: Math.min(el.y1!, el.y2!) - pad, maxX: Math.max(el.x1!, el.x2!) + pad, maxY: Math.max(el.y1!, el.y2!) + pad };
  }
  if (el.type === "text" || el.type === "mtext") {
    const w = (el.text?.length || 1) * (el.fontSize || 16) * 0.6;
    const h = (el.fontSize || 16) * 1.4;
    return { minX: el.x!, minY: el.y! - h, maxX: el.x! + w, maxY: el.y! + 4 };
  }
  if (el.points && (el as any).points.length > 0) {
    const pts: Point[] = (el as any).points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { minX, minY, maxX, maxY };
  }
  // Fallback: use x/y with a small pad
  const x = (el as any).x ?? (el as any).cx ?? 0;
  const y = (el as any).y ?? (el as any).cy ?? 0;
  return { minX: x - 50, minY: y - 50, maxX: x + 50, maxY: y + 50 };
}

/**
 * Returns true if the element's bounding box overlaps the visible viewport.
 * vMinX/vMinY/vMaxX/vMaxY are in world-space coordinates.
 * A generous 20% margin is added so elements on the edge are never clipped.
 */
function isElementInViewport(el: DrawingElement, vMinX: number, vMinY: number, vMaxX: number, vMaxY: number): boolean {
  const b = getElementBounds(el);
  return b.maxX >= vMinX && b.minX <= vMaxX && b.maxY >= vMinY && b.minY <= vMaxY;
}

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

    // Build layer map — use Sets for O(1) per-element lookups in the render loop
    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const visibleLayerSet = new Set(visibleLayerIds);
    const layerMap: Record<string, Layer> = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    // Viewport bounds in world coordinates with 10% padding to prevent edge clipping
    const vMinX = -panOffset.x / zoom;
    const vMinY = -panOffset.y / zoom;
    const vMaxX = (width - panOffset.x) / zoom;
    const vMaxY = (height - panOffset.y) / zoom;
    const padX = (vMaxX - vMinX) * 0.1;
    const padY = (vMaxY - vMinY) * 0.1;

    const culledElements = elements.filter((el) =>
      isElementInViewport(el, vMinX - padX, vMinY - padY, vMaxX + padX, vMaxY + padY)
    );

    const visibleElements = architecturalPlan ? culledElements.filter((el) => !el.archType) : culledElements;
    const manualWalls = visibleElements.filter(
      (el) => el.type === "wall" && visibleLayerSet.has(el.layerId) && el.start && el.end
    ) as any as WallEntity[];

    if (architecturalPlan) {
      this.arch.drawPlan(ctx, architecturalPlan, layerMap, !!isDarkMode, manualWalls, zoom);
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
      this.style.applyLayerStyle(ctx, "A-WALL", layerMap, !!isDarkMode, zoom);
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
      (el) => el.type === "opening" && visibleLayerSet.has(el.layerId)
    ) as any[];
    if (openings.length > 0) {
      this.arch.drawOpenings(ctx, openings, allWalls, !!isDarkMode, zoom);
    }

    const selectedSet = new Set(selectedElementIds);
    visibleElements.forEach((el) => {
      if (!visibleLayerSet.has(el.layerId)) return;
      if (el.type === "wall" || el.type === "opening") return;
      this.elements.drawElement(ctx, el, selectedSet.has(el.id), layerMap, blockDefs, !!isDarkMode, el.id === hoveredElementId, zoom);
    });


    // Draw grip handles on top of all elements
    selectedElementIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (el) this.elements.drawGrips(ctx, el, zoom, !!isDarkMode);
    });

    this.preview.drawPreview(
      ctx, tool, isDrawing, startPoint, dragPoint, currentPolylineId, elements, layerMap, !!isDarkMode,
      selectedElementIds, blockDefs, operationPivot, typedValue, zoom
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
