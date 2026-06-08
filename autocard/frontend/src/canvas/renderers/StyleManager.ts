import type { Layer } from "../../types";

export class StyleManager {
  applyLayerStyle(ctx: CanvasRenderingContext2D, layerId: string, layerMap: Record<string, Layer>, isDarkMode: boolean, zoom: number = 1): void {
    const layer = layerMap[layerId];
    this.applyStyle(ctx, layer?.style || {}, isDarkMode, zoom);
  }

  applyStyle(ctx: CanvasRenderingContext2D, style: any, isDarkMode: boolean, zoom: number = 1): void {
    let strokeColor = style.strokeColor || "#1f2937";
    if (isDarkMode && (strokeColor === "#1f2937" || strokeColor === "#111827" || strokeColor === "#000000" || strokeColor === "#0F172A")) {
      strokeColor = "#F8FAFC"; // White lines on dark background
    }

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = style.fillColor || "transparent";
    // Divide by zoom so lineWidth stays in screen-pixel space regardless of zoom level.
    // Without this, at very small zoom values (e.g. 0.0003 for large DXF files) lines
    // render at sub-pixel width and become invisible.
    ctx.lineWidth = (style.lineWidth || style.strokeWidth || 2) / zoom;
    if (style.lineType === "dashed") {
      ctx.setLineDash([8, 4]);
    } else if (style.lineType === "dotted") {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }
  }
}
