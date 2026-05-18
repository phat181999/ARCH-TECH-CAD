import { BaseTool } from "./BaseTool";

export class CircleTool extends BaseTool {
  onMouseDown(pt) {
    this.startPoint = { ...pt };
  }

  onMouseUp(pt) {
    if (!this.startPoint) return;
    const dx = pt.x - this.startPoint.x;
    const dy = pt.y - this.startPoint.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1) return;

    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "circle",
      cx: this.startPoint.x, cy: this.startPoint.y, radius: r,
      strokeColor: currentStyle.strokeColor,
      strokeWidth: currentStyle.lineWidth,
      fillColor: currentStyle.fillColor,
      lineType: currentStyle.lineType,
      layerId: activeLayerId,
    });
    this.startPoint = null;
  }

  drawPreview(ctx) {
    if (!this.startPoint || !this.currentPoint) return;
    const { strokeColor, fillColor, lineWidth, lineType } = this.store.currentStyle;
    const dx = this.currentPoint.x - this.startPoint.x;
    const dy = this.currentPoint.y - this.startPoint.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineType === "dashed" ? [8, 4] : lineType === "dotted" ? [2, 3] : []);
    ctx.beginPath();
    ctx.arc(this.startPoint.x, this.startPoint.y, r, 0, Math.PI * 2);
    if (fillColor && fillColor !== "transparent") {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}