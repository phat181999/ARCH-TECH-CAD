import { useState } from "react";
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";
import { WALL_THICKNESS } from "../geometry/wallGeometry";

const SELECTION_COLOR = "#3b82f6";

export function DoorMesh({
  door,
  activeTool,
  onElementClick,
  selected = false,
}: {
  door: DrawingElement;
  activeTool?: string;
  onElementClick?: (id: string) => void;
  selected?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  // Select must also reach doors so the properties panel + gizmo work on
  // them — mirrors FlatElementMesh's interactiveTools approach. Hover
  // highlight stays eraser-only (red = "will delete"); select's feedback is
  // the `selected` blue tint/outline below.
  const clickable = activeTool === "eraser" || activeTool === "select";

  if (door.type === "arc" && typeof door.cx === "number" && typeof door.cy === "number" && typeof door.radius === "number") {
    return (
      <mesh
        position={[door.cx + door.radius / 2, 10, door.cy - door.radius / 2]}
        castShadow
        onPointerOver={(e) => {
          if (activeTool === "eraser") {
            e.stopPropagation();
            setHovered(true);
          }
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          if (clickable) {
            e.stopPropagation();
            onElementClick?.(door.id);
          }
        }}
      >
        <boxGeometry args={[Math.max(door.radius, 4), 20, 2]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : selected ? SELECTION_COLOR : "#89c2d9"} transparent opacity={selected ? 0.55 : 0.35} />
        {selected && <Edges color={SELECTION_COLOR} threshold={20} linewidth={2} />}
      </mesh>
    );
  }

  if (!isRectangle(door)) {
    return null;
  }

  return (
    <mesh
      position={[door.x + door.width / 2, 10, door.y + WALL_THICKNESS / 2]}
      castShadow
      onPointerOver={(e) => {
        if (activeTool === "eraser") {
          e.stopPropagation();
          setHovered(true);
        }
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          onElementClick?.(door.id);
        }
      }}
    >
      <boxGeometry args={[door.width, 20, Math.max(2, door.height)]} />
      <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : selected ? SELECTION_COLOR : "#89c2d9"} transparent opacity={selected ? 0.55 : 0.35} />
      {selected && <Edges color={SELECTION_COLOR} threshold={20} linewidth={2} />}
    </mesh>
  );
}
