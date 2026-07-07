import { memo, useState } from "react";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";
import { BlockElementMesh, parseColor } from "./BlockElementMesh";
import { LineMesh3D, PolylineMesh3D, ArcMesh3D, RectOutline3D, CircleOutline3D } from "./LineMeshes";

export const FlatElementMesh = memo(function FlatElementMesh({
  el,
  blockDefs,
  activeTool,
  onElementClick
}: {
  el: DrawingElement;
  blockDefs?: any;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const interactiveTools = ["eraser", "select", "paint3d"];

  const handlePointerOver = (e: any) => {
    if (activeTool && interactiveTools.includes(activeTool)) {
      e.stopPropagation();
      setHovered(true);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
  };

  const handleClick = (e: any) => {
    if (activeTool && interactiveTools.includes(activeTool)) {
      e.stopPropagation();
      onElementClick?.(el.id);
    }
  };

  if (el.type === "block" && el.blockId && blockDefs) {
    const def = blockDefs[el.blockId];
    if (!def) return null;
    // Matches the 2D renderer's translate→scale→rotate chain even though Three
    // composes position/rotation/scale as T·R·S: the in-plane scale is uniform
    // (same el.scale on X and Z), so scale and the Y-rotation commute. Canvas
    // +θ with y-down equals −θ about Y here with 2D y mapped to 3D z.
    return (
      <group
        position={[el.x || 0, 0, el.y || 0]}
        scale={[el.scale || 1, 1, el.scale || 1]}
        rotation={[0, -(el.rotation || 0) * Math.PI / 180, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        {def.elements.map((be: any) => (
           <BlockElementMesh key={be.id} el={be} blockType={el.blockId!} hovered={hovered} activeTool={activeTool} />
        ))}
      </group>
    );
  }

  const color = typeof el.strokeColor === "string" ? el.strokeColor : "#1f2937";
  const { color: parsedStrokeColor } = parseColor(color);
  const fillColor = typeof el.fillColor === "string" && el.fillColor !== "transparent" ? el.fillColor : null;

  if (isRectangle(el)) {
    // Rotation in 2D pivots around the shape center; apply same rotation around Y axis in 3D
    const rotY = -(el.rotation || 0) * Math.PI / 180;
    const cx = el.x + el.width / 2;
    const cz = el.y + el.height / 2;
    const depth = typeof (el as Record<string, unknown>).pushPullDepth === "number"
      ? ((el as Record<string, unknown>).pushPullDepth as number)
      : 0;
    if (depth > 0.5) {
      return (
        <mesh
          position={[cx, depth / 2, cz]}
          rotation={[0, rotY, 0]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[el.width, depth, el.height]} />
          <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || "#cbd5e1")} roughness={0.8} />
        </mesh>
      );
    }
    const matColor = hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || color);
    const { color: parsedColor, opacity: colorOpacity } = parseColor(matColor);

    if (fillColor) {
      // Filled rectangle — solid flat slab with rotation
      return (
        <mesh
          position={[cx, 0.15, cz]}
          rotation={[0, rotY, 0]}
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[el.width, 0.3, el.height]} />
          <meshStandardMaterial color={parsedColor} transparent={colorOpacity < 1} opacity={colorOpacity} />
        </mesh>
      );
    }

    // Unfilled rectangle — render as clean outline edges (no internal diagonals)
    return (
      <RectOutline3D
        cx={cx} cz={cz}
        w={el.width} d={el.height}
        rotY={rotY}
        color={parsedColor}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
    );
  }

  if (el.type === "circle" && typeof el.cx === "number" && typeof el.cy === "number" && typeof el.radius === "number") {
    const cDepth = typeof (el as Record<string, unknown>).pushPullDepth === "number"
      ? ((el as Record<string, unknown>).pushPullDepth as number)
      : 0;
    if (cDepth > 0.5) {
      return (
        <mesh
          position={[el.cx, cDepth / 2, el.cy]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[el.radius, el.radius, cDepth, 32]} />
          <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || "#cbd5e1")} roughness={0.8} />
        </mesh>
      );
    }
    const matColor = hovered && activeTool === "eraser" ? "#ef4444" : (fillColor || color);
    const { color: parsedColor, opacity: colorOpacity } = parseColor(matColor);
    if (fillColor) {
      return (
        <mesh
          position={[el.cx, 0.2, el.cy]}
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[el.radius, el.radius, 0.3, 32]} />
          <meshStandardMaterial color={parsedColor} transparent={colorOpacity < 1} opacity={colorOpacity} />
        </mesh>
      );
    }
    // Unfilled circle — show as ring outline on the ground plane
    return (
      <CircleOutline3D
        cx={el.cx} cy={el.cy} r={el.radius}
        color={parsedColor}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      />
    );
  }

  if (el.type === "line") {
    return <LineMesh3D el={el} color={parsedStrokeColor} hovered={hovered} activeTool={activeTool} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick} />;
  }

  if (el.type === "polyline" || el.type === "spline") {
    return <PolylineMesh3D el={el} color={parsedStrokeColor} hovered={hovered} activeTool={activeTool} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick} />;
  }

  if (el.type === "arc") {
    return <ArcMesh3D el={el} color={parsedStrokeColor} hovered={hovered} activeTool={activeTool} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick} />;
  }

  return null;
});
