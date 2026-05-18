// Base tool class for all drawing tools
export class BaseTool {
  constructor(store) {
    this.store = store;
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  activate() {
    this.isActive = true;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  deactivate() {
    this.isActive = false;
    this.startPoint = null;
    this.currentPoint = null;
    this.points = [];
  }

  onMouseDown(pt, e) {
    // Override in subclass
  }

  onMouseMove(pt, e) {
    this.currentPoint = pt;
  }

  onMouseUp(pt, e) {
    // Override in subclass
  }

  onKeyDown(e) {
    if (e.key === "Escape") {
      this.deactivate();
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(ctx) {
    // Override in subclass
  }

  getSnapPoints() {
    return [];
  }
}