import type { DrawingElement, Point, ToolType } from "../types";

type BlockDropAction = {
  kind: "insert-block";
  blockId: string;
  point: Point;
};

type InsertElementDropAction = {
  kind: "insert-element";
  tool: ToolType;
  point: Point;
};

type UnsupportedDropAction = {
  kind: "unsupported";
};

export type CanvasDropAction = BlockDropAction | InsertElementDropAction | UnsupportedDropAction;

export function getDroppedToolType(raw: string | null | undefined): ToolType | null {
  const tool = raw?.trim();
  if (!tool) {
    return null;
  }

  const supportedTools: ToolType[] = [
    "wall",
    "door",
    "window",
    "line",
    "polyline",
    "rectangle",
    "circle",
    "arc",
    "polygon",
    "ellipse",
    "text",
    "dimension",
    "leader",
    "hatch",
    "room-label",
    "stair",
  ];

  return supportedTools.includes(tool as ToolType) ? (tool as ToolType) : null;
}

export function resolveCanvasDropAction(params: {
  blockId?: string | null;
  toolId?: string | null;
  point: Point;
}): CanvasDropAction {
  if (params.blockId) {
    return {
      kind: "insert-block",
      blockId: params.blockId,
      point: params.point,
    };
  }

  const tool = getDroppedToolType(params.toolId);
  if (tool) {
    return {
      kind: "insert-element",
      tool,
      point: params.point,
    };
  }

  return { kind: "unsupported" };
}

export function buildDroppedToolElement(params: {
  tool: ToolType;
  point: Point;
  layerId: string;
  id: string;
}): DrawingElement | null {
  const { tool, point, layerId, id } = params;

  switch (tool) {
    case "wall":
      return {
        id,
        type: "wall",
        start: { x: point.x - 80, y: point.y },
        end: { x: point.x + 80, y: point.y },
        thickness: 20,
        layerId: "A-WALL",
      };
    case "door":
      return {
        id,
        type: "block",
        blockId: "door",
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
        layerId: "A-DOOR",
      };
    case "window":
      return {
        id,
        type: "block",
        blockId: "window",
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
        layerId: "A-WIND",
      };
    case "line":
      return {
        id,
        type: "line",
        x1: point.x - 60,
        y1: point.y,
        x2: point.x + 60,
        y2: point.y,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId,
      };
    case "polyline":
      return {
        id,
        type: "polyline",
        points: [
          { x: point.x - 50, y: point.y + 25 },
          { x: point.x - 10, y: point.y - 25 },
          { x: point.x + 20, y: point.y + 10 },
          { x: point.x + 55, y: point.y - 20 },
        ],
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId,
      };
    case "rectangle":
      return {
        id,
        type: "rectangle",
        x: point.x - 60,
        y: point.y - 40,
        width: 120,
        height: 80,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        fillColor: "transparent",
        layerId,
      };
    case "circle":
      return {
        id,
        type: "circle",
        cx: point.x,
        cy: point.y,
        radius: 45,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        fillColor: "transparent",
        layerId,
      };
    case "arc":
      return {
        id,
        type: "arc",
        cx: point.x,
        cy: point.y,
        radius: 50,
        startAngle: 180,
        endAngle: 360,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId,
      };
    case "polygon": {
      const radius = 48;
      const points = Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
        return {
          x: point.x + radius * Math.cos(angle),
          y: point.y + radius * Math.sin(angle),
        };
      });
      return {
        id,
        type: "polyline",
        points,
        closed: true,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        fillColor: "transparent",
        layerId,
      };
    }
    case "ellipse":
      return {
        id,
        type: "ellipse",
        cx: point.x,
        cy: point.y,
        rx: 60,
        ry: 35,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        fillColor: "transparent",
        layerId,
      };
    case "text":
      return {
        id,
        type: "text",
        x: point.x,
        y: point.y,
        text: "Text",
        fontSize: 16,
        strokeColor: "#1f2937",
        layerId,
      };
    case "dimension":
      return {
        id,
        type: "dimension",
        x1: point.x - 60,
        y1: point.y,
        x2: point.x + 60,
        y2: point.y,
        strokeColor: "#3b82f6",
        strokeWidth: 1.5,
        layerId,
      };
    case "leader":
      return {
        id,
        type: "leader",
        points: [
          { x: point.x - 40, y: point.y + 24 },
          { x: point.x + 35, y: point.y - 24 },
        ],
        text: "Leader",
        strokeColor: "#1f2937",
        strokeWidth: 1.5,
        layerId,
      };
    case "hatch":
      return {
        id,
        type: "hatch",
        points: [
          { x: point.x - 50, y: point.y - 35 },
          { x: point.x + 50, y: point.y - 35 },
          { x: point.x + 50, y: point.y + 35 },
          { x: point.x - 50, y: point.y + 35 },
        ],
        pattern: "diagonal",
        strokeColor: "#64748b",
        fillColor: "rgba(148,163,184,0.15)",
        strokeWidth: 1,
        layerId,
      };
    case "room-label":
      return {
        id,
        type: "text",
        x: point.x,
        y: point.y,
        text: "Room",
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center",
        strokeColor: "#0F172A",
        layerId: "A-ROOM",
      };
    case "stair": {
      const points: Point[] = [];
      for (let index = 0; index < 5; index++) {
        const y = point.y - 40 + index * 20;
        if (index % 2 === 0) {
          points.push({ x: point.x - 45, y }, { x: point.x + 45, y });
        } else {
          points.push({ x: point.x + 45, y }, { x: point.x - 45, y });
        }
      }
      return {
        id,
        type: "polyline",
        points,
        strokeColor: "#111827",
        strokeWidth: 1.5,
        layerId: "A-WALL",
      };
    }
    default:
      return null;
  }
}
