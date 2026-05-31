import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { ShapeWithDepth } from "../types";

export function PushPullDragController({
  activeTool,
  shapes,
  onDepthChange,
}: {
  activeTool: string;
  shapes: ShapeWithDepth[];
  onDepthChange: (id: string, depth: number) => void;
}) {
  const { gl } = useThree();
  const dragRef = useRef<{ id: string; startY: number; startDepth: number } | null>(null);

  const activeShape = shapes.length > 0 ? shapes[shapes.length - 1] : null;

  useEffect(() => {
    if (activeTool !== "pushpull" || !activeShape) return;

    const handleDown = (e: PointerEvent) => {
      dragRef.current = { id: activeShape.id, startY: e.clientY, startDepth: activeShape.depth };
    };
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      onDepthChange(dragRef.current.id, dragRef.current.startDepth + delta * 1.5);
    };
    const handleUp = () => { dragRef.current = null; };

    gl.domElement.addEventListener("pointerdown", handleDown);
    gl.domElement.addEventListener("pointermove", handleMove);
    gl.domElement.addEventListener("pointerup", handleUp);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handleDown);
      gl.domElement.removeEventListener("pointermove", handleMove);
      gl.domElement.removeEventListener("pointerup", handleUp);
    };
  }, [activeTool, activeShape, gl, onDepthChange]);

  return null;
}
