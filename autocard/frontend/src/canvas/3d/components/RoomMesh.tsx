import { useState } from "react";
import { Edges } from "@react-three/drei";
import type { DrawingElement } from "../../../types";
import { isRectangle } from "../geometry/planClassification";

export function RoomMesh({
  room,
  activeTool,
  onElementClick
}: {
  room: DrawingElement;
  activeTool?: string;
  onElementClick?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (room.type === "text" && typeof room.x === "number" && typeof room.y === "number") {
    return (
      <mesh position={[room.x, 0.8, room.y]}>
        <boxGeometry args={[18, 0.5, 8]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.2} />
      </mesh>
    );
  }

  if (!isRectangle(room)) {
      return null;
  }

  const handlePointerOver = (e: any) => {
    if (activeTool === "eraser") {
      e.stopPropagation();
      setHovered(true);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
  };

  const handleClick = (e: any) => {
    if (activeTool === "eraser") {
      e.stopPropagation();
      onElementClick?.(room.id);
    }
  };

  return (
    <group>
      <mesh
        position={[room.x + room.width / 2, 0.3, room.y + room.height / 2]}
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[room.width, 0.2, room.height]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : "#dbe4ea"} transparent opacity={0.95} />
        <Edges color="#5a7a9a" threshold={12} />
      </mesh>
      <mesh
        position={[room.x + room.width / 2, 10, room.y + room.height / 2]}
        castShadow
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[room.width, 20, room.height]} />
        <meshStandardMaterial color={hovered && activeTool === "eraser" ? "#ef4444" : "#eef2f6"} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
