import { BaseTool } from "./BaseTool";

export class CopyTool extends BaseTool {
  constructor(store) {
    super(store);
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.copiedElements = [];
  }

  activate() {
    super.activate();
    const selected = this.store.selectedElementIds;
    if (selected.length === 0) {
      this.store.setTool("select");
      return;
    }
  }

  onMouseDown(pt) {
    this.startPoint = { ...pt };
    this.isDragging = true;
    this.copiedElements = [];
  }

  onMouseMove(pt, e) {
    super.onMouseMove(pt, e);
    if (!this.isDragging || !this.startPoint) return;
    this.offsetX = pt.x - this.startPoint.x;
    this.offsetY = pt.y - this.startPoint.y;
  }

  onMouseUp(pt) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const dx = pt.x - this.startPoint.x;
    const dy = pt.y - this.startPoint.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      this.store.setTool("select");
      return;
    }

    // Copy selected elements with offset
    const selected = this.store.selectedElementIds;
    selected.forEach((id) => {
      const el = this.store.elements.find((e) => e.id === id);
      if (!el) return;
      const newEl = JSON.parse(JSON.stringify(el));
      newEl.id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (newEl.x !== undefined) newEl.x += dx;
      if (newEl.y !== undefined) newEl.y += dy;
      if (newEl.x1 !== undefined) newEl.x1 += dx;
      if (newEl.y1 !== undefined) newEl.y1 += dy;
      if (newEl.x2 !== undefined) newEl.x2 += dx;
      if (newEl.y2 !== undefined) newEl.y2 += dy;
      if (newEl.cx !== undefined) newEl.cx += dx;
      if (newEl.cy !== undefined) newEl.cy += dy;
      if (newEl.points) {
        newEl.points = newEl.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      this.store.addElement(newEl);
    });

    this.startPoint = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.store.setTool("select");
  }

  onKeyDown(e) {
    if (e.key === "Escape") {
      this.store.setTool("select");
      return true;
    }
    return false;
  }

  drawPreview(ctx) {
    if (!this.isDragging || !this.startPoint || !this.currentPoint) return;
    const dx = this.currentPoint.x - this.startPoint.x;
    const dy = this.currentPoint.y - this.startPoint.y;

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    this.store.selectedElementIds.forEach((id) => {
      const el = this.store.elements.find((e) => e.id === id);
      if (!el) return;
      // Draw ghost copy
      if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(el.x1 + dx, el.y1 + dy);
        ctx.lineTo(el.x2 + dx, el.y2 + dy);
        ctx.stroke();
      } else if (el.type === "rectangle") {
        ctx.strokeRect(el.x + dx, el.y + dy, el.width, el.height);
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc(el.cx + dx, el.cy + dy, el.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
  }
}