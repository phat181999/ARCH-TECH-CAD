import { BaseTool } from "./BaseTool";

export class DimensionTool extends BaseTool {
  onMouseDown(pt) {
    if (!this.startPoint) {
      this.startPoint = { ...pt };
    }
  }

  onMouseUp(pt) {
    if (!this.startPoint) return;
    const dx = pt.x - this.startPoint.x;
    const dy = pt.y - this.startPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "dimension",
      x1: this.startPoint.x, y1: this.startPoint.y,
      x2: pt.x, y2: pt.y,
      offset: 30,
      strokeColor: currentStyle.strokeColor,
      strokeWidth: currentStyle.lineWidth,
      lineType: currentStyle.lineType,
      layerId: activeLayerId,
    });
    this.startPoint = null;
  }

  drawPreview(ctx) {
    if (!this.startPoint || !this.currentPoint) return;
    const { strokeColor, lineWidth } = this.store.currentStyle;
    const p1 = this.startPoint;
    const p2 = this.currentPoint;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]);

    // Dimension line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Extension lines
    const nx = -dy / len * 10;
    const ny = dx / len * 10;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + nx, p1.y + ny);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x + nx, p2.y + ny);
    ctx.stroke();

    // Arrows
    const angle = Math.atan2(dy, dx);
    const arrowSize = 6;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + arrowSize * Math.cos(angle + Math.PI * 0.85), p1.y + arrowSize * Math.sin(angle + Math.PI * 0.85));
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + arrowSize * Math.cos(angle - Math.PI * 0.85), p1.y + arrowSize * Math.sin(angle - Math.PI * 0.85));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x + arrowSize * Math.cos(angle + Math.PI + Math.PI * 0.85), p2.y + arrowSize * Math.sin(angle + Math.PI + Math.PI * 0.85));
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x + arrowSize * Math.cos(angle + Math.PI - Math.PI * 0.85), p2.y + arrowSize * Math.sin(angle + Math.PI - Math.PI * 0.85));
    ctx.stroke();

    // Distance text
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.fillStyle = strokeColor;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${len.toFixed(2)}`, midX, midY - 4);
  }
}