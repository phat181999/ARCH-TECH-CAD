import { ArchitecturalPlan, DrawingElement, Point, Layer, ToolType } from "../types";
import { drawSnapIndicator, SnapResult } from "./snap";
import { WallEngine } from "../core/wallEngine";
import { RoomEngine } from "../core/roomEngine";
import { WallEntity } from "../core/entities";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  panOffset: Point;
  zoom: number;
  gridVisible: boolean;
  elements: DrawingElement[];
  selectedElementIds: string[];
  layers: Layer[];
  tool: ToolType;
  isDrawing: boolean;
  startPoint: Point | null;
  dragPoint: Point | null;
  currentPolylineId: string | null;
  snapPoint: SnapResult | null;
  collabCursors: Record<string, {x?: number, y?: number}>;
  collabUsers: any[];
  blockDefs: Record<string, any>;
  architecturalPlan: ArchitecturalPlan | null;
  isDarkMode?: boolean;
}

export class CadEngine {
  public render(params: RenderContext) {
    const {
      ctx, width, height, panOffset, zoom, gridVisible, elements,
      selectedElementIds, layers, tool, isDrawing, startPoint, dragPoint,
      currentPolylineId, snapPoint, collabCursors, collabUsers, blockDefs, architecturalPlan, isDarkMode
    } = params;

    const devicePixelRatio = window.devicePixelRatio || 1;
    ctx.canvas.width = width * devicePixelRatio;
    ctx.canvas.height = height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    this.drawGrid(ctx, width, height, panOffset, zoom, gridVisible);
    
    // Build layer map
    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const layerMap: Record<string, Layer> = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    // Enhance draw: Implement z-indexing / ordering if needed
    // Currently, elements are drawn in array order
    const visibleElements = architecturalPlan ? elements.filter((el) => !el.archType) : elements;
    // Extract manual wall entities (needed by both render path and drawArchitecturalPlan)
    const manualWalls = visibleElements.filter(el => el.type === "wall" && visibleLayerIds.includes(el.layerId) && el.start && el.end) as any as WallEntity[];
    if (architecturalPlan) {
      this.drawArchitecturalPlan(ctx, architecturalPlan, layerMap, !!isDarkMode, manualWalls);
    }
    const allWalls = [...manualWalls, ...(architecturalPlan?.walls || []).map(w => ({ id: w.id, type: "wall", start: {x: w.x1, y: w.y1}, end: {x: w.x2, y: w.y2}, thickness: w.thickness || 20 }))];
    
    if (manualWalls.length > 0) {
      const computedPolygons = WallEngine.computePolygons(manualWalls);
      this.applyLayerStyle(ctx, "A-WALL", layerMap, !!isDarkMode);
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#1e293b";
      computedPolygons.forEach((poly) => {
        ctx.beginPath();
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        for (let i = 1; i < poly.points.length; i++) {
          ctx.lineTo(poly.points[i].x, poly.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    // Extract and draw openings (Doors)
    const openings = visibleElements.filter(el => el.type === "opening" && visibleLayerIds.includes(el.layerId)) as any[];
    if (openings.length > 0) {
      this.drawOpenings(ctx, openings, allWalls, !!isDarkMode);
    }

    visibleElements.forEach((el) => {
      if (!visibleLayerIds.includes(el.layerId)) return;
      if (el.type === "wall" || el.type === "opening") return; // Handled above
      this.drawElement(ctx, el, selectedElementIds.includes(el.id), layerMap, blockDefs, !!isDarkMode);
    });

    this.drawPreview(ctx, tool, isDrawing, startPoint, dragPoint, currentPolylineId, elements, layerMap, !!isDarkMode);

    this.drawCursors(ctx, collabCursors, collabUsers, zoom, panOffset);

    ctx.restore();

    // Draw snap indicator AFTER restore() — in screen space so size is always consistent
    if (snapPoint) {
      const sx = snapPoint.point.x * zoom + panOffset.x;
      const sy = snapPoint.point.y * zoom + panOffset.y;
      drawSnapIndicator(ctx, { x: sx, y: sy }, snapPoint.type);
    }
  }

  private drawOpenings(ctx: CanvasRenderingContext2D, openings: any[], walls: any[], isDarkMode: boolean) {
    const bgColor = isDarkMode ? "#1e293b" : "#f8fafc"; // Matches canvas background to punch holes

    openings.forEach((door) => {
      const wall = walls.find(w => w.id === door.hostWallId);
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
      ctx.lineWidth = 1.5;

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

  private drawArchitecturalPlan(ctx: CanvasRenderingContext2D, plan: ArchitecturalPlan, layerMap: Record<string, Layer>, isDarkMode: boolean, manualWalls: WallEntity[] = []) {
    const wallEntities: WallEntity[] = (plan.walls || []).map(w => ({
      id: w.id,
      type: "wall",
      layerId: "A-WALL",
      visible: true,
      start: { x: w.x1, y: w.y1 },
      end: { x: w.x2, y: w.y2 },
      thickness: w.thickness || 20
    }));

    const computedPolygons = WallEngine.computePolygons(wallEntities);

    this.applyLayerStyle(ctx, "A-WALL", layerMap, isDarkMode);
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
          this.applyLayerStyle(ctx, "A-HATCH", layerMap, !!isDarkMode);
          ctx.beginPath();
          ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
          for (let i = 1; i < room.boundary.length; i++) {
            ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.65)";
          ctx.fill();
        }
        this.applyLayerStyle(ctx, "A-ROOM", layerMap, !!isDarkMode);
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = isDarkMode ? "#CBD5E1" : "#334155";
        ctx.fillText(room.label, room.labelX, room.labelY);
      });
    }

    (plan.rooms || []).forEach((room) => {
      if (room.boundary.length >= 3) {
        this.applyLayerStyle(ctx, "A-HATCH", layerMap, isDarkMode);
        ctx.beginPath();
        ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
        for (let i = 1; i < room.boundary.length; i++) {
          ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fill();
      }
      this.applyLayerStyle(ctx, "A-ROOM", layerMap, isDarkMode);
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isDarkMode ? "#CBD5E1" : "#334155";
      ctx.fillText(room.name, room.labelX, room.labelY);
    });

    (plan.openings || []).forEach((opening) => {
      this.applyLayerStyle(ctx, opening.type === "door" ? "A-DOOR" : "A-WIND", layerMap, isDarkMode);
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
      this.applyLayerStyle(ctx, "A-GRID", layerMap, isDarkMode);
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
      this.drawDimension(ctx, {
        id: dim.id,
        type: "dimension",
        layerId: "A-DIMS",
        x1: dim.x1,
        y1: dim.y1,
        x2: dim.x2,
        y2: dim.y2,
        label: dim.label,
      }, "#DC2626");
    });
  }

  private applyLayerStyle(ctx: CanvasRenderingContext2D, layerId: string, layerMap: Record<string, Layer>, isDarkMode: boolean) {
    const layer = layerMap[layerId];
    this.applyStyle(ctx, layer?.style || {}, isDarkMode);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    panOffset: Point,
    zoom: number,
    gridVisible: boolean
  ) {
    if (!gridVisible) return;
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    const gridSize = 40;
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

  private applyStyle(ctx: CanvasRenderingContext2D, style: any, isDarkMode: boolean) {
    let strokeColor = style.strokeColor || "#1f2937";
    if (isDarkMode && (strokeColor === "#1f2937" || strokeColor === "#111827" || strokeColor === "#000000" || strokeColor === "#0F172A")) {
      strokeColor = "#F8FAFC"; // White lines on dark background
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = style.fillColor || "transparent";
    ctx.lineWidth = style.lineWidth || style.strokeWidth || 2;
    if (style.lineType === "dashed") {
      ctx.setLineDash([8, 4]);
    } else if (style.lineType === "dotted") {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }
  }

  private drawElement(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    isSelected: boolean,
    layerMap: Record<string, Layer>,
    blockDefs: Record<string, any>,
    isDarkMode: boolean
  ) {
    ctx.save();

    const layer = layerMap[el.layerId];
    const layerStyle = layer?.style || {};
    const strokeColor = el.strokeColor || layerStyle.strokeColor || "#1f2937";
    const fillColor = el.fillColor || layerStyle.fillColor || "transparent";
    const lineWidth = el.strokeWidth || el.lineWidth || layerStyle.lineWidth || 2;
    const lineType = el.lineType || layerStyle.lineType || "solid";

    this.applyStyle(ctx, { strokeColor, fillColor, lineWidth, lineType }, isDarkMode);
    
    // Also invert raw stroke colors if drawn as text
    let finalStrokeColor = strokeColor;
    if (isDarkMode && (strokeColor === "#1f2937" || strokeColor === "#111827" || strokeColor === "#000000" || strokeColor === "#0F172A")) {
      finalStrokeColor = "#F8FAFC";
    }

    ctx.font = `${el.fontStyle || "normal"} ${el.fontWeight || "normal"} ${el.fontSize || 16}px ${el.fontFamily || "sans-serif"}`;
    ctx.textAlign = (el.textAlign as CanvasTextAlign) || "left";
    ctx.textBaseline = "alphabetic";

    if (isSelected) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
    }

    if (el.type === "rectangle") {
      ctx.strokeRect(el.x!, el.y!, el.width!, el.height!);
      if (fillColor && fillColor !== "transparent") {
        ctx.fillRect(el.x!, el.y!, el.width!, el.height!);
      }
    } else if (el.type === "circle") {
      ctx.beginPath();
      ctx.arc(el.cx!, el.cy!, el.radius!, 0, Math.PI * 2);
      ctx.stroke();
      if (fillColor && fillColor !== "transparent") ctx.fill();
    } else if (el.type === "line") {
      ctx.beginPath();
      ctx.moveTo(el.x1!, el.y1!);
      ctx.lineTo(el.x2!, el.y2!);
      ctx.stroke();
    } else if (el.type === "arc") {
      const startAngle = typeof el.startAngle === "number" ? (el.startAngle * Math.PI) / 180 : 0;
      const endAngle = typeof el.endAngle === "number" ? (el.endAngle * Math.PI) / 180 : Math.PI;
      ctx.beginPath();
      ctx.arc(el.cx!, el.cy!, el.radius!, startAngle, endAngle);
      ctx.stroke();
    } else if (el.type === "ellipse") {
      const rx = (el as any).rx || 50;
      const ry = (el as any).ry || 30;
      ctx.beginPath();
      ctx.ellipse(el.cx!, el.cy!, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (fillColor && fillColor !== "transparent") ctx.fill();
    } else if (el.type === "polyline") {
      const pts = el.points || [];
      if (pts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (el.closed) ctx.closePath();
        ctx.stroke();
        if (fillColor && fillColor !== "transparent") ctx.fill();
      }
    } else if (el.type === "text") {
      ctx.fillStyle = finalStrokeColor;
      ctx.fillText(el.text || "", el.x!, el.y!);
    } else if (el.type === "leader") {
      this.drawLeader(ctx, el, finalStrokeColor);
    } else if (el.type === "hatch") {
      this.drawHatch(ctx, el, finalStrokeColor, fillColor);
    } else if (el.type === "block") {
      this.drawBlock(ctx, el, blockDefs, isDarkMode);
    } else if (el.type === "dimension") {
      this.drawDimension(ctx, el, finalStrokeColor);
    }

    ctx.restore();
  }

  private drawLeader(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string) {
    const pts = el.points || [];
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      const p0 = pts[0], p1 = pts[1];
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const arrowSize = 8;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + arrowSize * Math.cos(angle + Math.PI * 0.8), p0.y + arrowSize * Math.sin(angle + Math.PI * 0.8));
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + arrowSize * Math.cos(angle - Math.PI * 0.8), p0.y + arrowSize * Math.sin(angle - Math.PI * 0.8));
      ctx.stroke();
      if (el.text) {
        const last = pts[pts.length - 1];
        ctx.fillStyle = strokeColor;
        ctx.font = "14px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(el.text, last.x + 4, last.y - 2);
      }
    }
  }

  private drawHatch(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, fillColor: string) {
    if (!el.points || el.points.length < 3) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach((p: Point) => {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    });

    // Draw boundary outline
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.closePath();
    ctx.stroke();

    // Background fill
    if (fillColor && fillColor !== "transparent") {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    const pattern = el.pattern || "solid";
    if (pattern === "solid") return;

    // Clip to boundary
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.setLineDash([]);
    const pad = 22;

    switch (pattern) {
      case "diagonal":
      case "diagonal45": {
        // 45° lines: direction (1,1) in screen space, x - y = const
        ctx.lineWidth = 0.5;
        const sp = 6;
        for (let c = (minX - pad) - (maxY + pad); c < (maxX + pad) - (minY - pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c);
          ctx.lineTo(maxX + pad, (maxX + pad) - c);
          ctx.stroke();
        }
        break;
      }
      case "diagonal135": {
        // 135° lines: x + y = const
        ctx.lineWidth = 0.5;
        const sp = 6;
        for (let c = (minX - pad) + (minY - pad); c < (maxX + pad) + (maxY + pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, c - (minX - pad));
          ctx.lineTo(maxX + pad, c - (maxX + pad));
          ctx.stroke();
        }
        break;
      }
      case "cross": {
        // Diagonal crosshatch (45° + 135°)
        ctx.lineWidth = 0.5;
        const sp = 8;
        for (let c = (minX - pad) - (maxY + pad); c < (maxX + pad) - (minY - pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c);
          ctx.lineTo(maxX + pad, (maxX + pad) - c);
          ctx.stroke();
        }
        for (let c = (minX - pad) + (minY - pad); c < (maxX + pad) + (maxY + pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, c - (minX - pad));
          ctx.lineTo(maxX + pad, c - (maxX + pad));
          ctx.stroke();
        }
        break;
      }
      case "grid": {
        // Orthogonal grid
        ctx.lineWidth = 0.6;
        const sp = 14;
        for (let x = minX - pad; x < maxX + pad; x += sp) {
          ctx.beginPath(); ctx.moveTo(x, minY - pad); ctx.lineTo(x, maxY + pad); ctx.stroke();
        }
        for (let y = minY - pad; y < maxY + pad; y += sp) {
          ctx.beginPath(); ctx.moveTo(minX - pad, y); ctx.lineTo(maxX + pad, y); ctx.stroke();
        }
        break;
      }
      case "brick": {
        // Brick masonry — staggered horizontal courses
        ctx.lineWidth = 0.7;
        const bh = 10, bw = 22;
        let row = 0;
        for (let y = minY - pad; y < maxY + pad; y += bh, row++) {
          ctx.beginPath(); ctx.moveTo(minX - pad, y); ctx.lineTo(maxX + pad, y); ctx.stroke();
          const xOff = (row % 2) * (bw / 2);
          for (let x = minX - pad - bw; x < maxX + pad; x += bw) {
            const jx = x + xOff;
            ctx.beginPath(); ctx.moveTo(jx, y); ctx.lineTo(jx, y + bh); ctx.stroke();
          }
        }
        break;
      }
      case "concrete": {
        // Concrete: fine diagonal + aggregate dots
        ctx.lineWidth = 0.4;
        const sp = 5;
        for (let c = (minX - pad) - (maxY + pad); c < (maxX + pad) - (minY - pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c);
          ctx.lineTo(maxX + pad, (maxX + pad) - c);
          ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let x = minX + 4; x < maxX; x += 11) {
          for (let y = minY + 4; y < maxY; y += 11) {
            const ox = ((x * 7 + y * 3) % 9) - 4;
            const oy = ((x * 3 + y * 11) % 9) - 4;
            ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case "insulation": {
        // Insulation batt: zigzag rows
        ctx.lineWidth = 1;
        const rowH = 14, zigW = 10;
        for (let y = minY - pad; y < maxY + pad; y += rowH) {
          ctx.beginPath();
          let goUp = true;
          let first = true;
          for (let x = minX - pad; x < maxX + pad; x += zigW) {
            const yPos = goUp ? y : y + rowH - 2;
            if (first) { ctx.moveTo(x, yPos); first = false; }
            else ctx.lineTo(x, yPos);
            goUp = !goUp;
          }
          ctx.stroke();
        }
        break;
      }
      case "tile": {
        // Ceramic tile grid (coarser than "grid")
        ctx.lineWidth = 0.9;
        const ts = 20;
        for (let x = minX - pad; x < maxX + pad; x += ts) {
          ctx.beginPath(); ctx.moveTo(x, minY - pad); ctx.lineTo(x, maxY + pad); ctx.stroke();
        }
        for (let y = minY - pad; y < maxY + pad; y += ts) {
          ctx.beginPath(); ctx.moveTo(minX - pad, y); ctx.lineTo(maxX + pad, y); ctx.stroke();
        }
        break;
      }
      case "wood": {
        // Wood grain: horizontal lines with slight organic wave
        ctx.lineWidth = 0.5;
        const sp = 5;
        for (let y = minY - pad; y < maxY + pad; y += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          for (let x = minX - pad; x <= maxX + pad; x += 15) {
            ctx.lineTo(x, y + Math.sin(x * 0.08 + y * 0.15) * 1.5);
          }
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
        break;
      }
      case "steel": {
        // Dense 45° diagonal fill (ANSI37)
        ctx.lineWidth = 0.35;
        const sp = 2.5;
        for (let c = (minX - pad) - (maxY + pad); c < (maxX + pad) - (minY - pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c);
          ctx.lineTo(maxX + pad, (maxX + pad) - c);
          ctx.stroke();
        }
        break;
      }
      case "glass": {
        // Glazing: diagonal line pairs
        ctx.lineWidth = 0.6;
        const sp = 14;
        for (let c = (minX - pad) - (maxY + pad); c < (maxX + pad) - (minY - pad); c += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c);
          ctx.lineTo(maxX + pad, (maxX + pad) - c);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(minX - pad, (minX - pad) - c - 4);
          ctx.lineTo(maxX + pad, (maxX + pad) - c - 4);
          ctx.stroke();
        }
        break;
      }
      case "earth": {
        // Earth fill: horizontal lines + scattered dots
        ctx.lineWidth = 0.6;
        const sp = 8;
        for (let y = minY - pad; y < maxY + pad; y += sp) {
          ctx.beginPath(); ctx.moveTo(minX - pad, y); ctx.lineTo(maxX + pad, y); ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let x = minX + 5; x < maxX; x += 12) {
          for (let y = minY + 5; y < maxY; y += 8) {
            if ((((x / 12 | 0) + (y / 8 | 0)) % 2) === 0) {
              ctx.beginPath();
              ctx.arc(x + ((x * 3 + y * 7) % 5) - 2, y + ((x * 7 + y) % 4) - 2, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        break;
      }
      case "gravel": {
        // Gravel aggregate: scattered variable-size dots
        ctx.fillStyle = strokeColor;
        for (let x = minX + 5; x < maxX; x += 8) {
          for (let y = minY + 5; y < maxY; y += 8) {
            const ox = ((x * 13 + y * 7) % 7) - 3;
            const oy = ((x * 5 + y * 17) % 7) - 3;
            const r = 1 + ((x * 3 + y * 5) % 3) * 0.5;
            ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case "sand": {
        // Fine sand: dense micro-dots
        ctx.fillStyle = strokeColor;
        for (let x = minX + 3; x < maxX; x += 5) {
          for (let y = minY + 3; y < maxY; y += 5) {
            const ox = ((x * 11 + y * 5) % 5) - 2;
            const oy = ((x * 3 + y * 13) % 5) - 2;
            ctx.beginPath(); ctx.arc(x + ox, y + oy, 0.8, 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      default: {
        // Horizontal lines fallback
        ctx.lineWidth = 0.5;
        for (let y = minY - pad; y < maxY + pad; y += 6) {
          ctx.beginPath(); ctx.moveTo(minX - pad, y); ctx.lineTo(maxX + pad, y); ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  private drawBlock(ctx: CanvasRenderingContext2D, el: DrawingElement, blockDefs: Record<string, any>, isDarkMode: boolean) {
    if (!el.blockId) return;
    const blockDef = blockDefs[el.blockId];
    if (blockDef) {
      ctx.save();
      ctx.translate(el.x || 0, el.y || 0);
      ctx.scale(el.scale || 1, el.scale || 1);
      ctx.rotate((el.rotation || 0) * Math.PI / 180);
      blockDef.elements.forEach((be: any) => {
        ctx.save();
        this.applyStyle(ctx, {
          strokeColor: be.strokeColor || "#1f2937",
          fillColor: be.fillColor || "transparent",
          lineWidth: be.strokeWidth || 2,
          lineType: be.lineType || "solid",
        }, isDarkMode);
        if (be.type === "line") {
          ctx.beginPath();
          ctx.moveTo(be.x1, be.y1);
          ctx.lineTo(be.x2, be.y2);
          ctx.stroke();
        } else if (be.type === "rectangle") {
          if (be.fillColor && be.fillColor !== "transparent") {
            ctx.fillRect(be.x, be.y, be.width, be.height);
          }
          ctx.strokeRect(be.x, be.y, be.width, be.height);
        } else if (be.type === "circle") {
          ctx.beginPath();
          ctx.arc(be.cx, be.cy, be.radius, 0, Math.PI * 2);
          if (be.fillColor && be.fillColor !== "transparent") ctx.fill();
          ctx.stroke();
        } else if (be.type === "arc") {
          const startRad = ((be.startAngle || 0) * Math.PI) / 180;
          const endRad = ((be.endAngle || 360) * Math.PI) / 180;
          ctx.beginPath();
          ctx.arc(be.cx, be.cy, be.radius, startRad, endRad, false);
          ctx.stroke();
        } else if (be.type === "polyline") {
          if (be.points && be.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(be.points[0].x, be.points[0].y);
            for (let pi = 1; pi < be.points.length; pi++) ctx.lineTo(be.points[pi].x, be.points[pi].y);
            if (be.closed) ctx.closePath();
            ctx.stroke();
          }
        } else if (be.type === "text") {
          ctx.fillStyle = be.strokeColor || "#1f2937";
          ctx.font = `${be.fontStyle || "normal"} ${be.fontWeight || "normal"} ${be.fontSize || 16}px ${be.fontFamily || "Arial"}`;
          ctx.textAlign = be.textAlign || "left";
          ctx.fillText(be.text || "", be.x, be.y);
        }
        ctx.restore();
      });
      ctx.restore();
    }
  }

  private drawDimension(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string) {
    if (el.x1 === undefined || el.y1 === undefined || el.x2 === undefined || el.y2 === undefined) return;

    const dx = el.x2 - el.x1;
    const dy = el.y2 - el.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    // Unit vectors
    const ux = dx / len, uy = dy / len;
    // Left-perpendicular normal
    const nx = -uy, ny = ux;

    const offset = typeof el.offset === "number" ? el.offset : 30;
    const arrowLen = 10, arrowW = 3.5;
    const extGap = 3, extOver = 4;

    // Dimension line endpoints (offset from geometry)
    const d1x = el.x1 + nx * offset, d1y = el.y1 + ny * offset;
    const d2x = el.x2 + nx * offset, d2y = el.y2 + ny * offset;

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.setLineDash([]);
    ctx.lineWidth = el.strokeWidth || 1;

    // Extension lines: start with a gap, overshoot past dim line
    ctx.beginPath();
    ctx.moveTo(el.x1 + nx * extGap, el.y1 + ny * extGap);
    ctx.lineTo(el.x1 + nx * (offset + extOver), el.y1 + ny * (offset + extOver));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(el.x2 + nx * extGap, el.y2 + ny * extGap);
    ctx.lineTo(el.x2 + nx * (offset + extOver), el.y2 + ny * (offset + extOver));
    ctx.stroke();

    // Dimension line
    ctx.beginPath();
    ctx.moveTo(d1x, d1y);
    ctx.lineTo(d2x, d2y);
    ctx.stroke();

    // Filled arrow at d1 (pointing toward d2)
    ctx.beginPath();
    ctx.moveTo(d1x, d1y);
    ctx.lineTo(d1x + ux * arrowLen + nx * arrowW, d1y + uy * arrowLen + ny * arrowW);
    ctx.lineTo(d1x + ux * arrowLen - nx * arrowW, d1y + uy * arrowLen - ny * arrowW);
    ctx.closePath();
    ctx.fill();

    // Filled arrow at d2 (pointing toward d1)
    ctx.beginPath();
    ctx.moveTo(d2x, d2y);
    ctx.lineTo(d2x - ux * arrowLen + nx * arrowW, d2y - uy * arrowLen + ny * arrowW);
    ctx.lineTo(d2x - ux * arrowLen - nx * arrowW, d2y - uy * arrowLen - ny * arrowW);
    ctx.closePath();
    ctx.fill();

    // Text centered on dimension line, rotated to align, never upside-down
    const midX = (d1x + d2x) / 2, midY = (d1y + d2y) / 2;
    const label = typeof el.label === "string" ? el.label : `${Math.round(len)}`;
    let textAngle = Math.atan2(dy, dx);
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(textAngle);
    ctx.fillStyle = strokeColor;
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, 0, -3);
    ctx.restore();
  }

  private drawPreview(
    ctx: CanvasRenderingContext2D,
    tool: ToolType,
    isDrawing: boolean,
    startPoint: Point | null,
    dragPoint: Point | null,
    currentPolylineId: string | null,
    elements: DrawingElement[],
    layerMap: Record<string, Layer>,
    isDarkMode: boolean
  ) {
    if (!isDrawing || !startPoint || !dragPoint) return;
    
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    if (tool === "line" || tool === "wall") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(dragPoint.x, dragPoint.y);
      ctx.stroke();
    } else if (tool === "polyline" && currentPolylineId) {
      const el = elements.find(e => e.id === currentPolylineId);
      if (el && el.points && el.points.length > 0) {
        const lastPt = el.points[el.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPt.x, lastPt.y);
        ctx.lineTo(dragPoint.x, dragPoint.y);
        ctx.stroke();
      }
    } else if (tool === "rectangle") {
      const w = dragPoint.x - startPoint.x;
      const h = dragPoint.y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, w, h);
    } else if (tool === "circle") {
      const r = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === "dimension") {
      const dx = dragPoint.x - startPoint.x;
      const dy = dragPoint.y - startPoint.y;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const off = 30;
        const d1x = startPoint.x + nx * off, d1y = startPoint.y + ny * off;
        const d2x = dragPoint.x + nx * off, d2y = dragPoint.y + ny * off;
        // Extension lines
        ctx.beginPath(); ctx.moveTo(startPoint.x, startPoint.y); ctx.lineTo(d1x + nx * 4, d1y + ny * 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dragPoint.x, dragPoint.y); ctx.lineTo(d2x + nx * 4, d2y + ny * 4); ctx.stroke();
        // Dim line
        ctx.beginPath(); ctx.moveTo(d1x, d1y); ctx.lineTo(d2x, d2y); ctx.stroke();
        // Label
        ctx.fillStyle = "#3b82f6";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${Math.round(len)}`, (d1x + d2x) / 2, (d1y + d2y) / 2 - 3);
      }
    } else if (tool === "leader") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(dragPoint.x, dragPoint.y);
      ctx.stroke();
      const angle = Math.atan2(dragPoint.y - startPoint.y, dragPoint.x - startPoint.x);
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
      ctx.lineTo(dragPoint.x, startPoint.y);
      ctx.lineTo(dragPoint.x, dragPoint.y);
      ctx.lineTo(startPoint.x, dragPoint.y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.fill();
    } else if (tool === "stair") {
      const steps = Math.max(3, Math.round(Math.abs(dragPoint.y - startPoint.y) / 20));
      const dx = dragPoint.x - startPoint.x;
      const dy = dragPoint.y - startPoint.y;
      const stepH = dy / steps;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = i % 2 === 0 ? startPoint.x : startPoint.x + dx;
        const xNext = i % 2 === 0 ? startPoint.x + dx : startPoint.x;
        const y = startPoint.y + i * stepH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        if (i < steps) ctx.lineTo(xNext, y);
      }
      ctx.stroke();
    } else if (tool === "arc") {
      const r = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
      const angle = Math.atan2(dragPoint.y - startPoint.y, dragPoint.x - startPoint.x);
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, r, angle - Math.PI / 2, angle + Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(dragPoint.x, dragPoint.y);
      ctx.stroke();
    } else if (tool === "polygon") {
      const r = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * 2 * Math.PI - Math.PI / 2;
        const px = startPoint.x + r * Math.cos(a);
        const py = startPoint.y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (tool === "ellipse") {
      const rx = Math.max(Math.abs(dragPoint.x - startPoint.x) / 2, 1);
      const ry = Math.max(Math.abs(dragPoint.y - startPoint.y) / 2, 1);
      const cx = (startPoint.x + dragPoint.x) / 2;
      const cy = (startPoint.y + dragPoint.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawCursors(
    ctx: CanvasRenderingContext2D,
    collabCursors: Record<string, {x?: number, y?: number}>,
    collabUsers: any[],
    zoom: number,
    panOffset: Point
  ) {
    Object.entries(collabCursors).forEach(([uid, pos]) => {
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
        const collabUser = collabUsers.find((u) => u.id === uid);
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
