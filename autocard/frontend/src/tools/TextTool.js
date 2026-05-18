import { BaseTool } from "./BaseTool";

export class TextTool extends BaseTool {
  constructor(store) {
    super(store);
    this.pendingText = null;
    this.onTextSubmit = null;
  }

  onMouseDown(pt) {
    if (this.pendingText !== null) return;
    this.startPoint = { ...pt };
    // Show text input prompt
    this.pendingText = "";
    this.store.setTool("text-input");
  }

  submitText(text) {
    if (!this.startPoint || !text.trim()) {
      this.pendingText = null;
      this.startPoint = null;
      this.store.setTool("select");
      return;
    }
    const { activeLayerId, currentStyle } = this.store;
    this.store.addElement({
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "text",
      text: text.trim(),
      x: this.startPoint.x, y: this.startPoint.y,
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "left",
      strokeColor: currentStyle.strokeColor,
      layerId: activeLayerId,
    });
    this.pendingText = null;
    this.startPoint = null;
    this.store.setTool("select");
  }

  cancelText() {
    this.pendingText = null;
    this.startPoint = null;
    this.store.setTool("select");
  }

  drawPreview(ctx) {
    if (!this.startPoint || this.pendingText === null) return;
    ctx.strokeStyle = this.store.currentStyle.strokeColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(this.startPoint.x - 2, this.startPoint.y - 16, 100, 20);
    ctx.setLineDash([]);
    ctx.fillStyle = this.store.currentStyle.strokeColor;
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(this.pendingText || "|", this.startPoint.x, this.startPoint.y);
  }
}