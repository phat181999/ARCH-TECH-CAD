import { useState, useEffect, useRef, useCallback } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { useCollaborationStore } from "../stores/collaborationStore";
import { useAuthStore } from "../stores/authStore";
import CommandLine from "../components/CommandLine";
import SnapToolbar from "../components/SnapToolbar";
import TextFormatBar from "../components/TextFormatBar";
import BlockLibrary from "../components/BlockLibrary";
import ThreeViewer from "../components/ThreeViewer";
import PaperSpace from "../components/PaperSpace";
import BIMPanel from "../components/BIMPanel";
import CloudStorage from "../components/CloudStorage";
import { findNearestSnap, drawSnapIndicator } from "../canvas/snap";
import { elementsToDxf, dxfToElements } from "../canvas/dxf";

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
function applyStyle(ctx, el, resolvedStyle) {
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

function getShapeAtPoint(elements, x, y) {
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

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export default function CanvasEditor({ drawingId, onNavigate }) {
  const {
    currentDrawing,
    elements,
    selectedElementIds,
    tool,
    panOffset,
    zoom,
    layers,
    activeLayerId,
    loading,
    error,
    loadDrawing,
    saveDrawing,
    setTool,
    setZoom,
    setPanOffset,
    addElement,
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
  } = useDrawingStore();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [dragPoint, setDragPoint] = useState(null);
  const [isDraggingElement, setIsDraggingElement] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [textInput, setTextInput] = useState(null);
  const [drawingName, setDrawingName] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [snapPoint, setSnapPoint] = useState(null);
  const [show3D, setShow3D] = useState(false);
  const [showPaperSpace, setShowPaperSpace] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);

  const { user } = useAuthStore();
  const {
    connected: collabConnected,
    users: collabUsers,
    cursors: collabCursors,
    connect: collabConnect,
    disconnect: collabDisconnect,
    sendCursor: collabSendCursor,
    sendElementOp: collabSendElementOp,
  } = useCollaborationStore();

  useEffect(() => {
    if (drawingId) {
      loadDrawing(drawingId);
    }
    return () => resetEditor();
  }, [drawingId]);

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
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw grid
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

    // Draw elements
    const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);
    const layerMap = {};
    layers.forEach((l) => { layerMap[l.id] = l; });

    elements.forEach((el) => {
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
      ctx.textAlign = el.textAlign || "left";
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
            el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
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
          blockDef.elements.forEach((be) => {
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
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
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

  const handleMouseDown = (e) => {
    const pt = getCanvasPoint(e);

    if (tool === "pan") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (tool === "select") {
      const hit = getShapeAtPoint(elements, pt.x, pt.y);
      if (hit) {
        setSelectedElementIds([hit.id]);
        setIsDraggingElement(true);
        setDragStart(pt);
        return;
      }
      setSelectedElementIds([]);
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

  const handleMouseMove = (e) => {
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
          updateElement(id, { x: el.x + dx, y: el.y + dy });
        } else if (el.type === "circle") {
          updateElement(id, { cx: el.cx + dx, cy: el.cy + dy });
        } else if (el.type === "line") {
          updateElement(id, { x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy });
        } else if (el.type === "text") {
          updateElement(id, { x: el.x + dx, y: el.y + dy });
        }
      });
      setDragStart(pt);
      return;
    }

    if (isDrawing) {
      setDragPoint(getCanvasPoint(e));
    }
  };

  const handleMouseUp = (e) => {
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

      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        setIsDrawing(false);
        setStartPoint(null);
        setDragPoint(null);
        return;
      }

      let el = null;
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

      if (el) addElement(el);
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

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  };

  const exportCanvas = (format) => {
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
          minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
        } else if (el.type === "circle") {
          minX = Math.min(minX, el.cx - el.radius); minY = Math.min(minY, el.cy - el.radius);
          maxX = Math.max(maxX, el.cx + el.radius); maxY = Math.max(maxY, el.cy + el.radius);
        } else if (el.type === "line") {
          minX = Math.min(minX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2);
          maxX = Math.max(maxX, el.x1, el.x2); maxY = Math.max(maxY, el.y1, el.y2);
        } else if (el.type === "text") {
          minX = Math.min(minX, el.x); minY = Math.min(minY, el.y - 16);
          maxX = Math.max(maxX, el.x + (el.text?.length || 1) * 12); maxY = Math.max(maxY, el.y + 4);
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

  const handleKeyDown = (e) => {
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
    <div className="h-screen flex flex-col bg-gray-900" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={handleBack}
          className="text-gray-300 hover:text-white px-2 py-1"
        >
          ← Back
        </button>
        <input
          type="text"
          value={drawingName}
          onChange={(e) => setDrawingName(e.target.value)}
          className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
        />
        <div className="flex-1" />
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tool === t.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-600"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            className="text-gray-300 hover:text-white px-2 py-1 text-sm"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={redo}
            className="text-gray-300 hover:text-white px-2 py-1 text-sm"
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <button
            onClick={() => setZoom(zoom * 0.8)}
            className="hover:text-white"
          >
            −
          </button>
          <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom * 1.25)}
            className="hover:text-white"
          >
            +
          </button>
        </div>
        <SnapToolbar />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShow3D(!show3D)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              show3D ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title="3D View"
          >
            3D
          </button>
          <button
            onClick={() => setShowPaperSpace(!showPaperSpace)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showPaperSpace ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title="Paper Space"
          >
            📄
          </button>
          <button
            onClick={() => setShowCollaborators(!showCollaborators)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showCollaborators ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title={`Collaborators (${collabUsers.length})`}
          >
            👥 {collabUsers.length > 0 && <span className="ml-1 text-xs">{collabUsers.length}</span>}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        {saveStatus && (
          <span className="text-green-400 text-sm">{saveStatus}</span>
        )}
      </div>

      
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-gray-800"
        >
          {/* 2D Canvas */}
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

          {/* 3D Viewer */}
          <ThreeViewer
            elements={elements}
            blockDefs={blockDefs}
            visible={show3D}
          />

          {/* Paper Space */}
          <PaperSpace
            elements={elements}
            visible={showPaperSpace}
            onClose={() => setShowPaperSpace(false)}
          />

          {/* Collaboration panel overlay */}
          {showCollaborators && (
            <div className="absolute top-2 right-2 z-20 bg-gray-800/95 border border-gray-600 rounded-lg p-3 min-w-[200px] shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-200">
                  Collaborators
                  <span className={`ml-2 inline-block w-2 h-2 rounded-full ${collabConnected ? "bg-green-500" : "bg-red-500"}`} />
                </h3>
                <button
                  onClick={() => setShowCollaborators(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                {collabUsers.length === 0 && (
                  <p className="text-xs text-gray-500">No other users connected</p>
                )}
                {collabUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-xs text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {u.username || u.id}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-xs text-gray-500">
                  {collabConnected ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0">
          {/* Element Properties */}
          {selectedElementIds.length === 1 && (() => {
            const el = elements.find(e => e.id === selectedElementIds[0]);
            if (!el) return null;
            return (
              <div className="p-3 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-200 mb-2">Properties</h3>
                {el.type === "text" && (
                  <div className="mb-3">
                    <TextFormatBar
                      elementId={el.id}
                      onClose={() => setSelectedElementIds([])}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Stroke Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={el.strokeColor || "#1f2937"}
                        onChange={(e) => updateElement(el.id, { strokeColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                      />
                      <input
                        type="text"
                        value={el.strokeColor || "#1f2937"}
                        onChange={(e) => updateElement(el.id, { strokeColor: e.target.value })}
                        className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {(el.type === "rectangle" || el.type === "circle") && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Fill Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={el.fillColor && el.fillColor !== "transparent" ? el.fillColor : "#ffffff"}
                          onChange={(e) => updateElement(el.id, { fillColor: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-600"
                        />
                        <input
                          type="text"
                          value={el.fillColor || "transparent"}
                          onChange={(e) => updateElement(el.id, { fillColor: e.target.value })}
                          className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => updateElement(el.id, { fillColor: "transparent" })}
                          className="text-xs text-gray-400 hover:text-white px-1"
                          title="No fill"
                        >
                          ∅
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Stroke Width</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={el.strokeWidth || 2}
                      onChange={(e) => updateElement(el.id, { strokeWidth: parseInt(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-xs text-gray-500">{el.strokeWidth || 2}px</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* BIM Properties */}
          <BIMPanel
            element={selectedElementIds.length === 1 ? elements.find(e => e.id === selectedElementIds[0]) : null}
            onUpdate={updateElement}
          />

          {/* Export */}
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-200 mb-2">Export / Import</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportCanvas("png")}
                className="flex-1 px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs font-medium"
              >
                PNG
              </button>
              <button
                onClick={() => exportCanvas("svg")}
                className="flex-1 px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs font-medium"
              >
                SVG
              </button>
              <button
                onClick={() => {
                  const dxf = elementsToDxf(elements);
                  const blob = new Blob([dxf], { type: "text/plain" });
                  const link = document.createElement("a");
                  link.download = `${drawingName || "drawing"}.dxf`;
                  link.href = URL.createObjectURL(blob);
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
                className="flex-1 px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs font-medium"
              >
                DXF
              </button>
              <label className="flex-1 px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs font-medium text-center cursor-pointer">
                Import DXF
                <input
                  type="file"
                  accept=".dxf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const text = ev.target?.result;
                      if (typeof text === "string") {
                        const imported = dxfToElements(text);
                        imported.forEach((el) => addElement(el));
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Cloud Storage */}
          <CloudStorage
            onImportDrawing={(file) => {
              // Simulate importing a cloud file
              if (file.name.endsWith(".dxf")) {
                // In a real app, fetch the file content from the cloud provider
                alert(`Importing ${file.name} from cloud storage...\n(Cloud API integration required for full functionality)`);
              }
            }}
            onExportDrawing={() => {
              const dxf = elementsToDxf(elements);
              const blob = new Blob([dxf], { type: "text/plain" });
              // In a real app, upload to the cloud provider
              alert("Export to cloud storage triggered.\n(Cloud API integration required for full functionality)");
            }}
          />

          <BlockLibrary
            onInsertBlock={(block) => {
              // Insert at center of current view
              const centerX = (containerRef.current?.clientWidth || 800) / 2 / zoom - panOffset.x / zoom;
              const centerY = (containerRef.current?.clientHeight || 600) / 2 / zoom - panOffset.y / zoom;
              insertBlock(block.id, centerX, centerY);
            }}
          />

          {/* Layers panel */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-200">Layers</h3>
              <button
                onClick={addLayer}
                className="text-gray-400 hover:text-white text-sm px-2 py-0.5 rounded hover:bg-gray-700"
              >
                + Add
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
                    activeLayerId === layer.id
                      ? "bg-blue-600/20 border border-blue-500/30"
                      : "hover:bg-gray-700 border border-transparent"
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    className={`text-xs ${layer.visible ? "text-gray-300" : "text-gray-600"}`}
                  >
                    {layer.visible ? "👁" : "—"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                    className={`text-xs ${layer.locked ? "text-red-400" : "text-gray-600"}`}
                  >
                    {layer.locked ? "🔒" : "🔓"}
                  </button>
                  <input
                    value={layer.name}
                    onChange={(e) => renameLayer(layer.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent text-gray-200 focus:outline-none focus:bg-gray-700 px-1 rounded"
                  />
                  {layers.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                      className="text-gray-500 hover:text-red-400 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
              Active: {activeLayer?.name || "None"}
            </div>
          </div>
        </div>
      </div>
      <CommandLine onExport={exportCanvas} />
    </div>
  );
}
