import type { Point } from "../../types";

export class CollabRenderer {
  drawCursors(ctx: CanvasRenderingContext2D, cursors: Record<string, { x?: number; y?: number }>, users: any[], zoom: number, panOffset: Point): void {
    Object.entries(cursors).forEach(([uid, pos]) => {
      if (pos && pos.x !== undefined && pos.y !== undefined) {
        const screenX = pos.x * zoom + panOffset.x;
        const screenY = pos.y * zoom + panOffset.y;
        ctx.save();
        ctx.strokeStyle = "#10b981";
        ctx.fillStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + 10, screenY + 16);
        ctx.lineTo(screenX + 4, screenY + 12);
        ctx.lineTo(screenX - 2, screenY + 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const collabUser = users.find((u) => u.id === uid);
        if (collabUser) {
          ctx.font = "10px Arial";
          ctx.fillStyle = "#10b981";
          ctx.fillText(collabUser.username || "User", screenX + 12, screenY + 4);
        }
        ctx.restore();
      }
    });
  }
}
