import { BaseTool } from "./BaseTool";
import type { Point, DrawingElement } from "../types";

export class MoveTool extends BaseTool {
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isDragging: boolean = false;
  private originalPositions: any[] = [];
  constructor(store: any) {
    super(store);
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.originalPositions = [];
  }

  activate(): void {
    super.activate();
    const selected = this.store.selectedElementIds;
    if (selected.length === 0) {
      this.store.setTool("select");
      return;
    }
    this.originalPositions = selected.map((id) => {
      const el = this.store.elements.find((e) => e.id === id);
      return el ? { ...el } : null;
    }).filter((e): e is DrawingElement => e !== null);
  }

  onMouseDown(pt: Point) {
    this.startPoint = { ...pt };
    this.isDragging = true;
  }

  onMouseMove(pt: Point, e: MouseEvent) {
    super.onMouseMove(pt, e);
    if (!this.isDragging || !this.startPoint) return;
    this.offsetX = pt.x - this.startPoint.x;
    this.offsetY = pt.y - this.startPoint.y;

    // Preview: update element positions
    this.originalPositions.forEach((orig: any) => {
      const el = this.store.elements.find((e) => e.id === orig.id);
      if (!el) return;
      const updates: Record<string, any> = {};
      if (el.x !== undefined) updates.x = orig.x + this.offsetX;
      if (el.y !== undefined) updates.y = orig.y + this.offsetY;
      if (el.x1 !== undefined) updates.x1 = orig.x1 + this.offsetX;
      if (el.y1 !== undefined) updates.y1 = orig.y1 + this.offsetY;
      if (el.x2 !== undefined) updates.x2 = orig.x2 + this.offsetX;
      if (el.y2 !== undefined) updates.y2 = orig.y2 + this.offsetY;
      if (el.cx !== undefined) updates.cx = orig.cx + this.offsetX;
      if (el.cy !== undefined) updates.cy = orig.cy + this.offsetY;
      if (el.points) {
        updates.points = orig.points.map((p) => ({
          x: p.x + this.offsetX,
          y: p.y + this.offsetY,
        }));
      }
      this.store.updateElement(el.id, updates);
    });
  }

  onMouseUp(pt: Point) {
    this.isDragging = false;
    this.startPoint = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.store.setTool("select");
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // Restore original positions
      this.originalPositions.forEach((orig: any) => {
        const el = this.store.elements.find((e) => e.id === orig.id);
        if (!el) return;
        const updates: Record<string, any> = {};
        if (orig.x !== undefined) updates.x = orig.x;
        if (orig.y !== undefined) updates.y = orig.y;
        if (orig.x1 !== undefined) updates.x1 = orig.x1;
        if (orig.y1 !== undefined) updates.y1 = orig.y1;
        if (orig.x2 !== undefined) updates.x2 = orig.x2;
        if (orig.y2 !== undefined) updates.y2 = orig.y2;
        if (orig.cx !== undefined) updates.cx = orig.cx;
        if (orig.cy !== undefined) updates.cy = orig.cy;
        if (orig.points) updates.points = orig.points.map((p) => ({ ...p }));
        this.store.updateElement(el.id, updates);
      });
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(ctx: CanvasRenderingContext2D) {
    // Preview is handled by live updates
  }
}