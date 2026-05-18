import { BaseTool } from "./BaseTool";

export class NumberingTool extends BaseTool {
  constructor(store) {
    super(store);
    this.counter = 1;
    this.previewText = null;
  }

  onMouseDown(pt) {
    const { activeLayerId, currentStyle } = this.store;
    const num = this.counter++;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "text",
      text: String(num),
      x: pt.x, y: pt.y,
      fontSize: 14,
      fontFamily: "Arial",
      fontWeight: "bold",
      fontStyle: "normal",
      textAlign: "center",
      strokeColor: currentStyle.strokeColor,
      layerId: activeLayerId,
    });

    // Add a circle around the number
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "circle",
      cx: pt.x, cy: pt.y - 5,
      radius: 12,
      strokeColor: currentStyle.strokeColor,
      strokeWidth: 1.5,
      fillColor: "transparent",
      lineType: "solid",
      layerId: activeLayerId,
    });
  }

  onMouseUp(pt) {}

  drawPreview(ctx) {
    if (!this.currentPoint) return;
    const { strokeColor } = this.store.currentStyle;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.currentPoint.x, this.currentPoint.y - 5, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = strokeColor;
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(this.counter), this.currentPoint.x, this.currentPoint.y - 5);
  }

  reset() {
    this.counter = 1;
  }
}