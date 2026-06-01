import type { Point } from "../../types";

export class GridRenderer {
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, panOffset: Point, zoom: number, gridVisible: boolean): void {
    if (!gridVisible) return;
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    // Adaptive grid: keep screen spacing between 20–200px regardless of zoom level
    let gridSize = 40;
    while (gridSize * zoom < 20) gridSize *= 4;
    while (gridSize * zoom > 200) gridSize /= 4;
    const viewW = width / zoom;
    const viewH = height / zoom;
    const startX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize;

    ctx.beginPath();
    for (let x = startX; x < startX + viewW + gridSize; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, startY + viewH + gridSize);
    }
    for (let y = startY; y < startY + viewH + gridSize; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + viewW + gridSize, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}
