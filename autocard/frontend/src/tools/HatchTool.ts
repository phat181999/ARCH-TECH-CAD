import { BaseTool } from "./BaseTool";
import type { Point } from "../types";

export class HatchTool extends BaseTool {
  constructor(store: any) {
    super(store);
    this.points = [];
  }

  onMouseDown(pt: Point) {
    this.points.push({ ...pt });
  }

  onMouseUp(pt: Point) {
    // Point added on mouse down
  }

  closePolygon(): void {
    if (this.points.length < 3) return;
    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "hatch",
      points: this.points.map(p => ({ ...p })),
      pattern: currentStyle.pattern || "diagonal45",
      strokeColor: currentStyle.strokeColor,
      strokeWidth: currentStyle.lineWidth,
      fillColor: currentStyle.fillColor !== "transparent" ? currentStyle.fillColor : "#e5e7eb",
      lineType: currentStyle.lineType,
      layerId: activeLayerId,
    });
    this.points = [];
    this.store.setTool("select");
  }

  cancel(): void {
    this.points = [];
    this.store.setTool("select");
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (this.points.length > 0) {
        this.points = [];
        return true;
      }
      this.cancel();
      return true;
    }
    if (e.key === "Enter" && this.points.length >= 3) {
      this.closePolygon();
      return true;
    }
    return false;
  }

  drawPreview(ctx: CanvasRenderingContext2D) {
    if (this.points.length === 0) return;
    const { strokeColor, fillColor, lineWidth, lineType } = this.store.currentStyle;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineType === "dashed" ? [8, 4] : lineType === "dotted" ? [2, 3] : []);

    const allPoints = [...this.points];
    if (this.currentPoint) {
      allPoints.push(this.currentPoint);
    }

    if (allPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(allPoints[0].x, allPoints[0].y);
      for (let i = 1; i < allPoints.length; i++) {
        ctx.lineTo(allPoints[i].x, allPoints[i].y);
      }
      if (allPoints.length >= 3) {
        ctx.closePath();
        if (fillColor && fillColor !== "transparent") {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}