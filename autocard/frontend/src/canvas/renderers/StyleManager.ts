import type { Layer } from "../../types";

export class StyleManager {
  applyLayerStyle(ctx: CanvasRenderingContext2D, layerId: string, layerMap: Record<string, Layer>, isDarkMode: boolean): void {
    const layer = layerMap[layerId];
    this.applyStyle(ctx, layer?.style || {}, isDarkMode);
  }

  applyStyle(ctx: CanvasRenderingContext2D, style: any, isDarkMode: boolean): void {
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
}
