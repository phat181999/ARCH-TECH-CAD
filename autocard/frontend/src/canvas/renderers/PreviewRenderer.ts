import type { DrawingElement, Layer, Point, ToolType } from "../../types";
import { useDrawingStore } from "../../stores/drawingStore";
import { StyleManager } from "./StyleManager";
import { ElementRenderer } from "./ElementRenderer";

export class PreviewRenderer {
  private elemRenderer: ElementRenderer;

  constructor(private style: StyleManager) {
    this.elemRenderer = new ElementRenderer(style);
  }

  drawPreview(
    ctx: CanvasRenderingContext2D,
    tool: ToolType,
    isDrawing: boolean,
    startPoint: Point | null,
    dragPoint: Point | null,
    currentPolylineId: string | null,
    elements: DrawingElement[],
    layerMap: Record<string, Layer>,
    isDarkMode: boolean,
    selectedElementIds: string[],
    blockDefs: Record<string, any>,
    operationPivot?: Point | null,
    typedValue?: string
  ): void {
    if (!isDrawing || !startPoint || !dragPoint) return;

    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    // Compute active drag point for standard operations when typedValue is active
    let activeDragPoint = dragPoint;
    if (typedValue && !["rotate", "scale"].includes(tool)) {
      const val = parseFloat(typedValue);
      if (!isNaN(val)) {
        const dx = dragPoint.x - startPoint.x;
        const dy = dragPoint.y - startPoint.y;
        const dist = Math.hypot(dx, dy);
        const ux = dist > 0.1 ? dx / dist : 1;
        const uy = dist > 0.1 ? dy / dist : 0;
        activeDragPoint = {
          x: startPoint.x + ux * val * 100,
          y: startPoint.y + uy * val * 100,
        };
      }
    }

    if (tool === "copy") {
      const dx = activeDragPoint.x - startPoint.x;
      const dy = activeDragPoint.y - startPoint.y;

      // Draw offset vector guideline
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();

      // Render copies
      ctx.save();
      ctx.translate(dx, dy);
      ctx.globalAlpha = 0.5;
      elements.forEach((el) => {
        if (!selectedElementIds.includes(el.id)) return;
        this.elemRenderer.drawElement(ctx, el, false, layerMap, blockDefs, isDarkMode, false);
      });
      ctx.restore();
    } else if (tool === "rotate" && operationPivot) {
      const baseAngle = Math.atan2(startPoint.y - operationPivot.y, startPoint.x - operationPivot.x);
      let delta = 0;
      let newAngle = 0;

      if (typedValue) {
        const val = parseFloat(typedValue);
        if (!isNaN(val)) {
          delta = (val * Math.PI) / 180;
          newAngle = baseAngle + delta;
        }
      } else {
        newAngle = Math.atan2(dragPoint.y - operationPivot.y, dragPoint.x - operationPivot.x);
        delta = newAngle - baseAngle;
      }

      // Draw pivot guideline
      ctx.beginPath();
      ctx.moveTo(operationPivot.x, operationPivot.y);
      ctx.lineTo(startPoint.x, startPoint.y);
      ctx.stroke();

      const dist = Math.hypot(startPoint.x - operationPivot.x, startPoint.y - operationPivot.y);
      ctx.beginPath();
      ctx.moveTo(operationPivot.x, operationPivot.y);
      if (typedValue) {
        ctx.lineTo(operationPivot.x + Math.cos(newAngle) * dist, operationPivot.y + Math.sin(newAngle) * dist);
      } else {
        ctx.lineTo(dragPoint.x, dragPoint.y);
      }
      ctx.stroke();

      // Draw rotation angle indicator arc
      const arcDist = Math.min(50, dist);
      if (arcDist > 5) {
        ctx.beginPath();
        ctx.arc(operationPivot.x, operationPivot.y, arcDist, baseAngle, newAngle, delta < 0);
        ctx.stroke();
      }

      // Render rotated previews
      ctx.save();
      ctx.translate(operationPivot.x, operationPivot.y);
      ctx.rotate(delta);
      ctx.translate(-operationPivot.x, -operationPivot.y);
      ctx.globalAlpha = 0.5;
      elements.forEach((el) => {
        if (!selectedElementIds.includes(el.id)) return;
        this.elemRenderer.drawElement(ctx, el, false, layerMap, blockDefs, isDarkMode, false);
      });
      ctx.restore();
    } else if (tool === "scale" && operationPivot) {
      const baseDist = Math.hypot(startPoint.x - operationPivot.x, startPoint.y - operationPivot.y);
      let factor = 1;

      if (typedValue) {
        const val = parseFloat(typedValue);
        if (!isNaN(val)) {
          factor = val;
        }
      } else {
        const newDist = Math.hypot(dragPoint.x - operationPivot.x, dragPoint.y - operationPivot.y);
        factor = baseDist > 1 ? newDist / baseDist : 1;
      }

      // Draw scale guideline
      ctx.beginPath();
      ctx.moveTo(operationPivot.x, operationPivot.y);
      if (typedValue) {
        const dx = startPoint.x - operationPivot.x;
        const dy = startPoint.y - operationPivot.y;
        ctx.lineTo(operationPivot.x + dx * factor, operationPivot.y + dy * factor);
      } else {
        ctx.lineTo(dragPoint.x, dragPoint.y);
      }
      ctx.stroke();

      // Render scaled previews
      ctx.save();
      ctx.translate(operationPivot.x, operationPivot.y);
      ctx.scale(factor, factor);
      ctx.translate(-operationPivot.x, -operationPivot.y);
      ctx.globalAlpha = 0.5;
      elements.forEach((el) => {
        if (!selectedElementIds.includes(el.id)) return;
        this.elemRenderer.drawElement(ctx, el, false, layerMap, blockDefs, isDarkMode, false);
      });
      ctx.restore();
    } else if (tool === "line" || tool === "wall") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();
    } else if (tool === "polyline" && currentPolylineId) {
      const el = elements.find((e) => e.id === currentPolylineId);
      if (el && el.points && el.points.length > 0) {
        const lastPt = el.points[el.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
        ctx.stroke();
      }
    } else if (tool === "rectangle") {
      const w = activeDragPoint.x - startPoint.x;
      const h = activeDragPoint.y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, w, h);
    } else if (tool === "circle") {
      const r = Math.hypot(activeDragPoint.x - startPoint.x, activeDragPoint.y - startPoint.y);
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === "dimension") {
      const dx = activeDragPoint.x - startPoint.x;
      const dy = activeDragPoint.y - startPoint.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const off = 30;
        const d1x = startPoint.x + nx * off, d1y = startPoint.y + ny * off;
        const d2x = activeDragPoint.x + nx * off, d2y = activeDragPoint.y + ny * off;
        // Extension lines
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(d1x + nx * 4, d1y + ny * 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(activeDragPoint.x, activeDragPoint.y);
        ctx.lineTo(d2x + nx * 4, d2y + ny * 4);
        ctx.stroke();
        // Dim line
        ctx.beginPath();
        ctx.moveTo(d1x, d1y);
        ctx.lineTo(d2x, d2y);
        ctx.stroke();
        // Label
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const formatLength = useDrawingStore.getState().formatLength;
        ctx.fillText(formatLength(len / 100), (d1x + d2x) / 2, (d1y + d2y) / 2 - 3);
      }
    } else if (tool === "leader") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();
      const angle = Math.atan2(activeDragPoint.y - startPoint.y, activeDragPoint.x - startPoint.x);
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(startPoint.x + arrowSize * Math.cos(angle + Math.PI * 0.8), startPoint.y + arrowSize * Math.sin(angle + Math.PI * 0.8));
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(startPoint.x + arrowSize * Math.cos(angle - Math.PI * 0.8), startPoint.y + arrowSize * Math.sin(angle - Math.PI * 0.8));
      ctx.stroke();
    } else if (tool === "hatch") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.lineTo(startPoint.x, activeDragPoint.y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fill();
    } else if (tool === "spline") {
      // Draw preview line from last placed point to cursor
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();
    } else if (tool === "dim-angular") {
      // Preview: show two rays from startPoint to cursor
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();
    } else if (tool === "stair") {
      const steps = Math.max(3, Math.round(Math.abs(activeDragPoint.y - startPoint.y) / 20));
      const dx = activeDragPoint.x - startPoint.x;
      const dy = activeDragPoint.y - startPoint.y;
      const stepH = dy / steps;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = i % 2 === 0 ? startPoint.x : startPoint.x + dx;
        const xNext = i % 2 === 0 ? startPoint.x + dx : startPoint.x;
        const y = startPoint.y + i * stepH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        if (i < steps) ctx.lineTo(xNext, y);
      }
      ctx.stroke();
    } else if (tool === "arc") {
      const r = Math.hypot(activeDragPoint.x - startPoint.x, activeDragPoint.y - startPoint.y);
      const angle = Math.atan2(activeDragPoint.y - startPoint.y, activeDragPoint.x - startPoint.x);
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, r, angle - Math.PI / 2, angle + Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(activeDragPoint.x, activeDragPoint.y);
      ctx.stroke();
    } else if (tool === "polygon") {
      const r = Math.hypot(activeDragPoint.x - startPoint.x, activeDragPoint.y - startPoint.y);
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * 2 * Math.PI - Math.PI / 2;
        const px = startPoint.x + r * Math.cos(a);
        const py = startPoint.y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (tool === "ellipse") {
      const rx = Math.max(Math.abs(activeDragPoint.x - startPoint.x) / 2, 1);
      const ry = Math.max(Math.abs(activeDragPoint.y - startPoint.y) / 2, 1);
      const cx = (startPoint.x + activeDragPoint.x) / 2;
      const cy = (startPoint.y + activeDragPoint.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
