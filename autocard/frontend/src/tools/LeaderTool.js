import { BaseTool } from "./BaseTool";

export class LeaderTool extends BaseTool {
  constructor(store) {
    super(store);
    this.points = [];
    this.text = "";
    this.showTextInput = false;
  }

  onMouseDown(pt) {
    this.points.push({ ...pt });
  }

  onMouseUp(pt) {
    // Double-click or right-click to finish
  }

  finish(text = "") {
    if (this.points.length < 2) return;
    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "leader",
      points: this.points.map(p => ({ ...p })),
      text: text || "",
      strokeColor: currentStyle.strokeColor,
      strokeWidth: currentStyle.lineWidth,
      lineType: currentStyle.lineType,
      layerId: activeLayerId,
    });
    this.points = [];
    this.text = "";
    this.store.setTool("select");
  }

  cancel() {
    this.points = [];
    this.text = "";
    this.store.setTool("select");
  }

  onKeyDown(e) {
    if (e.key === "Escape") {
      if (this.points.length > 0) {
        this.points = [];
        return true;
      }
      this.cancel();
      return true;
    }
    if (e.key === "Enter" && this.points.length >= 2) {
      this.finish("");
      return true;
    }
    return false;
  }

  drawPreview(ctx) {
    if (this.points.length === 0) return;
    const { strokeColor, lineWidth, lineType } = this.store.currentStyle;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineType === "dashed" ? [8, 4] : lineType === "dotted" ? [2, 3] : []);

    const allPoints = [...this.points];
    if (this.currentPoint && this.points.length > 0) {
      allPoints.push(this.currentPoint);
    }

    if (allPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(allPoints[0].x, allPoints[0].y);
      for (let i = 1; i < allPoints.length; i++) {
        ctx.lineTo(allPoints[i].x, allPoints[i].y);
      }
      ctx.stroke();

      // Arrow at first point
      const p0 = allPoints[0];
      const p1 = allPoints[1];
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + arrowSize * Math.cos(angle + Math.PI * 0.8), p0.y + arrowSize * Math.sin(angle + Math.PI * 0.8));
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + arrowSize * Math.cos(angle - Math.PI * 0.8), p0.y + arrowSize * Math.sin(angle - Math.PI * 0.8));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}