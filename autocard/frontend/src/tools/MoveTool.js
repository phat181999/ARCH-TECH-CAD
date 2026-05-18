import { BaseTool } from "./BaseTool";

export class MoveTool extends BaseTool {
  constructor(store) {
    super(store);
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.originalPositions = [];
  }

  activate() {
    super.activate();
    const selected = this.store.selectedElementIds;
    if (selected.length === 0) {
      this.store.setTool("select");
      return;
    }
    this.originalPositions = selected.map((id) => {
      const el = this.store.elements.find((e) => e.id === id);
      return el ? { id, ...el } : null;
    }).filter(Boolean);
  }

  onMouseDown(pt) {
    this.startPoint = { ...pt };
    this.isDragging = true;
  }

  onMouseMove(pt, e) {
    super.onMouseMove(pt, e);
    if (!this.isDragging || !this.startPoint) return;
    this.offsetX = pt.x - this.startPoint.x;
    this.offsetY = pt.y - this.startPoint.y;

    // Preview: update element positions
    this.originalPositions.forEach((orig) => {
      const el = this.store.elements.find((e) => e.id === orig.id);
      if (!el) return;
      const updates = {};
      if (el.x !== undefined) updates.x = orig.x + this.offsetX;
      if (el.y !== undefined) updates.y = orig.y + this.offsetY;
      if (el.x1 !== undefined) updates.x1 = orig.x1 + this.offsetX;
      if (el.y1 !== undefined) updates.y1 = orig.y1 + this.offsetY;
      if (el.x2 !== undefined) updates.x2 = orig.x2 + this.offsetX;
      if (el.y2 !== undefined) updates.y2 = orig.y2 + this.offsetY;
      if (el.cx !== undefined) updates.cx = orig.cx + this.offsetX;
      if (el.cy !== undefined) updates.cy = orig.cy + this.offsetY;
      if (el.points) {
        updates.points = orig.points.map((p) => ({
          x: p.x + this.offsetX,
          y: p.y + this.offsetY,
        }));
      }
      this.store.updateElement(el.id, updates);
    });
  }

  onMouseUp(pt) {
    this.isDragging = false;
    this.startPoint = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.store.setTool("select");
  }

  onKeyDown(e) {
    if (e.key === "Escape") {
      // Restore original positions
      this.originalPositions.forEach((orig) => {
        const el = this.store.elements.find((e) => e.id === orig.id);
        if (!el) return;
        const updates = {};
        if (orig.x !== undefined) updates.x = orig.x;
        if (orig.y !== undefined) updates.y = orig.y;
        if (orig.x1 !== undefined) updates.x1 = orig.x1;
        if (orig.y1 !== undefined) updates.y1 = orig.y1;
        if (orig.x2 !== undefined) updates.x2 = orig.x2;
        if (orig.y2 !== undefined) updates.y2 = orig.y2;
        if (orig.cx !== undefined) updates.cx = orig.cx;
        if (orig.cy !== undefined) updates.cy = orig.cy;
        if (orig.points) updates.points = orig.points.map((p) => ({ ...p }));
        this.store.updateElement(el.id, updates);
      });
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(ctx) {
    // Preview is handled by live updates
  }
}