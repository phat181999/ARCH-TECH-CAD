import { BaseTool } from "./BaseTool";
import type { Point, DrawingElement } from "../types";

export class CopyTool extends BaseTool {
  offsetX: number = 0;
  offsetY: number = 0;
  isDragging: boolean = false;
  copiedElements: DrawingElement[] = [];

  activate(): void {
    super.activate();
    const selected = this.store.selectedElementIds;
    if (selected.length === 0) {
      this.store.setTool("select");
      return;
    }
  }

  onMouseDown(pt: Point) {
    this.startPoint = { ...pt };
    this.isDragging = true;
    this.copiedElements = [];
  }

  onMouseMove(pt: Point, e: MouseEvent) {
    super.onMouseMove(pt, e);
    if (!this.isDragging || !this.startPoint) return;
    this.offsetX = pt.x - this.startPoint.x;
    this.offsetY = pt.y - this.startPoint.y;
  }

  onMouseUp(pt: Point) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const dx = pt.x - this.startPoint!.x;
    const dy = pt.y - this.startPoint!.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      this.store.setTool("select");
      return;
    }

    // Copy selected elements with offset
    const selected = this.store.selectedElementIds;
    selected.forEach((id: string) => {
      const el = this.store.elements.find((e: DrawingElement) => e.id === id);
      if (!el) return;
      const newEl = JSON.parse(JSON.stringify(el));
      newEl.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (newEl.x !== undefined) newEl.x += dx;
      if (newEl.y !== undefined) newEl.y += dy;
      if (newEl.x1 !== undefined) newEl.x1 += dx;
      if (newEl.y1 !== undefined) newEl.y1 += dy;
      if (newEl.x2 !== undefined) newEl.x2 += dx;
      if (newEl.y2 !== undefined) newEl.y2 += dy;
      if (newEl.cx !== undefined) newEl.cx += dx;
      if (newEl.cy !== undefined) newEl.cy += dy;
      if (newEl.points) {
        newEl.points = newEl.points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy }));
      }
      this.store.addElement(newEl);
    });

    this.startPoint = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.store.setTool("select");
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(ctx: CanvasRenderingContext2D) {
    if (!this.isDragging || !this.startPoint || !this.currentPoint) return;
    const dx = this.currentPoint.x - this.startPoint.x;
    const dy = this.currentPoint.y - this.startPoint.y;

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    this.store.selectedElementIds.forEach((id: string) => {
      const el = this.store.elements.find((e: DrawingElement) => e.id === id);
      if (!el) return;
      // Draw ghost copy
      if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo((el.x1 || 0) + dx, (el.y1 || 0) + dy);
        ctx.lineTo((el.x2 || 0) + dx, (el.y2 || 0) + dy);
        ctx.stroke();
      } else if (el.type === "rectangle") {
        ctx.strokeRect((el.x || 0) + dx, (el.y || 0) + dy, el.width || 0, el.height || 0);
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc((el.cx || 0) + dx, (el.cy || 0) + dy, el.radius || 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
  }
}
