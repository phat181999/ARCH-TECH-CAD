import { BaseTool } from "./BaseTool";

export class LineTool extends BaseTool {
  constructor(store) {
    super(store);
    this.previewLine = null;
  }

  onMouseDown(pt) {
    if (!this.startPoint) {
      this.startPoint = { ...pt };
      this.points = [{ ...pt }];
    } else {
      this.points.push({ ...pt });
      this._commitLine(this.points[this.points.length - 2], pt);
      this.startPoint = { ...pt };
    }
  }

  onMouseUp(pt) {
    // Line is committed on mouse down for 2-point mode
  }

  onKeyDown(e) {
    if (e.key === "Escape") {
      this.deactivate();
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  _commitLine(p1, p2) {
    const { activeLayerId } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "line",
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      strokeColor: this.store.currentStyle.strokeColor,
      strokeWidth: this.store.currentStyle.lineWidth,
      lineType: this.store.currentStyle.lineType,
      layerId: activeLayerId,
    });
  }

  drawPreview(ctx) {
    if (!this.startPoint || !this.currentPoint) return;
    const { strokeColor, lineWidth, lineType } = this.store.currentStyle;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineType === "dashed" ? [8, 4] : lineType === "dotted" ? [2, 3] : []);
    ctx.beginPath();
    ctx.moveTo(this.startPoint.x, this.startPoint.y);
    ctx.lineTo(this.currentPoint.x, this.currentPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}