import type { DrawingElement, Layer, Point } from "../../types";
import { useDrawingStore } from "../../stores/drawingStore";
import { computeGrips } from "../grips";
import { StyleManager } from "./StyleManager";

export class ElementRenderer {
  constructor(private style: StyleManager) {}

  drawElement(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    isSelected: boolean,
    layerMap: Record<string, Layer>,
    blockDefs: Record<string, any>,
    isDarkMode: boolean,
    isHovered: boolean = false,
    zoom: number = 1
  ): void {
    ctx.save();

    const layer = layerMap[el.layerId];
    const layerStyle = layer?.style || {};
    const strokeColor = el.strokeColor || layerStyle.strokeColor || "#1f2937";
    const fillColor = el.fillColor || layerStyle.fillColor || "transparent";
    const lineWidth = el.strokeWidth || el.lineWidth || layerStyle.lineWidth || 2;
    const lineType = el.lineType || layerStyle.lineType || "solid";

    this.style.applyStyle(ctx, { strokeColor, fillColor, lineWidth, lineType }, isDarkMode, zoom);

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
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4, 4]);
    }

    if (isHovered && !isSelected) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = Math.max(lineWidth + 0.5, 2) / zoom;
      ctx.setLineDash([]);
    }

    if (el.type === "rectangle") {
      ctx.save();
      ctx.translate(el.x!, el.y!);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.strokeRect(0, 0, el.width!, el.height!);
      if (fillColor && fillColor !== "transparent") {
        ctx.fillRect(0, 0, el.width!, el.height!);
      }
      ctx.restore();
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
      const rot = ((el.rotation || 0) * Math.PI) / 180;
      ctx.beginPath();
      ctx.ellipse(el.cx!, el.cy!, Math.max(rx, 0.5), Math.max(ry, 0.5), rot, 0, Math.PI * 2);
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
      ctx.save();
      ctx.translate(el.x!, el.y!);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = finalStrokeColor;
      ctx.fillText(el.text || "", 0, 0);
      ctx.restore();
    } else if (el.type === "leader") {
      this.drawLeader(ctx, el, finalStrokeColor);
    } else if (el.type === "hatch") {
      this.drawHatch(ctx, el, finalStrokeColor, fillColor, zoom);
    } else if (el.type === "block") {
      this.drawBlock(ctx, el, blockDefs, isDarkMode, zoom);
    } else if (el.type === "dimension") {
      this.drawDimension(ctx, el, finalStrokeColor, zoom);
    } else if (el.type === "spline") {
      const pts = el.points || [];
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          // Catmull-Rom to bezier
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        }
        ctx.stroke();
      }
    } else if (el.type === "mtext") {
      ctx.save();
      ctx.translate(el.x!, el.y!);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = finalStrokeColor;
      const lines = (el.text || "").split("\n");
      const lineHeight = (el.fontSize || 16) * 1.4;
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, i * lineHeight);
      });
      ctx.restore();
    } else if (el.type === "dim-linear") {
      // Like dimension but snapped to horizontal or vertical
      if (el.x1 !== undefined && el.x2 !== undefined) {
        const axis = (el as any).dimAxis || "h";
        let px1 = el.x1!, py1 = el.y1!, px2 = el.x2!, py2 = el.y2!;
        // Project points onto axis
        if (axis === "h") {
          py1 = Math.min(el.y1!, el.y2!);
          py2 = py1;
        } else {
          px1 = Math.min(el.x1!, el.x2!);
          px2 = px1;
        }
        // Reuse dimension drawing logic with projected points
        const tmpEl = { ...el, x1: px1, y1: py1, x2: px2, y2: py2 };
        this.drawDimension(ctx, tmpEl as any, finalStrokeColor);
      }
    } else if (el.type === "dim-angular") {
      const v = (el as any).vertex || { x: el.x || 0, y: el.y || 0 };
      const p1 = (el as any).point1 || { x: v.x + 50, y: v.y };
      const p2 = (el as any).point2 || { x: v.x, y: v.y + 50 };
      const r = (el as any).arcRadius || 50;
      const a1 = Math.atan2(p1.y - v.y, p1.x - v.x);
      const a2 = Math.atan2(p2.y - v.y, p2.x - v.x);
      ctx.strokeStyle = finalStrokeColor;
      ctx.fillStyle = finalStrokeColor;
      ctx.setLineDash([]);
      ctx.lineWidth = (el.strokeWidth || 1) / zoom;
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      // Arc
      ctx.beginPath();
      ctx.arc(v.x, v.y, r, a1, a2, a2 < a1);
      ctx.stroke();
      // Angle label
      let ang = ((a2 - a1) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const midA = a1 + (a2 - a1) / 2;
      ctx.save();
      ctx.translate(v.x + (r + 12) * Math.cos(midA), v.y + (r + 12) * Math.sin(midA));
      ctx.fillStyle = finalStrokeColor;
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ang.toFixed(1) + "°", 0, 0);
      ctx.restore();
    } else if (el.type === "dim-radius") {
      this.drawDimRadius(ctx, el, finalStrokeColor, zoom);
    } else if (el.type === "dim-diameter") {
      this.drawDimDiameter(ctx, el, finalStrokeColor, zoom);
    } else if (el.type === "mark") {
      const markR = 14;
      ctx.strokeStyle = finalStrokeColor;
      ctx.fillStyle = "transparent";
      ctx.lineWidth = (el.strokeWidth || 1.5) / zoom;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(el.x!, el.y!, markR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = finalStrokeColor;
      ctx.font = `bold ${el.fontSize || 11}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String((el as any).markNumber ?? "#"), el.x!, el.y!);
    }

    // --- archType-specific rendering overlaid on top of geometry rendering ---
    this.drawArchTypeOverlay(ctx, el, zoom, isDarkMode);

    ctx.restore();
  }

  /**
   * Draws a rounded rectangle path without relying on CanvasRenderingContext2D.roundRect
   * (which requires ES2023 / a newer lib target).
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  private drawArchTypeOverlay(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    const arch = el.archType;

    ctx.save();

    if (arch === "floor") {
      this.drawFloorHatch(ctx, el, zoom, isDarkMode);
    } else if (arch === "pipe") {
      this.drawPipeOverlay(ctx, el, zoom);
    } else if (arch === "stair") {
      this.drawStairPattern(ctx, el, zoom, isDarkMode);
    } else if (
      arch === "foundation-strip" ||
      arch === "foundation-spread" ||
      arch === "foundation-raft" ||
      arch === "foundation-pile" ||
      arch === "grade-beam"
    ) {
      this.drawFoundationOverlay(ctx, el, zoom, isDarkMode);
    }

    // --- 3D property badges ---

    // Wall height override badge (line elements with wallHeightOverride)
    if ((el as Record<string, unknown>).wallHeightOverride !== undefined && (el as Record<string, unknown>).wallHeightOverride !== null) {
      this.drawWallHeightBadge(ctx, el, zoom, isDarkMode);
    }

    // Push-pull depth badge (any element with pushPullDepth)
    if ((el as Record<string, unknown>).pushPullDepth !== undefined) {
      this.drawPushPullBadge(ctx, el, zoom, isDarkMode);
    }

    // "Edited in 3D" badge (top-right corner indicator)
    if ((el as Record<string, unknown>).editedIn3D === true) {
      this.drawEditedIn3DBadge(ctx, el, zoom, isDarkMode);
    }

    ctx.restore();
  }

  private drawWallHeightBadge(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    // Only for line elements (walls)
    if (el.type !== "line" || el.x1 === undefined) return;
    const mx = ((el.x1 ?? 0) + (el.x2 ?? 0)) / 2;
    const my = ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2;
    const heightVal = (el as Record<string, unknown>).wallHeightOverride as number;
    const label = `H: ${heightVal}cm`;
    const fontSize = Math.round(9 / zoom);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const pad = 3 / zoom;
    // Background pill
    ctx.fillStyle = isDarkMode ? "rgba(37,99,235,0.85)" : "rgba(59,130,246,0.9)";
    const bx = mx - tw / 2 - pad;
    const by = my - fontSize - pad * 2 - 4 / zoom;
    this.roundRect(ctx, bx, by, tw + pad * 2, fontSize + pad * 2, 3 / zoom);
    ctx.fill();
    // Text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(label, mx, my - 4 / zoom - pad);
  }

  private drawPushPullBadge(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    let cx = 0, cy = 0;
    if (el.points && el.points.length > 0) {
      for (const p of el.points) { cx += p.x; cy += p.y; }
      cx /= el.points.length; cy /= el.points.length;
    } else if (el.x !== undefined) {
      cx = el.x + (el.width ?? 0) / 2;
      cy = (el.y ?? 0) + (el.height ?? 0) / 2;
    } else return;

    const depth = Math.round((el as Record<string, unknown>).pushPullDepth as number);
    const label = `+${depth}cm`;
    const fontSize = Math.round(9 / zoom);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const pad = 3 / zoom;
    ctx.fillStyle = isDarkMode ? "rgba(16,185,129,0.85)" : "rgba(5,150,105,0.9)";
    const bx = cx - tw / 2 - pad;
    const by = cy - fontSize / 2 - pad;
    this.roundRect(ctx, bx, by, tw + pad * 2, fontSize + pad * 2, 3 / zoom);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy + fontSize / 2 - pad * 0.5);
  }

  private drawEditedIn3DBadge(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    let bx = 0, by = 0;
    if (el.x !== undefined) {
      bx = el.x + (el.width ?? 0);
      by = el.y ?? 0;
    } else if (el.x1 !== undefined) {
      bx = Math.max(el.x1 ?? 0, el.x2 ?? 0);
      by = Math.min(el.y1 ?? 0, el.y2 ?? 0);
    } else if (el.points && el.points.length > 0) {
      bx = Math.max(...el.points.map(p => p.x));
      by = Math.min(...el.points.map(p => p.y));
    } else return;

    const label = "3D";
    const fontSize = Math.round(7 / zoom);
    ctx.font = `bold ${fontSize}px monospace`;
    const tw = ctx.measureText(label).width;
    const pad = 2 / zoom;
    ctx.fillStyle = isDarkMode ? "rgba(139,92,246,0.9)" : "rgba(124,58,237,0.9)";
    this.roundRect(ctx, bx - tw - pad * 2, by, tw + pad * 2, fontSize + pad * 2, 2 / zoom);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(label, bx - tw / 2 - pad, by + fontSize + pad * 0.5);
  }

  private drawFloorHatch(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    const pts = el.points;
    if (!pts || pts.length < 3) return;

    const finish = (el.floorFinish as string | undefined) ?? "concrete";

    // Clip to polygon
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();

    // Compute bounding box
    let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }

    const hatchColor = isDarkMode ? "rgba(148,163,184,0.25)" : "rgba(100,116,139,0.20)";
    ctx.strokeStyle = hatchColor;
    ctx.lineWidth   = 0.8 / zoom;
    ctx.setLineDash([]);

    const step = 20 / zoom;

    if (finish === "tile") {
      // Grid pattern
      for (let x = minX; x <= maxX; x += step) { ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke(); }
      for (let y = minY; y <= maxY; y += step) { ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke(); }
    } else if (finish === "wood") {
      // Diagonal lines at 45°
      const diag = maxX - minX + maxY - minY;
      for (let d = -diag; d <= diag; d += step) {
        ctx.beginPath(); ctx.moveTo(minX + d, minY); ctx.lineTo(minX + d + (maxY - minY), maxY); ctx.stroke();
      }
    } else if (finish === "screed") {
      // Horizontal lines
      for (let y = minY; y <= maxY; y += step) { ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke(); }
    } else {
      // Concrete: diagonal cross hatch
      const diag = maxX - minX + maxY - minY;
      for (let d = -diag; d <= diag; d += step * 1.5) {
        ctx.beginPath(); ctx.moveTo(minX + d, minY); ctx.lineTo(minX + d + (maxY - minY), maxY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(maxX - d, minY); ctx.lineTo(maxX - d - (maxY - minY), maxY); ctx.stroke();
      }
    }
  }

  private drawPipeOverlay(ctx: CanvasRenderingContext2D, el: DrawingElement, zoom: number): void {
    const system  = (el.pipeSystem as string | undefined) ?? "water";
    const colorMap: Record<string, string> = {
      water: "#0284c7", hvac: "#06b6d4", drain: "#ea580c", electric: "#ca8a04", gas: "#dc2626",
    };
    const color  = colorMap[system] ?? colorMap.water;
    const diam   = (el.pipeDiameter as number | undefined) ?? 50;
    const lw     = Math.max(1.5, diam * 0.04) / zoom;

    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.setLineDash([8 / zoom, 4 / zoom]);

    ctx.beginPath();
    ctx.moveTo(el.x1!, el.y1!);
    ctx.lineTo(el.x2!, el.y2!);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diameter label at midpoint
    const mx = ((el.x1 ?? 0) + (el.x2 ?? 0)) / 2;
    const my = ((el.y1 ?? 0) + (el.y2 ?? 0)) / 2;
    ctx.font      = `bold ${Math.round(10 / zoom)}px monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(`Ø${diam}`, mx, my - 6 / zoom);
  }

  private drawStairPattern(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    if (el.x === undefined || el.y === undefined || !el.width || !el.height) return;
    const x = el.x, y = el.y, w = el.width, h = el.height;
    const steps = Math.max(1, Math.round(((el.totalRise as number | undefined) ?? 270) / ((el.stairRise as number | undefined) ?? 18)));
    const stepH = h / steps;

    ctx.strokeStyle = isDarkMode ? "#94a3b8" : "#475569";
    ctx.lineWidth   = 1 / zoom;
    ctx.setLineDash([]);

    // Draw tread lines
    for (let i = 1; i < steps; i++) {
      const sy = y + stepH * i;
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke();
    }

    // Direction arrow
    const dir = (el.flightDirection as string | undefined) ?? "up";
    const arrowX = x + w / 2;
    const arrowY = dir === "up" ? y + 10 / zoom : y + h - 10 / zoom;
    const arrowDir = dir === "up" ? -1 : 1;
    ctx.strokeStyle = isDarkMode ? "#60a5fa" : "#2563eb";
    ctx.lineWidth   = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX, arrowY + arrowDir * h * 0.6);
    ctx.stroke();
    // Arrowhead
    const tip = arrowY + arrowDir * h * 0.6;
    ctx.beginPath();
    ctx.moveTo(arrowX - 5 / zoom, tip - arrowDir * 8 / zoom);
    ctx.lineTo(arrowX, tip);
    ctx.lineTo(arrowX + 5 / zoom, tip - arrowDir * 8 / zoom);
    ctx.stroke();

    // Label
    ctx.font      = `bold ${Math.round(9 / zoom)}px sans-serif`;
    ctx.fillStyle = isDarkMode ? "#94a3b8" : "#475569";
    ctx.textAlign = "center";
    ctx.fillText(dir === "up" ? "UP" : "DN", arrowX, y + h / 2);
  }

  private drawFoundationOverlay(
    ctx: CanvasRenderingContext2D,
    el: DrawingElement,
    zoom: number,
    isDarkMode: boolean,
  ): void {
    const color = isDarkMode ? "rgba(217,119,6,0.6)" : "rgba(180,83,9,0.7)";
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);

    if (el.archType === "foundation-strip" || el.archType === "grade-beam") {
      // Double line wider than wall
      const fw = (el.footingWidth as number | undefined) ?? 60;
      const dx = (el.x2 ?? 0) - (el.x1 ?? 0);
      const dy = (el.y2 ?? 0) - (el.y1 ?? 0);
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const nx = -dy / len * fw / 2;
      const ny =  dx / len * fw / 2;
      ctx.beginPath();
      ctx.moveTo((el.x1 ?? 0) + nx, (el.y1 ?? 0) + ny);
      ctx.lineTo((el.x2 ?? 0) + nx, (el.y2 ?? 0) + ny);
      ctx.moveTo((el.x1 ?? 0) - nx, (el.y1 ?? 0) - ny);
      ctx.lineTo((el.x2 ?? 0) - nx, (el.y2 ?? 0) - ny);
      ctx.stroke();
    } else if (el.archType === "foundation-spread") {
      // Rectangle with X diagonal
      if (el.x === undefined || !el.width || !el.height) return;
      ctx.strokeRect(el.x, el.y!, el.width, el.height);
      ctx.beginPath();
      ctx.moveTo(el.x, el.y!); ctx.lineTo(el.x + el.width, el.y! + el.height);
      ctx.moveTo(el.x + el.width, el.y!); ctx.lineTo(el.x, el.y! + el.height);
      ctx.stroke();
      // Column center
      const colW = (el.columnWidth as number | undefined) ?? 25;
      const fcx  = el.x + el.width / 2;
      const fcy  = el.y! + el.height / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.fillRect(fcx - colW / 2, fcy - colW / 2, colW, colW);
    } else if (el.archType === "foundation-pile") {
      // Circle with cross
      const r = el.radius ?? 25;
      const pcx = el.cx ?? el.x ?? 0;
      const pcy = el.cy ?? el.y ?? 0;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(pcx, pcy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pcx - r, pcy); ctx.lineTo(pcx + r, pcy);
      ctx.moveTo(pcx, pcy - r); ctx.lineTo(pcx, pcy + r);
      ctx.stroke();
    } else if (el.archType === "foundation-raft") {
      const pts = el.points;
      if (!pts || pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath(); ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  drawBlock(ctx: CanvasRenderingContext2D, el: DrawingElement, blockDefs: Record<string, any>, isDarkMode: boolean, zoom: number = 1): void {
    if (!el.blockId) return;
    const blockDef = blockDefs[el.blockId];
    if (blockDef) {
      ctx.save();
      ctx.translate(el.x || 0, el.y || 0);
      ctx.scale(el.scale || 1, el.scale || 1);
      ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
      blockDef.elements.forEach((be: any) => {
        ctx.save();
        this.style.applyStyle(
          ctx,
          {
            strokeColor: be.strokeColor || "#1f2937",
            fillColor: be.fillColor || "transparent",
            lineWidth: be.strokeWidth || 2,
            lineType: be.lineType || "solid",
          },
          isDarkMode,
          zoom
        );
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

  drawHatch(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, fillColor: string, zoom: number = 1): void {
    if (!el.points || el.points.length < 3) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach((p: Point) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
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
        ctx.lineWidth = 0.5 / zoom;
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
        ctx.lineWidth = 0.5 / zoom;
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
        ctx.lineWidth = 0.5 / zoom;
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
        ctx.lineWidth = 0.6 / zoom;
        const sp = 14;
        for (let x = minX - pad; x < maxX + pad; x += sp) {
          ctx.beginPath();
          ctx.moveTo(x, minY - pad);
          ctx.lineTo(x, maxY + pad);
          ctx.stroke();
        }
        for (let y = minY - pad; y < maxY + pad; y += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
        break;
      }
      case "brick": {
        // Brick masonry — staggered horizontal courses
        ctx.lineWidth = 0.7 / zoom;
        const bh = 10, bw = 22;
        let row = 0;
        for (let y = minY - pad; y < maxY + pad; y += bh, row++) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
          const xOff = (row % 2) * (bw / 2);
          for (let x = minX - pad - bw; x < maxX + pad; x += bw) {
            const jx = x + xOff;
            ctx.beginPath();
            ctx.moveTo(jx, y);
            ctx.lineTo(jx, y + bh);
            ctx.stroke();
          }
        }
        break;
      }
      case "concrete": {
        // Concrete: fine diagonal + aggregate dots
        ctx.lineWidth = 0.4 / zoom;
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
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case "insulation": {
        // Insulation batt: zigzag rows
        ctx.lineWidth = 1 / zoom;
        const rowH = 14, zigW = 10;
        for (let y = minY - pad; y < maxY + pad; y += rowH) {
          ctx.beginPath();
          let goUp = true;
          let first = true;
          for (let x = minX - pad; x < maxX + pad; x += zigW) {
            const yPos = goUp ? y : y + rowH - 2;
            if (first) {
              ctx.moveTo(x, yPos);
              first = false;
            } else ctx.lineTo(x, yPos);
            goUp = !goUp;
          }
          ctx.stroke();
        }
        break;
      }
      case "tile": {
        // Ceramic tile grid (coarser than "grid")
        ctx.lineWidth = 0.9 / zoom;
        const ts = 20;
        for (let x = minX - pad; x < maxX + pad; x += ts) {
          ctx.beginPath();
          ctx.moveTo(x, minY - pad);
          ctx.lineTo(x, maxY + pad);
          ctx.stroke();
        }
        for (let y = minY - pad; y < maxY + pad; y += ts) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
        break;
      }
      case "wood": {
        // Wood grain: horizontal lines with slight organic wave
        ctx.lineWidth = 0.5 / zoom;
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
        ctx.lineWidth = 0.35 / zoom;
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
        ctx.lineWidth = 0.6 / zoom;
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
        ctx.lineWidth = 0.6 / zoom;
        const sp = 8;
        for (let y = minY - pad; y < maxY + pad; y += sp) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
        ctx.fillStyle = strokeColor;
        for (let x = minX + 5; x < maxX; x += 12) {
          for (let y = minY + 5; y < maxY; y += 8) {
            if ((((x / 12) | 0) + ((y / 8) | 0)) % 2 === 0) {
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
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
            ctx.fill();
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
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      default: {
        // Horizontal lines fallback
        ctx.lineWidth = 0.5 / zoom;
        for (let y = minY - pad; y < maxY + pad; y += 6) {
          ctx.beginPath();
          ctx.moveTo(minX - pad, y);
          ctx.lineTo(maxX + pad, y);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  drawDimension(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, zoom: number = 1): void {
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
    ctx.lineWidth = (el.strokeWidth || 1) / zoom;

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
    const formatLength = useDrawingStore.getState().formatLength;
    const label = typeof el.label === "string" && el.label !== "" ? el.label : formatLength(len / 100);
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

  drawLeader(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string): void {
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

  drawDimRadius(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, zoom: number = 1): void {
    if (el.cx === undefined || el.cy === undefined || el.ex === undefined || el.ey === undefined || el.radius === undefined) return;
    const arrowLen = 10, arrowW = 3.5;
    ctx.strokeStyle = strokeColor; ctx.fillStyle = strokeColor;
    ctx.setLineDash([]); ctx.lineWidth = ((el.strokeWidth as number) || 1) / zoom;
    ctx.beginPath(); ctx.moveTo(el.cx as number, el.cy as number); ctx.lineTo(el.ex as number, el.ey as number); ctx.stroke();
    const edx = (el.ex as number) - (el.cx as number), edy = (el.ey as number) - (el.cy as number);
    const elen = Math.hypot(edx, edy) || 1;
    const ux = edx / elen, uy = edy / elen, nx = -uy, ny = ux;
    ctx.beginPath();
    ctx.moveTo(el.ex as number, el.ey as number);
    ctx.lineTo((el.ex as number) - ux * arrowLen + nx * arrowW, (el.ey as number) - uy * arrowLen + ny * arrowW);
    ctx.lineTo((el.ex as number) - ux * arrowLen - nx * arrowW, (el.ey as number) - uy * arrowLen - ny * arrowW);
    ctx.closePath(); ctx.fill();
    const fmt = useDrawingStore.getState().formatLength;
    const label = `R${fmt((el.radius as number) / 100)}`;
    const mx = ((el.cx as number) + (el.ex as number)) / 2, my = ((el.cy as number) + (el.ey as number)) / 2;
    ctx.save();
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(label, mx, my - 4);
    ctx.restore();
  }

  drawDimDiameter(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, zoom: number = 1): void {
    if (el.cx === undefined || el.cy === undefined || el.radius === undefined) return;
    const angle = (el.angle as number) ?? 0;
    const arrowLen = 10, arrowW = 3.5;
    const r = el.radius as number;
    const ex1 = (el.cx as number) + r * Math.cos(angle), ey1 = (el.cy as number) + r * Math.sin(angle);
    const ex2 = (el.cx as number) - r * Math.cos(angle), ey2 = (el.cy as number) - r * Math.sin(angle);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const nx = -uy, ny = ux;
    ctx.strokeStyle = strokeColor; ctx.fillStyle = strokeColor;
    ctx.setLineDash([]); ctx.lineWidth = ((el.strokeWidth as number) || 1) / zoom;
    ctx.beginPath(); ctx.moveTo(ex2, ey2); ctx.lineTo(ex1, ey1); ctx.stroke();
    for (const [px, py, sx] of [[ex1, ey1, 1], [ex2, ey2, -1]] as [number, number, number][]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - sx * ux * arrowLen + nx * arrowW, py - sx * uy * arrowLen + ny * arrowW);
      ctx.lineTo(px - sx * ux * arrowLen - nx * arrowW, py - sx * uy * arrowLen - ny * arrowW);
      ctx.closePath(); ctx.fill();
    }
    const fmt = useDrawingStore.getState().formatLength;
    const label = `⌀${fmt((r * 2) / 100)}`;
    ctx.save();
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(label, el.cx as number, (el.cy as number) - 6);
    ctx.restore();
  }

  drawGrips(ctx: CanvasRenderingContext2D, el: DrawingElement, zoom: number, _isDarkMode: boolean): void {
    const grips = computeGrips(el);
    const s = 5 / zoom;
    ctx.setLineDash([]);
    grips.forEach((pt) => {
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.8 / zoom;
      ctx.strokeRect(pt.x - s / 2, pt.y - s / 2, s, s);
    });
  }
}
