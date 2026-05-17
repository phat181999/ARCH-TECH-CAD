import { useState, useEffect, useRef, useCallback } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import CommandLine from "../components/CommandLine";
import SnapToolbar from "../components/SnapToolbar";
import TextFormatBar from "../components/TextFormatBar";
import BlockLibrary from "../components/BlockLibrary";
import { findNearestSnap, drawSnapIndicator } from "../canvas/snap";
import { elementsToDxf, dxfToElements } from "../canvas/dxf";

const TOOLS = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "text", label: "Text", icon: "T" },
  { id: "dimension", label: "Dimension", icon: "📏" },
  { id: "pan", label: "Pan", icon: "✋" },
];

let idCounter = 0;
const genId = () => `el-${Date.now()}-${++idCounter}`;

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

  useEffect(() => {
    if (drawingId) {
      loadDrawing(drawingId);
    }
    return () => resetEditor();
  }, [drawingId]);

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
    elements.forEach((el) => {
      if (!visibleLayerIds.includes(el.layerId)) return;
      ctx.save();
      ctx.strokeStyle = el.strokeColor || "#1f2937";
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.lineWidth = el.strokeWidth || 2;
      ctx.font = `${el.fontSize || 16}px sans-serif`;

      const isSelected = selectedElementIds.includes(el.id);
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
      }

      if (el.type === "rectangle") {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
        if (el.fillColor && el.fillColor !== "transparent") {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc(el.cx, el.cy, el.radius, 0, Math.PI * 2);
        ctx.stroke();
        if (el.fillColor && el.fillColor !== "transparent") {
          ctx.fill();
        }
      } else if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === "text") {
        ctx.fillStyle = el.strokeColor || "#1f2937";
        ctx.fillText(el.text || "", el.x, el.y);
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
            ctx.strokeStyle = be.strokeColor || "#1f2937";
            ctx.fillStyle = be.fillColor || "transparent";
            ctx.lineWidth = be.strokeWidth || 2;
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
          ctx.fillStyle = el.strokeColor || "#3b82f6";
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
      }

      ctx.restore();
    }

    // Draw snap indicator
    if (snapPoint) {
      drawSnapIndicator(ctx, snapPoint.point, snapPoint.type);
    }

    ctx.restore();
  }, [elements, selectedElementIds, tool, panOffset, zoom, layers, isDrawing, startPoint, dragPoint, snapPoint]);

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

    // Drawing tools
    setIsDrawing(true);
    setStartPoint(pt);
    setDragPoint(pt);
  };

  const handleMouseMove = (e) => {
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

    setIsDrawing(false);
    setStartPoint(null);
    setDragPoint(null);
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
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          />
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
