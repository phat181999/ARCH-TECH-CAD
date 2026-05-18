import type { Point } from "../types";
import type { DrawingStore } from "../stores/drawingStore";

// Base tool class for all drawing tools
export class BaseTool {
  store: DrawingStore;
  isActive: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  points: Point[];

  constructor(store: DrawingStore) {
    this.store = store;
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  activate(): void {
    this.isActive = true;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  deactivate(): void {
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  onMouseDown(pt: Point, _e: MouseEvent): void {
    // Override in subclass
  }

  onMouseMove(pt: Point, _e: MouseEvent): void {
    this.currentPoint = pt;
  }

  onMouseUp(pt: Point, _e: MouseEvent): void {
    // Override in subclass
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === "Escape") {
      this.deactivate();
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(_ctx: CanvasRenderingContext2D): void {
    // Override in subclass
  }

  getSnapPoints(): Point[] {
    return [];
  }
}