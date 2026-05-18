import { useState, useEffect, useRef, useCallback } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { useCollaborationStore } from "../stores/collaborationStore";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import CommandLine from "../components/CommandLine";
import SnapToolbar from "../components/SnapToolbar";
import TextFormatBar from "../components/TextFormatBar";
import BlockLibrary from "../components/BlockLibrary";
import ThreeViewer from "../components/ThreeViewer";
import PaperSpace from "../components/PaperSpace";
import BIMPanel from "../components/BIMPanel";
import CloudStorage from "../components/CloudStorage";
import CadSidebar from "../components/CadSidebar";
import { Point, ToolType, DrawingElement } from "../types";
import { findNearestSnap, drawSnapIndicator, SnapResult } from "../canvas/snap";
import { elementsToDxf, dxfToElements } from "../canvas/dxf";
import { generateDrawingFromPrompt } from "../services/aiDrawingService";

const TOOLS = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "text", label: "Text", icon: "T" },
  { id: "dimension", label: "Dimension", icon: "📏" },
  { id: "leader", label: "Leader", icon: "➤" },
  { id: "hatch", label: "Hatch", icon: "▓" },
  { id: "pan", label: "Pan", icon: "✋" },
];

let idCounter = 0;
const genId = () => `el-${Date.now()}-${++idCounter}`;

// Apply line type (solid/dashed/dotted) to canvas context
function applyStyle(ctx: CanvasRenderingContext2D, el: any, resolvedStyle: any) {
  const style = resolvedStyle || el;
  ctx.strokeStyle = style.strokeColor || "#1f2937";
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

function getShapeAtPoint(elements: any[], x: number, y: number) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === "rectangle") {
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
        return el;
      }
    } else if (el.type === "circle") {
      const dx = x - el.cx;
      const dy = y - el.cy;
      if (dx * dx + dy * dy <= el.radius * el.radius) return el;
    } else if (el.type === "line") {
      const dist = pointToSegmentDist(x, y, el.x1, el.y1, el.x2, el.y2);
      if (dist < 8) return el;
    } else if (el.type === "text") {
      if (x >= el.x && x <= el.x + (el.text?.length || 1) * 12 && y >= el.y - 16 && y <= el.y + 4) {
        return el;
      }
    } else if (el.type === "leader") {
      const pts = el.points || [];
      for (let j = 0; j < pts.length - 1; j++) {
        const dist = pointToSegmentDist(x, y, pts[j].x, pts[j].y, pts[j+1].x, pts[j+1].y);
        if (dist < 8) return el;
      }
    } else if (el.type === "hatch") {
      const pts = el.points || [];
      if (pts.length >= 3) {
        let inside = false;
        for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
          const xi = pts[j].x, yi = pts[j].y;
          const xk = pts[k].x, yk = pts[k].y;
          const intersect = ((yi > y) !== (yk > y)) && (x < (xk - xi) * (y - yi) / (yk - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) return el;
      }
    }
  }
  return null;
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

interface CanvasEditorProps {
  drawingId: string | null;
  onNavigate: (target: string, id?: string) => void;
}

export default function CanvasEditor({ drawingId, onNavigate }: CanvasEditorProps) {
  const {
    currentDrawing,
    elements,
    selectedElementIds,
    tool,
    panOffset,
    zoom,
    layers,
    activeLayerId,
    gridVisible,
    loading,
    error,
    loadDrawing,
    saveDrawing,
    setTool,
    setZoom,
    setPanOffset,
    addElement,
    addElements,
    updateElement,
    deleteSelectedElements,
    setSelectedElementIds,
    undo,
    redo,
    addLayer,
    setActiveLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    deleteLayer,
    renameLayer,
    clearCanvas,
    resetEditor,
    blockDefs,
    insertBlock,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
  } = useDrawingStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [dragPoint, setDragPoint] = useState<Point | null>(null);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState<string | null>(null);
  const [drawingName, setDrawingName] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [snapPoint, setSnapPoint] = useState<SnapResult | null>(null);
  const [show3D, setShow3D] = useState(false);
  const [showPaperSpace, setShowPaperSpace] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [activeLeftPanel, setActiveLeftPanel] = useState("blocks");
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentPolylineId, setCurrentPolylineId] = useState<string | null>(null);

  const { user, token: authToken } = useAuthStore();
  const {
    connected: collabConnected,
    users: collabUsers,
    cursors: collabCursors,
    connect: collabConnect,
    disconnect: collabDisconnect,
    sendCursor: collabSendCursor,
    sendElementOp: collabSendElementOp,
  } = useCollaborationStore();

  const { isDark, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (drawingId) {
      loadDrawing(drawingId);
    }
    return () => resetEditor();
  }, [drawingId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape' || e.key === 'Enter') {
        if (tool === "polyline" && currentPolylineId) {
          setIsDrawing(false);
          setStartPoint(null);
          setDragPoint(null);
          setCurrentPolylineId(null);
          if (e.key === 'Escape') setTool("select");
        } else if (e.key === 'Escape') {
          setTool("select");
          setIsDrawing(false);
          setStartPoint(null);
          setDragPoint(null);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedElementIds.length > 0) {
          deleteSelectedElements();
        }
      } else if (cmdOrCtrl && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'y' || e.key === 'Y')) {
        redo();
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
        const toCopy = elements.filter(el => selectedElementIds.includes(el.id));
        setCopiedElements(toCopy);
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'v' || e.key === 'V')) {
        if (copiedElements.length > 0) {
          const newSelectedIds: string[] = [];
          copiedElements.forEach(el => {
            const newEl = { ...el, id: genId() };
            if ('x' in newEl) { (newEl as any).x += 20; (newEl as any).y += 20; }
            if ('x1' in newEl) { (newEl as any).x1 += 20; (newEl as any).x2 += 20; (newEl as any).y1 += 20; (newEl as any).y2 += 20; }
            if ('cx' in newEl) { (newEl as any).cx += 20; (newEl as any).cy += 20; }
            addElement(newEl);
            newSelectedIds.push(newEl.id);
          });
          setSelectedElementIds(newSelectedIds);
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    elements,
    selectedElementIds,
    copiedElements,
    undo,
    redo,
    deleteSelectedElements,
    setTool,
    addElement,
    setSelectedElementIds
  ]);

  // Connect to collaboration when drawing is loaded
  useEffect(() => {
    if (drawingId && user) {
      collabConnect(drawingId, user.id || user.email, user.email || "Anonymous");
    }
    return () => collabDisconnect();
  }, [drawingId, user?.id]);

  useEffect(() => {
    if (currentDrawing) {
      setDrawingName(currentDrawing.name || "Untitled");
    }
  }, [currentDrawing]);

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect()!;
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    if (gridVisible) {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      const viewW = rect.width / zoom;
      const viewH = rect.height / zoom;
      const startX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize;
      const startY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize;
      for (let x = startX; x < startX + viewW + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + viewH + gridSize);
        ctx.stroke();
      }
      for (let y = startY; y < startY + viewH + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + viewW + gridSize, y);
        ctx.stroke();
      }
    }

    // Draw elements
    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const layerMap: Record<string, any> = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    elements.forEach((el: any) => {
      if (!visibleLayerIds.includes(el.layerId)) return;
      ctx.save();

      // Resolve style: element > layer > default
      const layer = layerMap[el.layerId];
      const layerStyle = layer?.style || {};
      const strokeColor = el.strokeColor || layerStyle.strokeColor || "#1f2937";
      const fillColor = el.fillColor || layerStyle.fillColor || "transparent";
      const lineWidth = el.strokeWidth || el.lineWidth || layerStyle.lineWidth || 2;
      const lineType = el.lineType || layerStyle.lineType || "solid";

      applyStyle(ctx, null, { strokeColor, fillColor, lineWidth, lineType });
      ctx.font = `${el.fontStyle || "normal"} ${el.fontWeight || "normal"} ${el.fontSize || 16}px ${el.fontFamily || "sans-serif"}`;
      ctx.textAlign = (el.textAlign as CanvasTextAlign) || "left";
      ctx.textBaseline = "alphabetic";

      const isSelected = selectedElementIds.includes(el.id);
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
      }

      if (el.type === "rectangle") {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        if (fillColor && fillColor !== "transparent") {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc(el.cx, el.cy, el.radius, 0, Math.PI * 2);
        ctx.stroke();
        if (fillColor && fillColor !== "transparent") {
          ctx.fill();
        }
      } else if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
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
        ctx.fillStyle = strokeColor;
        ctx.fillText(el.text || "", el.x, el.y);
      } else if (el.type === "leader") {
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
      } else if (el.type === "hatch") {
        if (el.points && el.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.closePath();
          ctx.stroke();
          if (fillColor && fillColor !== "transparent") {
            ctx.fillStyle = fillColor;
            ctx.fill();
          }
          const pattern = el.pattern || "solid";
          if (pattern !== "solid") {
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([]);
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            el.points.forEach((p: Point) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            const spacing = pattern === "cross" ? 8 : 6;
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.closePath();
            ctx.clip();
            for (let d = minX - 20; d < maxX + 20; d += spacing) {
              ctx.beginPath();
              if (pattern === "cross") {
                ctx.moveTo(d, minY - 20);
                ctx.lineTo(d + (maxY - minY + 40), minY - 20);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(minX - 20, d - minX + minY);
                ctx.lineTo(maxX + 20, d - maxX + minY);
                ctx.stroke();
              } else {
                ctx.moveTo(d, minY - 20);
                ctx.lineTo(d + (maxY - minY + 40), maxY + 20);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        }
      } else if (el.type === "block") {
        // Render block instance
        const blockDef = blockDefs[el.blockId];
        if (blockDef) {
          ctx.save();
          ctx.translate(el.x || 0, el.y || 0);
          ctx.scale(el.scale || 1, el.scale || 1);
          ctx.rotate((el.rotation || 0) * Math.PI / 180);
          blockDef.elements.forEach((be: any) => {
            ctx.save();
            applyStyle(ctx, null, {
              strokeColor: be.strokeColor || "#1f2937",
              fillColor: be.fillColor || "transparent",
              lineWidth: be.strokeWidth || 2,
              lineType: be.lineType || "solid",
            });
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
              if (be.fillColor && be.fillColor !== "transparent") {
                ctx.fill();
              }
              ctx.stroke();
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
      } else if (el.type === "dimension") {
        // Draw dimension line
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();

        // Draw extension lines
        const dx = el.x2 - el.x1;
        const dy = el.y2 - el.y1;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
          const nx = -dy / len * 10;
          const ny = dx / len * 10;
          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(el.x1 + nx, el.y1 + ny);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(el.x2 + nx, el.y2 + ny);
          ctx.stroke();

          // Draw arrows
          const angle = Math.atan2(dy, dx);
          const arrowSize = 6;
          ctx.beginPath();
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(
            el.x1 + arrowSize * Math.cos(angle + Math.PI * 0.85),
            el.y1 + arrowSize * Math.sin(angle + Math.PI * 0.85)
          );
          ctx.moveTo(el.x1, el.y1);
          ctx.lineTo(
            el.x1 + arrowSize * Math.cos(angle - Math.PI * 0.85),
            el.y1 + arrowSize * Math.sin(angle - Math.PI * 0.85)
          );
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(
            el.x2 + arrowSize * Math.cos(angle + Math.PI + Math.PI * 0.15),
            el.y2 + arrowSize * Math.sin(angle + Math.PI + Math.PI * 0.15)
          );
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(
            el.x2 + arrowSize * Math.cos(angle + Math.PI - Math.PI * 0.15),
            el.y2 + arrowSize * Math.sin(angle + Math.PI - Math.PI * 0.15)
          );
          ctx.stroke();

          // Draw dimension text
          const midX = (el.x1 + el.x2) / 2;
          const midY = (el.y1 + el.y2) / 2;
          const dist = Math.round(len);
          ctx.fillStyle = strokeColor;
          ctx.font = "12px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(`${dist}`, midX + nx * 0.5, midY + ny * 0.5 - 2);
        }
      }

      ctx.restore();
    });

    // Draw preview while drawing
    if (isDrawing && startPoint && dragPoint) {
      ctx.save();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(dragPoint.x, dragPoint.y);
        ctx.stroke();
      } else if (tool === "polyline" && currentPolylineId) {
        const el = elements.find(e => e.id === currentPolylineId);
        if (el && el.points && el.points.length > 0) {
          const lastPt = el.points[el.points.length - 1];
          ctx.beginPath();
          ctx.moveTo(lastPt.x, lastPt.y);
          ctx.lineTo(dragPoint.x, dragPoint.y);
          ctx.stroke();
        }
      } else if (tool === "rectangle") {
        const w = dragPoint.x - startPoint.x;
        const h = dragPoint.y - startPoint.y;
        ctx.strokeRect(startPoint.x, startPoint.y, w, h);
      } else if (tool === "circle") {
        const r = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "dimension") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(dragPoint.x, dragPoint.y);
        ctx.stroke();
        // Show distance
        const len = Math.hypot(dragPoint.x - startPoint.x, dragPoint.y - startPoint.y);
        ctx.fillStyle = "#3b82f6";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(len)}`, (startPoint.x + dragPoint.x) / 2, (startPoint.y + dragPoint.y) / 2 - 10);
      } else if (tool === "leader") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(dragPoint.x, dragPoint.y);
        ctx.stroke();
        const angle = Math.atan2(dragPoint.y - startPoint.y, dragPoint.x - startPoint.x);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(startPoint.x + arrowSize * Math.cos(angle + Math.PI * 0.8), startPoint.y + arrowSize * Math.sin(angle + Math.PI * 0.8));
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(startPoint.x + arrowSize * Math.cos(angle - Math.PI * 0.8), startPoint.y + arrowSize * Math.sin(angle - Math.PI * 0.8));
        ctx.stroke();
      } else if (tool === "hatch") {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(dragPoint.x, startPoint.y);
        ctx.lineTo(dragPoint.x, dragPoint.y);
        ctx.lineTo(startPoint.x, dragPoint.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw snap indicator
    if (snapPoint) {
      drawSnapIndicator(ctx, snapPoint.point, snapPoint.type);
    }

    // Draw remote cursors
    Object.entries(collabCursors).forEach(([uid, pos]) => {
      if (pos && pos.x !== undefined) {
        const screenX = pos.x * zoom + panOffset.x;
        const screenY = pos.y * zoom + panOffset.y;
        ctx.save();
        ctx.strokeStyle = "#10b981";
        ctx.fillStyle = "#10b981";
        ctx.lineWidth = 2;
        // Draw cursor triangle
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + 10, screenY + 16);
        ctx.lineTo(screenX + 4, screenY + 12);
        ctx.lineTo(screenX - 2, screenY + 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Draw username
        const collabUser = collabUsers.find((u) => u.id === uid);
        if (collabUser) {
          ctx.font = "10px Arial";
          ctx.fillStyle = "#10b981";
          ctx.fillText(collabUser.username || "User", screenX + 12, screenY + 4);
        }
        ctx.restore();
      }
    });

    ctx.restore();
  }, [elements, selectedElementIds, tool, panOffset, zoom, layers, isDrawing, startPoint, dragPoint, snapPoint, collabCursors, collabUsers]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Get canvas coordinates from mouse event
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect()!;
      const pt = {
        x: (e.clientX - rect.left - panOffset.x) / zoom,
        y: (e.clientY - rect.top - panOffset.y) / zoom,
      };

      // Apply snapping
      const { snapEnabled, snapModes, elements } = useDrawingStore.getState();
      if (snapEnabled) {
        const snapped = findNearestSnap(elements, pt, snapModes, 40, 12 / zoom);
        if (snapped) {
          setSnapPoint(snapped);
          return snapped.point;
        }
      }
      setSnapPoint(null);
      return pt;
    },
    [panOffset, zoom]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);

    if (tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (tool === "select" || tool === "move") {
      const hit = getShapeAtPoint(elements, pt.x, pt.y);
      
      if (hit) {
        // If not already selected, select only this element
        if (!selectedElementIds.includes(hit.id)) {
          setSelectedElementIds([hit.id]);
        }
        setIsDraggingElement(true);
        setDragStart(pt);
        return;
      }

      if (tool === "move" && selectedElementIds.length > 0) {
        // If move tool is active and we have a selection, click anywhere acts as a base point
        setIsDraggingElement(true);
        setDragStart(pt);
        return;
      }

      if (tool === "select") {
        setSelectedElementIds([]);
      }
      return;
    }

    if (tool === "polyline") {
      if (!isDrawing) {
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
        const newId = genId();
        setCurrentPolylineId(newId);
        addElement({
          id: newId, type: "polyline", points: [pt], strokeColor: "#1f2937", strokeWidth: 2, layerId: activeLayerId
        });
      } else if (currentPolylineId) {
        const el = elements.find(e => e.id === currentPolylineId);
        if (el) {
          updateElement(currentPolylineId, { points: [...(el.points || []), pt] });
        }
      }
      return;
    }

    if (tool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        addElement({
          id: genId(),
          type: "text",
          text,
          x: pt.x,
          y: pt.y,
          fontSize: 16,
          strokeColor: "#1f2937",
          layerId: activeLayerId,
        });
      }
      return;
    }

    if (tool === "leader") {
      const text = prompt("Leader text:");
      setIsDrawing(true);
      setStartPoint(pt);
      setDragPoint(pt);
      setTextInput(text || "");
      return;
    }

    if (tool === "hatch") {
      setIsDrawing(true);
      setStartPoint(pt);
      setDragPoint(pt);
      return;
    }

    // Drawing tools
    setIsDrawing(true);
    setStartPoint(pt);
    setDragPoint(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Send cursor position for collaboration
    const canvasPt = getCanvasPoint(e);
    collabSendCursor(canvasPt.x, canvasPt.y);

    if (isPanning && panStart) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (isDraggingElement && dragStart && selectedElementIds.length > 0) {
      const pt = getCanvasPoint(e);
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      selectedElementIds.forEach((id) => {
        const el = elements.find((e) => e.id === id);
        if (!el) return;
        if (el.type === "rectangle") {
          updateElement(id, { x: el.x! + dx, y: el.y! + dy });
        } else if (el.type === "circle") {
          updateElement(id, { cx: el.cx! + dx, cy: el.cy! + dy });
        } else if (el.type === "line") {
          updateElement(id, { x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy });
        } else if (el.type === "text") {
          updateElement(id, { x: el.x! + dx, y: el.y! + dy });
        }
      });
      setDragStart(pt);
      return;
    }

    if (isDrawing) {
      setDragPoint(getCanvasPoint(e));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (isDraggingElement) {
      setIsDraggingElement(false);
      setDragStart(null);
      return;
    }

    if (isDrawing && startPoint && dragPoint) {
      const pt = getCanvasPoint(e);
      const dx = pt.x - startPoint.x;
      const dy = pt.y - startPoint.y;

      if (Math.abs(dx) < 3 && Math.abs(dy) < 3 && tool !== "polyline") {
        setIsDrawing(false);
        setStartPoint(null);
        setDragPoint(null);
        return;
      }

      let el: DrawingElement | null = null;
      if (tool === "line") {
        el = { id: genId(), type: "line", x1: startPoint.x, y1: startPoint.y, x2: pt.x, y2: pt.y, strokeColor: "#1f2937", strokeWidth: 2, layerId: activeLayerId };
      } else if (tool === "rectangle") {
        el = { id: genId(), type: "rectangle", x: Math.min(startPoint.x, pt.x), y: Math.min(startPoint.y, pt.y), width: Math.abs(dx), height: Math.abs(dy), strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", layerId: activeLayerId };
      } else if (tool === "circle") {
        const r = Math.hypot(dx, dy);
        el = { id: genId(), type: "circle", cx: startPoint.x, cy: startPoint.y, radius: r, strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", layerId: activeLayerId };
      } else if (tool === "dimension") {
        el = { id: genId(), type: "dimension", x1: startPoint.x, y1: startPoint.y, x2: pt.x, y2: pt.y, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId };
      }

      if (el && tool !== "polyline") addElement(el);
    }

    if (tool === "leader" && startPoint && dragPoint) {
      const pt2 = getCanvasPoint(e);
      const dx2 = pt2.x - startPoint.x;
      const dy2 = pt2.y - startPoint.y;
      if (Math.abs(dx2) > 3 || Math.abs(dy2) > 3) {
        addElement({
          id: genId(),
          type: "leader",
          points: [{ x: startPoint.x, y: startPoint.y }, { x: pt2.x, y: pt2.y }],
          text: textInput || "",
          strokeColor: "#1f2937",
          strokeWidth: 1.5,
          layerId: activeLayerId,
        });
      }
    }

    if (tool === "hatch" && startPoint && dragPoint) {
      const pt2 = getCanvasPoint(e);
      const dx2 = pt2.x - startPoint.x;
      const dy2 = pt2.y - startPoint.y;
      if (Math.abs(dx2) > 3 || Math.abs(dy2) > 3) {
        addElement({
          id: genId(),
          type: "hatch",
          points: [
            { x: startPoint.x, y: startPoint.y },
            { x: pt2.x, y: startPoint.y },
            { x: pt2.x, y: pt2.y },
            { x: startPoint.x, y: pt2.y },
          ],
          pattern: "hatch",
          strokeColor: "#1f2937",
          fillColor: "rgba(59, 130, 246, 0.1)",
          strokeWidth: 1,
          layerId: activeLayerId,
        });
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setDragPoint(null);
    setTextInput(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  };

  const exportCanvas = (format: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === "png") {
      const link = document.createElement("a");
      link.download = `${drawingName || "drawing"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else if (format === "svg") {
      // Build SVG from elements
      const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
      const visibleElements = elements.filter((el) => visibleLayerIds.includes(el.layerId));
      const padding = 20;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      visibleElements.forEach((el) => {
        if (el.type === "rectangle") {
          minX = Math.min(minX, el.x!); minY = Math.min(minY, el.y!);
          maxX = Math.max(maxX, el.x! + el.width!); maxY = Math.max(maxY, el.y! + el.height!);
        } else if (el.type === "circle") {
          minX = Math.min(minX, el.cx! - el.radius!); minY = Math.min(minY, el.cy! - el.radius!);
          maxX = Math.max(maxX, el.cx! + el.radius!); maxY = Math.max(maxY, el.cy! + el.radius!);
        } else if (el.type === "line") {
          minX = Math.min(minX, el.x1!, el.x2!); minY = Math.min(minY, el.y1!, el.y2!);
          maxX = Math.max(maxX, el.x1!, el.x2!); maxY = Math.max(maxY, el.y1!, el.y2!);
        } else if (el.type === "text") {
          minX = Math.min(minX, el.x!); minY = Math.min(minY, el.y! - 16);
          maxX = Math.max(maxX, el.x! + (el.text?.length || 1) * 12); maxY = Math.max(maxY, el.y! + 4);
        }
      });

      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

      const w = maxX - minX + padding * 2;
      const h = maxY - minY + padding * 2;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX - padding} ${minY - padding} ${w} ${h}">`;

      visibleElements.forEach((el) => {
        const stroke = el.strokeColor || "#1f2937";
        const strokeWidth = el.strokeWidth || 2;
        const fill = el.fillColor && el.fillColor !== "transparent" ? el.fillColor : "none";

        if (el.type === "rectangle") {
          svg += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />`;
        } else if (el.type === "circle") {
          svg += `<circle cx="${el.cx}" cy="${el.cy}" r="${el.radius}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />`;
        } else if (el.type === "line") {
          svg += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        } else if (el.type === "text") {
          svg += `<text x="${el.x}" y="${el.y}" font-family="sans-serif" font-size="${el.fontSize || 16}" fill="${stroke}">${el.text || ""}</text>`;
        }
      });

      svg += "</svg>";

      const blob = new Blob([svg], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.download = `${drawingName || "drawing"}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedElementIds.length > 0) deleteSelectedElements();
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "s") { e.preventDefault(); handleSave(); }
    }
  };

  const handleSave = async () => {
    setSaveStatus("Saving...");
    await saveDrawing();
    setSaveStatus("Saved!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleBack = () => {
    onNavigate("dashboard");
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="h-screen flex flex-col bg-[#0B0E14] text-gray-300 font-sans selection:bg-cyan-500/30 selection:text-cyan-50" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top Navbar */}
      <header className="h-14 bg-[#151B23] border-b border-[#1E293B] flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
        <div className="flex items-center space-x-6">
          <div className="flex items-center cursor-pointer group" onClick={handleBack}>
            <svg className="w-4 h-4 mr-2 text-slate-400 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PROJECT ALPHA</span>
              <span className="font-bold tracking-wider text-cyan-400 text-sm">Floor Plan v2.4</span>
            </div>
          </div>
          
          <div className="h-6 w-px bg-[#1E293B] mx-2"></div>
          
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono font-bold text-slate-500 mr-2 border border-slate-700 px-2 py-1 rounded">PEN_SIZE</span>
            {TOOLS.slice(0, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as ToolType)}
                className={`p-1.5 rounded text-sm font-medium transition-colors ${
                  tool === t.id
                    ? "text-cyan-400"
                    : "text-slate-500 hover:text-white"
                }`}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-1 ml-4 bg-[#11161D] rounded p-1 border border-[#1E293B]">
            <button onClick={() => setSnapEnabled(!snapEnabled)} className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${snapEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-gray-300'}`}>SNAP</button>
            <button onClick={() => setGridVisible(!gridVisible)} className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${gridVisible ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-gray-300'}`}>GRID</button>
            <button onClick={() => setOrthoEnabled(!orthoEnabled)} className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${orthoEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-gray-300'}`}>ORTHO</button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select className="bg-[#11161D] border border-[#1E293B] text-slate-300 text-xs font-bold px-2 py-1 rounded outline-none focus:border-cyan-500">
            <option>1:100</option>
            <option>1:50</option>
            <option>1:200</option>
          </select>
          
          <div className="flex items-center bg-[#11161D] rounded border border-[#1E293B] overflow-hidden">
            <button className={`px-3 py-1 text-[10px] font-bold ${!show3D ? 'bg-cyan-500 text-slate-900' : 'text-slate-400 hover:text-gray-200'}`} onClick={() => setShow3D(false)}>2D</button>
            <button className={`px-3 py-1 text-[10px] font-bold ${show3D ? 'bg-cyan-500 text-slate-900' : 'text-slate-400 hover:text-gray-200'}`} onClick={() => setShow3D(true)}>3D</button>
          </div>
          
          <button onClick={handleSave} disabled={loading} className="px-4 py-1 text-[10px] font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all">
            {loading ? "SAVING..." : "SAVE"}
          </button>
          
          <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-700 ml-2">
            <img src="https://i.pravatar.cc/100" alt="avatar" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Full CAD Sidebar */}
        <CadSidebar
          tool={tool}
          setTool={(t) => setTool(t as ToolType)}
          layers={layers}
          activeLayerId={activeLayerId}
          setActiveLayer={setActiveLayer}
          addLayer={addLayer}
          toggleLayerVisibility={toggleLayerVisibility}
          toggleLayerLock={toggleLayerLock}
          deleteLayer={deleteLayer}
          renameLayer={renameLayer}
          gridVisible={gridVisible}
          setGridVisible={setGridVisible}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          orthoEnabled={orthoEnabled}
          setOrthoEnabled={setOrthoEnabled}
          zoom={zoom}
          setZoom={setZoom}
          setPanOffset={setPanOffset}
          insertBlock={insertBlock}
          selectedElement={selectedElementIds.length > 0 ? elements.find(e => e.id === selectedElementIds[0]) : undefined}
          onExportSvg={() => exportCanvas("svg")}
          onExportPng={() => exportCanvas("png")}
          onExportDxf={() => exportCanvas("dxf")}
          addElements={(els) => addElements(els.map(el => ({ ...el, layerId: el.layerId || activeLayerId })))}
          authToken={authToken ?? undefined}
        />

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0B0E14]">
          {!show3D && !showPaperSpace && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
            />
          )}

          <ThreeViewer elements={elements} blockDefs={blockDefs} visible={show3D} />
          <PaperSpace elements={elements} visible={showPaperSpace} onClose={() => setShowPaperSpace(false)} />

          {/* Top Right Widget (TOP) */}
          <div className="absolute top-6 right-6 w-16 h-16 bg-[#151B23]/90 backdrop-blur border border-[#1E293B] rounded flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer z-20 shadow-lg">
            <span className="text-[8px] font-bold text-cyan-400 mb-1">TOP</span>
            <div className="w-6 h-6 border-2 border-cyan-500/50 transform rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 border border-cyan-400"></div>
            </div>
          </div>

          {/* Bottom Right Floating AI Command Box */}
          <div className="absolute bottom-6 right-6 w-80 bg-[#151B23]/95 backdrop-blur-xl border border-[#1E293B] rounded-xl flex flex-col shadow-2xl z-20 overflow-hidden ring-1 ring-white/5">
            <div className="p-3 border-b border-[#1E293B] flex items-center bg-[#11161D]/80">
              <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white tracking-widest uppercase">Command AI</span>
                <span className="text-[8px] font-mono text-cyan-500/70">ENGINEERING_MODEL_v4.2</span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-400 italic">
                Try: "Draw a 10x12m house with a bedroom and a 1m door"
              </p>
              
              <div className="flex gap-2">
                <button 
                  disabled={isAiLoading || !commandInput.trim()}
                  onClick={async () => {
                    if (!commandInput.trim()) return;
                    setIsAiLoading(true);
                    const res = await generateDrawingFromPrompt(commandInput.trim(), authToken ?? undefined);
                    setIsAiLoading(false);
                    if (res.elements?.length) {
                      addElements(res.elements.map(el => ({ ...el, layerId: el.layerId || activeLayerId })));
                      setCommandInput("");
                    } else if (res.error) {
                      alert(res.error);
                    }
                  }}
                  className={`flex-1 text-white text-[9px] font-bold py-1.5 rounded flex items-center justify-center transition-colors ${
                    isAiLoading || !commandInput.trim() ? "bg-slate-700 cursor-not-allowed" : "bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                  }`}
                >
                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {isAiLoading ? "THINKING..." : "GENERATE"}
                </button>
                <button className="flex-1 bg-[#1E293B] hover:bg-[#2A3441] text-gray-300 text-[9px] font-bold py-1.5 rounded transition-colors"
                  onClick={() => setCommandInput(prev => prev + " with stroke color #EF4444")}
                >
                  ADD RED COLOR
                </button>
              </div>
            </div>

            <div className="p-3 border-t border-[#1E293B] bg-[#0B0E14] flex items-center">
              <input 
                type="text" 
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const cmd = commandInput.trim().toUpperCase();
                    if (!cmd) return;
                    
                    // 1. Check for basic CAD shortcuts first
                    if (cmd === 'L' || cmd === 'LINE') { setTool('line'); setCommandInput(""); return; }
                    if (cmd === 'PL' || cmd === 'PLINE') { setTool('polyline'); setCommandInput(""); return; }
                    if (cmd === 'C' || cmd === 'CIRCLE') { setTool('circle'); setCommandInput(""); return; }
                    if (cmd === 'REC' || cmd === 'RECTANGLE') { setTool('rectangle'); setCommandInput(""); return; }
                    if (cmd === 'D' || cmd === 'DIM') { setTool('dimension'); setCommandInput(""); return; }
                    if (cmd === 'T' || cmd === 'TEXT') { setTool('text'); setCommandInput(""); return; }
                    if (cmd === 'H' || cmd === 'HATCH') { setTool('hatch'); setCommandInput(""); return; }
                    if (cmd === 'M' || cmd === 'MOVE') { setTool('select'); setCommandInput(""); return; }
                    if (cmd === 'PLOT') { window.print(); setCommandInput(""); return; }
                    
                    // 2. If it's a long string, treat as an AI prompt
                    setIsAiLoading(true);
                    const res = await generateDrawingFromPrompt(commandInput.trim(), authToken ?? undefined);
                    setIsAiLoading(false);
                    if (res.elements?.length) {
                      addElements(res.elements.map(el => ({ ...el, layerId: el.layerId || activeLayerId })));
                      setCommandInput("");
                    } else if (res.error) {
                      alert(res.error);
                    }
                  }
                }}
                placeholder="Enter command or describe drawing..." 
                className="bg-transparent border-none text-xs font-bold text-white placeholder-slate-600 flex-1 focus:outline-none font-mono"
              />
              <button 
                className="text-slate-500 hover:text-cyan-400 p-1 transition-colors"
                onClick={async () => {
                  if (!commandInput.trim()) return;
                  setIsAiLoading(true);
                  const res = await generateDrawingFromPrompt(commandInput.trim(), authToken ?? undefined);
                  setIsAiLoading(false);
                  if (res.elements?.length) {
                    addElements(res.elements.map(el => ({ ...el, layerId: el.layerId || activeLayerId })));
                    setCommandInput("");
                  }
                }}
              >
                <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar removed – all panels are in CadSidebar (left) */}
        <aside className="hidden">
          {/* Object Properties */}
          <div className="p-4 border-b border-[#1E293B]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Object Properties</h2>
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">X Position</span>
                <input type="text" value={selectedElementIds.length > 0 ? (elements.find(e => e.id === selectedElementIds[0])?.x || "0").toString() : ""} readOnly className="bg-[#0B0E14] border border-[#1E293B] rounded p-2 text-xs text-gray-200 font-mono outline-none" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Y Position</span>
                <input type="text" value={selectedElementIds.length > 0 ? (elements.find(e => e.id === selectedElementIds[0])?.y || "0").toString() : ""} readOnly className="bg-[#0B0E14] border border-[#1E293B] rounded p-2 text-xs text-gray-200 font-mono outline-none" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Width</span>
                <input type="text" value={selectedElementIds.length > 0 ? (elements.find(e => e.id === selectedElementIds[0])?.width || "0").toString() : ""} readOnly className="bg-[#0B0E14] border border-[#1E293B] rounded p-2 text-xs text-gray-200 font-mono outline-none" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Height</span>
                <input type="text" value={selectedElementIds.length > 0 ? (elements.find(e => e.id === selectedElementIds[0])?.height || "0").toString() : ""} readOnly className="bg-[#0B0E14] border border-[#1E293B] rounded p-2 text-xs text-gray-200 font-mono outline-none" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Layer</span>
              <div className="relative">
                <select className="w-full bg-[#0B0E14] border border-[#1E293B] rounded p-2 text-xs text-white font-mono appearance-none outline-none pl-7">
                  <option>{activeLayer?.name || "Structural_A1"}</option>
                  {layers.map(l => <option key={l.id}>{l.name}</option>)}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400"></div>
                <svg className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          {/* Layers List */}
          <div className="p-4 border-b border-[#1E293B] flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Layers</h2>
              <button onClick={addLayer} className="p-1 border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-500/10 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                    activeLayerId === layer.id ? "bg-[#1E293B] border border-gray-600 shadow-sm" : "hover:bg-[#151B23] border border-transparent"
                  }`}
                >
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className="text-gray-500 hover:text-cyan-400 transition-colors">
                    {layer.visible ? <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }} className="text-gray-500 hover:text-red-400 transition-colors">
                    {layer.locked ? <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
                  </button>
                  <input
                    value={layer.name}
                    onChange={(e) => renameLayer(layer.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 bg-transparent border-none outline-none text-xs font-mono ${activeLayerId === layer.id ? 'text-white' : 'text-gray-400'}`}
                  />
                  <div className="w-3 h-3 rounded shadow-sm" style={{ backgroundColor: layer.style?.strokeColor || '#38BDF8' }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Blocks */}
          <div className="p-4 border-b border-[#1E293B]">
            <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Standard Blocks</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "desk", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
                { id: "chair", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
                { id: "door", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
                { id: "window", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /> },
                { id: "bed", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> },
                { id: "bath", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /> }
              ].map(block => (
                <div 
                  key={block.id} 
                  className="bg-[#0B0E14] border border-[#1E293B] rounded-lg py-5 flex items-center justify-center hover:border-cyan-500 hover:text-cyan-400 cursor-pointer text-gray-500 transition-colors"
                  onClick={() => {
                    const centerX = (containerRef.current?.clientWidth || 800) / 2 / zoom - panOffset.x / zoom;
                    const centerY = (containerRef.current?.clientHeight || 600) / 2 / zoom - panOffset.y / zoom;
                    insertBlock(block.id, centerX, centerY);
                  }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {block.icon}
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Data Exchange */}
          <div className="p-4">
            <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Data Exchange</h2>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-[#1E293B] hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-300 text-[10px] font-bold rounded transition-colors border border-transparent hover:border-cyan-500/30 shadow-sm">DXF</button>
              <button onClick={() => exportCanvas("svg")} className="flex-1 py-2 bg-[#1E293B] hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-300 text-[10px] font-bold rounded transition-colors border border-transparent hover:border-cyan-500/30 shadow-sm">SVG</button>
              <button className="flex-1 py-2 bg-[#1E293B] hover:bg-cyan-500/20 hover:text-cyan-400 text-gray-300 text-[10px] font-bold rounded transition-colors border border-transparent hover:border-cyan-500/30 shadow-sm">DWG</button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Footer Console */}
      <footer className="h-8 bg-[#0B0E14] border-t border-[#1E293B] flex items-center justify-between px-4 shrink-0 overflow-hidden text-[9px] font-mono">
        <div className="flex items-center space-x-4 h-full">
          <span className="font-bold text-yellow-500 tracking-wider">ARCH-TECH COMMAND LINE [AI ENABLED]</span>
          <span className="text-gray-500 font-medium tracking-wide">&gt; ZOOM {(zoom*100).toFixed(0)}% COMPLETED &gt; LAYER "{activeLayer?.name || "Structural_Walls"}" SELECTED</span>
        </div>
        
        <div className="flex items-center space-x-6 text-gray-400 font-bold tracking-wider">
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Logs</span>
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Units (mm)</span>
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Grid (10mm)</span>
        </div>
      </footer>
    </div>
  );
}
