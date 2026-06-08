import type { ArchitecturalPlan, Layer } from "../../types";
import { WallEngine } from "../../core/wallEngine";
import { RoomEngine } from "../../core/roomEngine";
import { WallEntity } from "../../core/entities";
import { StyleManager } from "./StyleManager";
import { ElementRenderer } from "./ElementRenderer";

export class ArchitecturalRenderer {
  constructor(private style: StyleManager) {}

  drawPlan(
    ctx: CanvasRenderingContext2D,
    plan: ArchitecturalPlan,
    layerMap: Record<string, Layer>,
    isDarkMode: boolean,
    manualWalls: WallEntity[] = [],
    zoom: number = 1
  ): void {
    const wallEntities: WallEntity[] = (plan.walls || []).map((w) => ({
      id: w.id,
      type: "wall",
      layerId: "A-WALL",
      visible: true,
      start: { x: w.x1, y: w.y1 },
      end: { x: w.x2, y: w.y2 },
      thickness: w.thickness || 20,
    }));

    const computedPolygons = WallEngine.computePolygons(wallEntities);

    this.style.applyLayerStyle(ctx, "A-WALL", layerMap, isDarkMode, zoom);
    ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#1e293b"; // Solid fill for walls

    computedPolygons.forEach((poly) => {
      ctx.beginPath();
      ctx.moveTo(poly.points[0].x, poly.points[0].y);
      for (let i = 1; i < poly.points.length; i++) {
        ctx.lineTo(poly.points[i].x, poly.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke(); // Add subtle outline for overlap definition
    });

    // Extract and draw manual rooms
    if (manualWalls.length >= 4) {
      const detectedRooms = RoomEngine.detectRooms(manualWalls);
      detectedRooms.forEach((room) => {
        if (room.boundary.length >= 3) {
          this.style.applyLayerStyle(ctx, "A-HATCH", layerMap, !!isDarkMode, zoom);
          ctx.beginPath();
          ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
          for (let i = 1; i < room.boundary.length; i++) {
            ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.65)";
          ctx.fill();
        }
        this.style.applyLayerStyle(ctx, "A-ROOM", layerMap, !!isDarkMode, zoom);
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = isDarkMode ? "#CBD5E1" : "#334155";
        ctx.fillText(room.label, room.labelX, room.labelY);
      });
    }

    (plan.rooms || []).forEach((room) => {
      if (room.boundary.length >= 3) {
        this.style.applyLayerStyle(ctx, "A-HATCH", layerMap, isDarkMode, zoom);
        ctx.beginPath();
        ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
        for (let i = 1; i < room.boundary.length; i++) {
          ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fill();
      }
      this.style.applyLayerStyle(ctx, "A-ROOM", layerMap, isDarkMode, zoom);
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isDarkMode ? "#CBD5E1" : "#334155";
      ctx.fillText(room.name, room.labelX, room.labelY);
    });

    (plan.openings || []).forEach((opening) => {
      this.style.applyLayerStyle(ctx, opening.type === "door" ? "A-DOOR" : "A-WIND", layerMap, isDarkMode, zoom);
      if (opening.type === "door") {
        ctx.beginPath();
        ctx.moveTo(opening.x, opening.y);
        ctx.lineTo(opening.x, opening.y - opening.width);
        ctx.stroke();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(opening.x, opening.y, opening.width, -Math.PI / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.moveTo(opening.x, opening.y);
        ctx.lineTo(opening.x + opening.width, opening.y);
        ctx.stroke();
      }
    });

    plan.gridAxes.forEach((axis) => {
      this.style.applyLayerStyle(ctx, "A-GRID", layerMap, isDarkMode, zoom);
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      if (axis.orientation === "vertical") {
        ctx.moveTo(axis.value, -1000);
        ctx.lineTo(axis.value, 2000);
      } else {
        ctx.moveTo(-1000, axis.value);
        ctx.lineTo(2000, axis.value);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    plan.dimensions.forEach((dim) => {
      const elemRenderer = new ElementRenderer(this.style);
      elemRenderer.drawDimension(
        ctx,
        {
          id: dim.id,
          type: "dimension",
          layerId: "A-DIMS",
          x1: dim.x1,
          y1: dim.y1,
          x2: dim.x2,
          y2: dim.y2,
          label: dim.label,
        },
        "#DC2626",
        zoom
      );
    });
  }

  drawOpenings(ctx: CanvasRenderingContext2D, openings: any[], walls: any[], isDarkMode: boolean, zoom: number = 1): void {
    const bgColor = isDarkMode ? "#1e293b" : "#f8fafc"; // Matches canvas background to punch holes

    openings.forEach((door) => {
      const wall = walls.find((w) => w.id === door.hostWallId);
      if (!wall || !wall.start) return;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const angle = Math.atan2(dy, dx);
      const thickness = wall.thickness || 20;

      ctx.save();
      ctx.translate(door.position.x, door.position.y);
      ctx.rotate(angle);

      // Punch hole in wall
      ctx.fillStyle = bgColor;
      ctx.fillRect(-door.width / 2, -thickness / 2 - 1, door.width, thickness + 2);

      // Draw door arc and panel
      ctx.strokeStyle = isDarkMode ? "#60a5fa" : "#3b82f6";
      ctx.lineWidth = 1.5 / zoom;

      // Draw panel
      ctx.beginPath();
      ctx.moveTo(-door.width / 2, -thickness / 2);
      ctx.lineTo(-door.width / 2, -thickness / 2 - door.width);
      ctx.stroke();

      // Draw swing arc
      ctx.beginPath();
      ctx.arc(-door.width / 2, -thickness / 2, door.width, 0, Math.PI / 2, false);
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      ctx.restore();
    });
  }
}
