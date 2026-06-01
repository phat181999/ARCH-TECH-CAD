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
    isHovered: boolean = false
  ): void {
    ctx.save();

    const layer = layerMap[el.layerId];
    const layerStyle = layer?.style || {};
    const strokeColor = el.strokeColor || layerStyle.strokeColor || "#1f2937";
    const fillColor = el.fillColor || layerStyle.fillColor || "transparent";
    const lineWidth = el.strokeWidth || el.lineWidth || layerStyle.lineWidth || 2;
    const lineType = el.lineType || layerStyle.lineType || "solid";

    this.style.applyStyle(ctx, { strokeColor, fillColor, lineWidth, lineType }, isDarkMode);

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

    if (isHovered && !isSelected) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = Math.max(lineWidth + 0.5, 2);
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
      this.drawHatch(ctx, el, finalStrokeColor, fillColor);
    } else if (el.type === "block") {
      this.drawBlock(ctx, el, blockDefs, isDarkMode);
    } else if (el.type === "dimension") {
      this.drawDimension(ctx, el, finalStrokeColor);
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
      ctx.lineWidth = el.strokeWidth || 1;
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
    } else if (el.type === "mark") {
      const markR = 14;
      ctx.strokeStyle = finalStrokeColor;
      ctx.fillStyle = "transparent";
      ctx.lineWidth = el.strokeWidth || 1.5;
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

    ctx.restore();
  }

  drawBlock(ctx: CanvasRenderingContext2D, el: DrawingElement, blockDefs: Record<string, any>, isDarkMode: boolean): void {
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
          isDarkMode
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

  drawHatch(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string, fillColor: string): void {
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
        ctx.lineWidth = 0.7;
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
            ctx.beginPath();
            ctx.arc(x + ox, y + oy, 1.5, 0, Math.PI * 2);
            ctx.fill();
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
        ctx.lineWidth = 0.9;
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
        ctx.lineWidth = 0.5;
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

  drawDimension(ctx: CanvasRenderingContext2D, el: DrawingElement, strokeColor: string): void {
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
