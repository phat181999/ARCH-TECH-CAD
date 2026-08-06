import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";

export function parseColor(colorStr: string): { color: string; opacity: number } {
  if (!colorStr) return { color: "#ffffff", opacity: 1 };
  if (colorStr.startsWith("rgba")) {
    const match = colorStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (match) {
      const [_, r, g, b, a] = match;
      return {
        color: `rgb(${r},${g},${b})`,
        opacity: parseFloat(a),
      };
    }
  }
  return { color: colorStr, opacity: 1 };
}

const SELECTION_COLOR = "#3b82f6";

export function BlockElementMesh({ el, blockType, hovered, activeTool, selected = false }: { el: DrawingElement, blockType: string, hovered?: boolean, activeTool?: string, selected?: boolean }) {
  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;
  const errColor = "#ef4444";
  const displayColor = hovered && activeTool === "eraser" ? errColor : selected ? SELECTION_COLOR : (fillColor || color);

  const { color: parsedColor, opacity: colorOpacity } = parseColor(displayColor);

  // Structural elements stand tall; furniture/landscape show as flat floor-plan footprints.
  const isStructural = blockType === "door" || blockType === "window" || blockType === "car";
  const boxHeight   = blockType === "door" ? 20 : blockType === "window" ? 10 : blockType === "car" ? 18 : 3;
  const discHeight  = 0.8; // flat disc height for circles (plants, trees, etc.)

  if (isRectangle(el)) {
    return (
      <mesh position={[el.x + el.width / 2, boxHeight / 2, el.y + el.height / 2]} receiveShadow castShadow>
        <boxGeometry args={[el.width, boxHeight, el.height]} />
        <meshStandardMaterial color={parsedColor} transparent opacity={selected ? 0.75 : (fillColor ? 0.95 : 0.65) * colorOpacity} wireframe={!fillColor && !isStructural && !selected} />
        <Edges color={selected ? SELECTION_COLOR : "#3a4a5a"} threshold={12} linewidth={selected ? 2 : 1} />
      </mesh>
    );
  }

  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    // Circles in blocks are plan-view symbols (plants, trees, stools) — render as flat discs.
    return (
      <mesh position={[el.cx, discHeight / 2, el.cy]} receiveShadow castShadow>
        <cylinderGeometry args={[el.radius, el.radius, discHeight, 48]} />
        <meshStandardMaterial color={parsedColor} transparent opacity={selected ? 0.75 : (fillColor ? 0.92 : 0.6) * colorOpacity} />
        <Edges color={selected ? SELECTION_COLOR : "#2a3a4a"} threshold={12} linewidth={selected ? 2 : 1} />
      </mesh>
    );
  }

  return null;
}
