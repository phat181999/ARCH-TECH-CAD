import { BaseTool } from "./BaseTool";
import type { Point } from "../types";

export class RectangleTool extends BaseTool {
  onMouseDown(pt: Point) {
    this.startPoint = { ...pt };
  }

  onMouseUp(pt: Point) {
    if (!this.startPoint) return;
    const x = Math.min(this.startPoint.x, pt.x);
    const y = Math.min(this.startPoint.y, pt.y);
    const w = Math.abs(pt.x - this.startPoint.x);
    const h = Math.abs(pt.y - this.startPoint.y);
    if (w < 1 && h < 1) return;

    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "rectangle",
      x, y, width: w, height: h,
      strokeColor: currentStyle.strokeColor,
      strokeWidth: currentStyle.lineWidth,
      fillColor: currentStyle.fillColor,
      lineType: currentStyle.lineType,
      layerId: activeLayerId,
    });
    this.startPoint = null;
  }

  drawPreview(ctx: CanvasRenderingContext2D) {
    if (!this.startPoint || !this.currentPoint) return;
    const { strokeColor, fillColor, lineWidth, lineType } = this.store.currentStyle;
    const x = Math.min(this.startPoint.x, this.currentPoint.x);
    const y = Math.min(this.startPoint.y, this.currentPoint.y);
    const w = Math.abs(this.currentPoint.x - this.startPoint.x);
    const h = Math.abs(this.currentPoint.y - this.startPoint.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineType === "dashed" ? [8, 4] : lineType === "dotted" ? [2, 3] : []);
    if (fillColor && fillColor !== "transparent") {
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}