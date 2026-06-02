import { useMemo } from "react";
import type { BlockDef, DrawingElement, Point } from "../../types";

interface BlockPreviewProps {
  def: BlockDef;
  size?: number;
  padding?: number;
  isDark?: boolean;
}

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

function elementBounds(el: DrawingElement): Bounds | null {
  switch (el.type) {
    case "rectangle":
      if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined)
        return { minX: el.x, minY: el.y, maxX: el.x + el.width, maxY: el.y + el.height };
      break;
    case "circle":
      if (el.cx !== undefined && el.cy !== undefined && el.radius !== undefined)
        return { minX: el.cx - el.radius, minY: el.cy - el.radius, maxX: el.cx + el.radius, maxY: el.cy + el.radius };
      break;
    case "line":
      if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined)
        return {
          minX: Math.min(el.x1, el.x2), minY: Math.min(el.y1, el.y2),
          maxX: Math.max(el.x1, el.x2), maxY: Math.max(el.y1, el.y2),
        };
      break;
    case "polyline":
    case "spline":
      if (el.points && el.points.length > 0) {
        const xs = el.points.map((p: Point) => p.x);
        const ys = el.points.map((p: Point) => p.y);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      }
      break;
    case "text":
      if (el.x !== undefined && el.y !== undefined)
        return { minX: el.x, minY: el.y - 8, maxX: el.x + 20, maxY: el.y + 2 };
      break;
  }
  return null;
}

function renderElement(el: DrawingElement, defaultStroke: string, i: number): React.ReactNode {
  const sw = Math.max(el.strokeWidth ?? 1, 0.5);
  const stroke = el.strokeColor ?? defaultStroke;
  const fill = el.fillColor && el.fillColor !== "transparent" ? el.fillColor : "none";

  switch (el.type) {
    case "rectangle":
      if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined)
        return <rect key={i} x={el.x} y={el.y} width={el.width} height={el.height} stroke={stroke} strokeWidth={sw} fill={fill} />;
      break;
    case "circle":
      if (el.cx !== undefined && el.cy !== undefined && el.radius !== undefined)
        return <circle key={i} cx={el.cx} cy={el.cy} r={el.radius} stroke={stroke} strokeWidth={sw} fill={fill} />;
      break;
    case "line":
      if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined)
        return <line key={i} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={stroke} strokeWidth={sw} />;
      break;
    case "polyline":
    case "spline":
      if (el.points && el.points.length > 0) {
        const pts = el.points.map((p: Point) => `${p.x},${p.y}`).join(" ");
        return <polyline key={i} points={pts} stroke={stroke} strokeWidth={sw} fill={fill} />;
      }
      break;
    case "arc": {
      if (el.cx !== undefined && el.cy !== undefined && el.radius !== undefined) {
        const sa = ((Number(el.startAngle) || 0) * Math.PI) / 180;
        const ea = ((Number(el.endAngle) || 180) * Math.PI) / 180;
        const x1 = el.cx + el.radius * Math.cos(sa);
        const y1 = el.cy + el.radius * Math.sin(sa);
        const x2 = el.cx + el.radius * Math.cos(ea);
        const y2 = el.cy + el.radius * Math.sin(ea);
        const large = Math.abs((Number(el.endAngle) || 180) - (Number(el.startAngle) || 0)) > 180 ? 1 : 0;
        return (
          <path
            key={i}
            d={`M${x1},${y1} A${el.radius},${el.radius} 0 ${large},1 ${x2},${y2}`}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        );
      }
      break;
    }
    case "text":
      if (el.x !== undefined && el.y !== undefined)
        return (
          <text key={i} x={el.x} y={el.y} fontSize={el.fontSize ?? 4} fill={stroke} fontFamily="monospace">
            {el.text ?? ""}
          </text>
        );
      break;
  }
  return null;
}

export function BlockPreview({ def, size = 60, padding = 8, isDark = false }: BlockPreviewProps) {
  const { viewBox, stroke } = useMemo(() => {
    const defaultStroke = isDark ? "#94a3b8" : "#111827";
    const bounds = def.elements.map(elementBounds).filter(Boolean) as Bounds[];
    if (bounds.length === 0) {
      return { viewBox: "0 0 100 100", stroke: defaultStroke };
    }
    const minX = Math.min(...bounds.map((b) => b.minX)) - padding;
    const minY = Math.min(...bounds.map((b) => b.minY)) - padding;
    const maxX = Math.max(...bounds.map((b) => b.maxX)) + padding;
    const maxY = Math.max(...bounds.map((b) => b.maxY)) + padding;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    return { viewBox: `${minX} ${minY} ${w} ${h}`, stroke: defaultStroke };
  }, [def, padding, isDark]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "visible" }}
    >
      {def.elements.map((el, i) => renderElement(el as DrawingElement, stroke, i))}
    </svg>
  );
}
