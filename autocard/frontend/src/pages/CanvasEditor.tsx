import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { useCollaborationStore } from "../stores/collaborationStore";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import CadSidebar from "../components/CadSidebar";
import { Point, ToolType, DrawingElement, DrawingDocument } from "../types";
import { findNearestSnap, SnapResult } from "../canvas/snap";
import { CadEngine } from "../canvas/CadEngine";
import { elementsToDxf, dxfToElements } from "../canvas/dxf";
import { pointLineDistance, projectPointOnLineSegment } from "../core/geometry";
import { buildDroppedToolElement, resolveCanvasDropAction } from "../canvas/drop";

// Newly extracted subcomponents
import { EditorHeader } from "./CanvasEditor/components/EditorHeader";
import { StatusBar } from "./CanvasEditor/components/StatusBar";
import { DrawingHUD } from "./CanvasEditor/components/DrawingHUD";
import { AnnotationDialog, AnnotationConfirmPayload } from "./CanvasEditor/components/AnnotationDialog";
import { ImportConfirmDialog } from "./CanvasEditor/components/ImportConfirmDialog";
import { AiCommandBox } from "./CanvasEditor/components/AiCommandBox";
import { PropertyPanel } from "./CanvasEditor/components/PropertyPanel";

// Lazy-loaded heavy components
const ThreeViewer = lazy(() => import("../components/ThreeViewer"));
const PaperSpace = lazy(() => import("../components/PaperSpace"));

let idCounter = 0;
const genId = () => `el-${Date.now()}-${++idCounter}`;

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
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
    } else if (el.type === "arc") {
      const dist = Math.hypot(x - (el.cx || 0), y - (el.cy || 0));
      if (Math.abs(dist - (el.radius || 0)) < 10) return el;
    } else if (el.type === "ellipse") {
      const rx = (el as any).rx || 50, ry = (el as any).ry || 30;
      if (rx > 0 && ry > 0) {
        const norm = ((x - (el.cx || 0)) ** 2) / (rx * rx) + ((y - (el.cy || 0)) ** 2) / (ry * ry);
        if (norm <= 1.2) return el;
      }
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

function rotatePt(pt: Point, pivot: Point, angle: number): Point {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

function scalePtFn(pt: Point, pivot: Point, factor: number): Point {
  return { x: pivot.x + (pt.x - pivot.x) * factor, y: pivot.y + (pt.y - pivot.y) * factor };
}

function getSelectionCentroid(elems: DrawingElement[], ids: string[]): Point {
  const sel = elems.filter(e => ids.includes(e.id));
  if (sel.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0, count = 0;
  sel.forEach(el => {
    if (el.type === "line" && el.x1 !== undefined) { x += (el.x1 + (el.x2 || 0)) / 2; y += ((el.y1 || 0) + (el.y2 || 0)) / 2; count++; }
    else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") { x += el.cx || 0; y += el.cy || 0; count++; }
    else if ((el.type === "rectangle" || el.type === "text") && el.x !== undefined) { x += (el.x || 0) + (el.width || 0) / 2; y += (el.y || 0) + (el.height || 0) / 2; count++; }
    else if (el.type === "wall") { const s = (el as any).start, e2 = (el as any).end; if (s && e2) { x += (s.x + e2.x) / 2; y += (s.y + e2.y) / 2; count++; } }
    else if ((el.type === "polyline" || el.type === "leader" || el.type === "hatch") && el.points?.length) {
      x += el.points.reduce((s: number, p: Point) => s + p.x, 0) / el.points.length;
      y += el.points.reduce((s: number, p: Point) => s + p.y, 0) / el.points.length;
      count++;
    }
  });
  return count > 0 ? { x: x / count, y: y / count } : { x: 0, y: 0 };
}

function applyElementRotation(el: DrawingElement, pivot: Point, angle: number): Partial<DrawingElement> {
  if (el.type === "line") {
    const p1 = rotatePt({ x: el.x1!, y: el.y1! }, pivot, angle);
    const p2 = rotatePt({ x: el.x2!, y: el.y2! }, pivot, angle);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
    const c = rotatePt({ x: el.cx!, y: el.cy! }, pivot, angle);
    return { cx: c.x, cy: c.y };
  } else if (el.type === "rectangle") {
    const p = rotatePt({ x: el.x!, y: el.y! }, pivot, angle);
    return { x: p.x, y: p.y, rotation: ((el.rotation as number) || 0) + (angle * 180 / Math.PI) };
  } else if (el.type === "polyline") {
    return { points: (el.points || []).map((pt: Point) => rotatePt(pt, pivot, angle)) };
  } else if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    return { start: rotatePt(s, pivot, angle), end: rotatePt(e2, pivot, angle) } as any;
  } else if (el.type === "text" || el.type === "block") {
    const p = rotatePt({ x: el.x!, y: el.y! }, pivot, angle);
    return { x: p.x, y: p.y, rotation: ((el.rotation as number) || 0) + (angle * 180 / Math.PI) };
  } else if (el.type === "dimension" || el.type === "leader") {
    if (el.x1 !== undefined) {
      const p1 = rotatePt({ x: el.x1!, y: el.y1! }, pivot, angle);
      const p2 = rotatePt({ x: el.x2!, y: el.y2! }, pivot, angle);
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    return { points: (el.points || []).map((pt: Point) => rotatePt(pt, pivot, angle)) };
  }
  return {};
}

function applyElementScale(el: DrawingElement, pivot: Point, factor: number): Partial<DrawingElement> {
  if (el.type === "line") {
    const p1 = scalePtFn({ x: el.x1!, y: el.y1! }, pivot, factor);
    const p2 = scalePtFn({ x: el.x2!, y: el.y2! }, pivot, factor);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
    const c = scalePtFn({ x: el.cx!, y: el.cy! }, pivot, factor);
    return { cx: c.x, cy: c.y, radius: (el.radius || 0) * factor, rx: ((el as any).rx || 0) * factor, ry: ((el as any).ry || 0) * factor };
  } else if (el.type === "rectangle") {
    const p = scalePtFn({ x: el.x!, y: el.y! }, pivot, factor);
    return { x: p.x, y: p.y, width: (el.width || 0) * factor, height: (el.height || 0) * factor };
  } else if (el.type === "polyline") {
    return { points: (el.points || []).map((pt: Point) => scalePtFn(pt, pivot, factor)) };
  } else if (el.type === "wall") {
    const s = (el as any).start, e2 = (el as any).end;
    return { start: scalePtFn(s, pivot, factor), end: scalePtFn(e2, pivot, factor) } as any;
  } else if (el.type === "text") {
    const p = scalePtFn({ x: el.x!, y: el.y! }, pivot, factor);
    return { x: p.x, y: p.y, fontSize: (el.fontSize || 16) * factor };
  }
  return {};
}

function offsetElement(el: DrawingElement, dx: number, dy: number): DrawingElement {
  if (el.type === "line") return { ...el, x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
  if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") return { ...el, cx: el.cx! + dx, cy: el.cy! + dy };
  if (el.type === "rectangle" || el.type === "text") return { ...el, x: el.x! + dx, y: el.y! + dy };
  if (el.type === "wall") { const s = (el as any).start, e2 = (el as any).end; return { ...el, start: { x: s.x + dx, y: s.y + dy }, end: { x: e2.x + dx, y: e2.y + dy } } as any; }
  if (el.type === "polyline" || el.type === "leader" || el.type === "hatch") return { ...el, points: (el.points || []).map((p: Point) => ({ x: p.x + dx, y: p.y + dy })) };
  if (el.type === "dimension") return { ...el, x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy };
  return { ...el };
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
    addLayer: storeAddLayer,
    setActiveLayer,
    toggleLayerVisibility,
    toggleLayerLock: storeToggleLayerLock,
    deleteLayer: storeDeleteLayer,
    renameLayer: storeRenameLayer,
    resetEditor,
    blockDefs,
    insertBlock: storeInsertBlock,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    osnapEnabled,
    setOsnapEnabled,
    setCurrentArchitecturalPlan,
    currentArchitecturalPlan,
    moveArchitecturalElement,
    measurements,
    constraints,
    revisionKey,
    importDrawingState,
    mergeDrawingState,
    snapModes,
    permissions,
  } = useDrawingStore();
  const { user } = useAuthStore();
  const isOwner = currentDrawing && user && currentDrawing.user_id === user.id;
  const userPermission = permissions.find(
    (p) => p.user_id === user?.id || p.email === user?.email
  );
  const userRole = isOwner ? "owner" : (userPermission?.role || "viewer");
  const isReadOnly = userRole === "viewer";

  // Intercept layout / layer modifications if read-only
  const insertBlock = useCallback((blockId: string, x: number, y: number) => {
    if (isReadOnly) return;
    storeInsertBlock(blockId, x, y);
  }, [storeInsertBlock, isReadOnly]);

  const addLayer = useCallback((name: string, color: string) => {
    if (isReadOnly) return;
    storeAddLayer(name, color);
  }, [storeAddLayer, isReadOnly]);

  const toggleLayerLock = useCallback((id: string) => {
    if (isReadOnly) return;
    storeToggleLayerLock(id);
  }, [storeToggleLayerLock, isReadOnly]);

  const deleteLayer = useCallback((id: string) => {
    if (isReadOnly) return;
    storeDeleteLayer(id);
  }, [storeDeleteLayer, isReadOnly]);

  const renameLayer = useCallback((id: string, name: string) => {
    if (isReadOnly) return;
    storeRenameLayer(id, name);
  }, [storeRenameLayer, isReadOnly]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPointRef = useRef<Point | null>(null);
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
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([]);
  const [operationPivot, setOperationPivot] = useState<Point | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStreamCount, setAiStreamCount] = useState(0);
  const [currentPolylineId, setCurrentPolylineId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [activeDialog, setActiveDialog] = useState<{
    type: "room-label" | "text" | "leader";
    point: Point;
  } | null>(null);

  const [mouseClientPos, setMouseClientPos] = useState<{ x: number; y: number } | null>(null);
  const [importConfirmDialog, setImportConfirmDialog] = useState<{
    title: string;
    description: string;
    detailSteps?: string[];
    showConvertBtn?: boolean;
    onConvert?: () => void;
    onReplace?: () => void;
    onMerge?: () => void;
  } | null>(null);

  const {
    cursors: collabCursors,
    users: collabUsers,
    connect: collabConnect,
    disconnect: collabDisconnect,
    sendCursor: collabSendCursor,
  } = useCollaborationStore();

  const { isDark } = useThemeStore();

  // Keep ref in sync so getCanvasPoint can read startPoint without a dep change
  useEffect(() => { startPointRef.current = startPoint; }, [startPoint]);

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
        if (isReadOnly) return;
        if (selectedElementIds.length > 0) {
          deleteSelectedElements();
        }
      } else if (cmdOrCtrl && (e.key === 'z' || e.key === 'Z')) {
        if (isReadOnly) return;
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'y' || e.key === 'Y')) {
        if (isReadOnly) return;
        redo();
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'c' || e.key === 'C')) {
        const toCopy = elements.filter(el => selectedElementIds.includes(el.id));
        setCopiedElements(toCopy);
        e.preventDefault();
      } else if (cmdOrCtrl && (e.key === 'v' || e.key === 'V')) {
        if (isReadOnly) return;
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
      } else if (e.key === 'F7' || (cmdOrCtrl && (e.key === 'g' || e.key === 'G'))) {
        setGridVisible(!gridVisible);
        e.preventDefault();
      } else if (e.key === 'F3') {
        setOsnapEnabled(!osnapEnabled);
        e.preventDefault();
      } else if (e.key === 'F9') {
        setSnapEnabled(!snapEnabled);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    elements,
    selectedElementIds,
    copiedElements,
    gridVisible,
    undo,
    redo,
    deleteSelectedElements,
    setTool,
    addElement,
    setSelectedElementIds,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    osnapEnabled,
    setOsnapEnabled,
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

  const autoSave = useCallback(() => {
    if (isReadOnly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveDrawing(); }, 2000);
  }, [saveDrawing, isReadOnly]);

  // Draw everything
  const cadEngine = useRef(new CadEngine()).current;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect()!;
    
    cadEngine.render({
      ctx,
      width: rect.width,
      height: rect.height,
      panOffset,
      zoom,
      gridVisible,
      elements,
      selectedElementIds,
      layers,
      tool,
      isDrawing,
      startPoint,
      dragPoint,
      currentPolylineId,
      snapPoint,
      collabCursors,
      collabUsers,
      blockDefs,
      architecturalPlan: currentArchitecturalPlan,
      isDarkMode: isDark,
    });
  }, [elements, selectedElementIds, tool, panOffset, zoom, layers, isDrawing, startPoint, dragPoint, snapPoint, collabCursors, collabUsers, gridVisible, currentPolylineId, blockDefs, currentArchitecturalPlan, cadEngine, isDark]);

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

      // Apply snapping — threshold is 20 screen pixels converted to world units
      const { snapEnabled, osnapEnabled, snapModes, elements, currentArchitecturalPlan } = useDrawingStore.getState();
      if (snapEnabled || osnapEnabled) {
        const snapThreshold = 20 / zoom; // always ~20px on screen regardless of zoom
        const wallSegs = currentArchitecturalPlan?.walls.map(w => ({
          x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
        }));
        const snapped = findNearestSnap(elements, pt, snapModes, snapThreshold, 12 / zoom, wallSegs, snapEnabled, osnapEnabled, startPointRef.current);
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

    if (isReadOnly && tool !== "pan" && tool !== "select") {
      return;
    }

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
        if (isReadOnly) {
          return;
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

    if (tool === "door") {
      // Find nearest wall
      let nearestWall: any = null;
      let minDistance = Infinity;
      
      const walls = elements.filter(el => el.type === "wall");
      // Also include architectural plan walls if they exist
      const planWalls = currentArchitecturalPlan ? (currentArchitecturalPlan.walls || []).map(w => ({
        id: w.id, type: "wall", start: {x: w.x1, y: w.y1}, end: {x: w.x2, y: w.y2}, thickness: w.thickness
      })) : [];
      
      const allWalls = [...walls, ...planWalls];
      
      for (const w of allWalls) {
        const wStart = (w as any).start as Point | undefined;
        const wEnd = (w as any).end as Point | undefined;
        if (!wStart || !wEnd) continue;
        const dist = pointLineDistance(pt, wStart, wEnd);
        if (dist < minDistance && dist < 50) {
          minDistance = dist;
          nearestWall = w;
        }
      }

      if (nearestWall) {
        const projected = projectPointOnLineSegment(pt, nearestWall.start, nearestWall.end);
        addElement({
          id: genId(),
          type: "opening",
          openingType: "door",
          hostWallId: nearestWall.id,
          position: projected,
          width: 30, // 900mm door equivalent roughly
          swingDirection: "right-in",
          layerId: "A-DOOR"
        });
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

    if (tool === "window") {
      // Find nearest wall to snap window to
      const walls = elements.filter(el => el.type === "wall");
      let nearestWall: any = null;
      let minDist = Infinity;
      for (const w of walls) {
        const wStart = (w as any).start as Point | undefined;
        const wEnd = (w as any).end as Point | undefined;
        if (!wStart || !wEnd) continue;
        const d = pointLineDistance(pt, wStart, wEnd);
        if (d < minDist && d < 60) { minDist = d; nearestWall = w; }
      }
      if (nearestWall) {
        const projected = projectPointOnLineSegment(pt, (nearestWall as any).start, (nearestWall as any).end);
        addElement({ id: genId(), type: "opening", openingType: "window", hostWallId: nearestWall.id, position: projected, width: 12, layerId: "A-WIND" });
      } else {
        insertBlock("window", pt.x, pt.y);
      }
      autoSave();
      return;
    }

    if (tool === "room-label") {
      setActiveDialog({ type: "room-label", point: pt });
      return;
    }

    if (tool === "text") {
      setActiveDialog({ type: "text", point: pt });
      return;
    }

    if (tool === "leader") {
      setActiveDialog({ type: "leader", point: pt });
      return;
    }

    if (tool === "hatch") {
      setIsDrawing(true);
      setStartPoint(pt);
      setDragPoint(pt);
      return;
    }

    if (tool === "copy") {
      if (selectedElementIds.length > 0) {
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
      }
      return;
    }

    if (tool === "rotate" || tool === "scale") {
      if (selectedElementIds.length > 0) {
        const pivot = getSelectionCentroid(elements, selectedElementIds);
        setOperationPivot(pivot);
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
      }
      return;
    }

    // Drawing tools
    setIsDrawing(true);
    setStartPoint(pt);
    setDragPoint(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setMouseClientPos({ x: e.clientX, y: e.clientY });
    // Send cursor position for collaboration
    const canvasPt = getCanvasPoint(e);
    collabSendCursor(canvasPt.x, canvasPt.y);

    if (isPanning && panStart) {
      setSnapPoint(null); // clear snap indicator while panning
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
        if (el.archType && currentArchitecturalPlan) {
          moveArchitecturalElement(id, dx, dy);
          return;
        }
        if (el.type === "rectangle") {
          updateElement(id, { x: el.x! + dx, y: el.y! + dy });
        } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
          updateElement(id, { cx: el.cx! + dx, cy: el.cy! + dy });
        } else if (el.type === "line") {
          updateElement(id, { x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy });
        } else if (el.type === "text" || el.type === "block") {
          updateElement(id, { x: el.x! + dx, y: el.y! + dy });
        } else if (el.type === "wall") {
          const s = (el as any).start, e2 = (el as any).end;
          if (s && e2) updateElement(id, { start: { x: s.x + dx, y: s.y + dy }, end: { x: e2.x + dx, y: e2.y + dy } } as any);
        } else if (el.type === "polyline" || el.type === "leader" || el.type === "hatch") {
          updateElement(id, { points: (el.points || []).map((p: Point) => ({ x: p.x + dx, y: p.y + dy })) });
        } else if (el.type === "dimension") {
          updateElement(id, { x1: el.x1! + dx, y1: el.y1! + dy, x2: el.x2! + dx, y2: el.y2! + dy });
        }
      });
      setDragStart(pt);
      return;
    }

    if (isDrawing) {
      setDragPoint(canvasPt);
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
      autoSave();
      return;
    }

    // Copy: create offset duplicates of selected elements
    if (tool === "copy" && isDrawing && startPoint) {
      const pt2 = getCanvasPoint(e);
      const dx = pt2.x - startPoint.x;
      const dy = pt2.y - startPoint.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        const newIds: string[] = [];
        selectedElementIds.forEach(id => {
          const orig = elements.find(el => el.id === id);
          if (!orig) return;
          const newEl = { ...offsetElement(orig, dx, dy), id: genId() };
          addElement(newEl);
          newIds.push(newEl.id);
        });
        setSelectedElementIds(newIds);
        autoSave();
      }
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      return;
    }

    // Rotate: apply geometric rotation to selected elements around their centroid
    if (tool === "rotate" && isDrawing && startPoint && operationPivot) {
      const pt2 = getCanvasPoint(e);
      const baseAngle = Math.atan2(startPoint.y - operationPivot.y, startPoint.x - operationPivot.x);
      const newAngle = Math.atan2(pt2.y - operationPivot.y, pt2.x - operationPivot.x);
      const delta = newAngle - baseAngle;
      if (Math.abs(delta) > 0.01) {
        selectedElementIds.forEach(id => {
          const el = elements.find(e2 => e2.id === id);
          if (!el) return;
          const updates = applyElementRotation(el, operationPivot, delta);
          if (Object.keys(updates).length > 0) updateElement(id, updates as any);
        });
        autoSave();
      }
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setOperationPivot(null);
      return;
    }

    // Scale: apply geometric scale to selected elements from their centroid
    if (tool === "scale" && isDrawing && startPoint && operationPivot) {
      const pt2 = getCanvasPoint(e);
      const baseDist = Math.hypot(startPoint.x - operationPivot.x, startPoint.y - operationPivot.y);
      const newDist = Math.hypot(pt2.x - operationPivot.x, pt2.y - operationPivot.y);
      const factor = baseDist > 1 ? newDist / baseDist : 1;
      if (Math.abs(factor - 1) > 0.01) {
        selectedElementIds.forEach(id => {
          const el = elements.find(e2 => e2.id === id);
          if (!el) return;
          const updates = applyElementScale(el, operationPivot, factor);
          if (Object.keys(updates).length > 0) updateElement(id, updates as any);
        });
        autoSave();
      }
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setOperationPivot(null);
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
      } else if (tool === "wall") {
        el = { id: genId(), type: "wall", start: { x: startPoint.x, y: startPoint.y }, end: { x: pt.x, y: pt.y }, thickness: 20, layerId: "A-WALL" };
      } else if (tool === "rectangle") {
        el = { id: genId(), type: "rectangle", x: Math.min(startPoint.x, pt.x), y: Math.min(startPoint.y, pt.y), width: Math.abs(dx), height: Math.abs(dy), strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", layerId: activeLayerId };
      } else if (tool === "circle") {
        const r = Math.hypot(dx, dy);
        el = { id: genId(), type: "circle", cx: startPoint.x, cy: startPoint.y, radius: r, strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", layerId: activeLayerId };
      } else if (tool === "dimension") {
        el = { id: genId(), type: "dimension", x1: startPoint.x, y1: startPoint.y, x2: pt.x, y2: pt.y, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId };
      } else if (tool === "arc") {
        const r = Math.hypot(dx, dy);
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        el = { id: genId(), type: "arc", cx: startPoint.x, cy: startPoint.y, radius: r, startAngle: angleDeg - 90, endAngle: angleDeg + 90, strokeColor: "#1f2937", strokeWidth: 2, layerId: activeLayerId };
      } else if (tool === "polygon") {
        const r = Math.hypot(dx, dy);
        const sides = 6;
        const pts: Point[] = [];
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * 2 * Math.PI - Math.PI / 2;
          pts.push({ x: startPoint.x + r * Math.cos(a), y: startPoint.y + r * Math.sin(a) });
        }
        el = { id: genId(), type: "polyline", points: pts, closed: true, strokeColor: "#1f2937", strokeWidth: 2, layerId: activeLayerId };
      } else if (tool === "ellipse") {
        el = { id: genId(), type: "ellipse", cx: startPoint.x + dx / 2, cy: startPoint.y + dy / 2, rx: Math.abs(dx) / 2, ry: Math.abs(dy) / 2, strokeColor: "#1f2937", strokeWidth: 2, fillColor: "transparent", layerId: activeLayerId };
      } else if (tool === "stair") {
        const steps = Math.max(3, Math.round(Math.abs(dy) / 20));
        const stepH = dy / steps;
        const pts: Point[] = [];
        for (let i = 0; i <= steps; i++) {
          if (i % 2 === 0) {
            pts.push({ x: startPoint.x, y: startPoint.y + i * stepH });
            pts.push({ x: startPoint.x + dx, y: startPoint.y + i * stepH });
          } else {
            pts.push({ x: startPoint.x + dx, y: startPoint.y + i * stepH });
            pts.push({ x: startPoint.x, y: startPoint.y + i * stepH });
          }
        }
        el = { id: genId(), type: "polyline", points: pts, strokeColor: "#111827", strokeWidth: 1.5, layerId: "A-WALL" };
      }

      if (el && tool !== "polyline") {
        addElement(el);
        autoSave();
      }
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
        autoSave();
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
        autoSave();
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setDragPoint(null);
    setTextInput(null);
  };

  const handleMouseLeave = () => {
    if (isDrawing && tool !== "polyline") {
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
    }
    setIsPanning(false);
    setPanStart(null);
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
    const action = resolveCanvasDropAction({
      blockId: e.dataTransfer.getData("blockId"),
      toolId: e.dataTransfer.getData("toolId"),
      point,
    });
    if (action.kind === "insert-block") {
      insertBlock(action.blockId, action.point.x, action.point.y);
      autoSave();
      return;
    }
    if (action.kind === "insert-element") {
      const element = buildDroppedToolElement({
        tool: action.tool,
        point: action.point,
        layerId: activeLayerId,
        id: genId(),
      });
      if (!element) return;
      addElement(element);
      setTool(action.tool);
      autoSave();
    }
  };

  const handleDoubleClick = () => {
    if (tool === "polyline" && currentPolylineId) {
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setCurrentPolylineId(null);
      autoSave();
    }
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
    } else if (format === "dxf") {
      const dxfContent = elementsToDxf(elements);
      const blob = new Blob([dxfContent], { type: "application/dxf" });
      const link = document.createElement("a");
      link.download = `${drawingName || "drawing"}.dxf`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } else if (format === "json") {
      const doc: DrawingDocument = {
        fileType: "ARCH-TECH-CAD-DOCUMENT",
        version: 1,
        elements,
        layers,
        activeLayerId,
        blockDefs,
        currentArchitecturalPlan,
        measurements,
        constraints,
      };
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.download = `${drawingName || "drawing"}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  const handleImportJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { alert("Invalid JSON file"); return; }

      let doc: DrawingDocument;
      if (Array.isArray(parsed)) {
        doc = {
          fileType: "ARCH-TECH-CAD-DOCUMENT", version: 1,
          elements: parsed as DrawingElement[],
          layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
          activeLayerId: "layer-1", blockDefs: {},
          currentArchitecturalPlan: null, measurements: [], constraints: [],
        };
      } else if ((parsed as any)?.fileType === "ARCH-TECH-CAD-DOCUMENT") {
        doc = parsed as DrawingDocument;
      } else if ((parsed as any)?.elements) {
        const p = parsed as any;
        doc = {
          fileType: "ARCH-TECH-CAD-DOCUMENT", version: 1,
          elements: p.elements || [],
          layers: p.layers || [{ id: "layer-1", name: "Layer 1", visible: true, locked: false }],
          activeLayerId: p.activeLayerId || "layer-1",
          blockDefs: p.blockDefs || {},
          currentArchitecturalPlan: p.currentArchitecturalPlan || null,
          measurements: p.measurements || [], constraints: p.constraints || [],
        };
      } else {
        alert("Unrecognized file format"); return;
      }

      setImportConfirmDialog({
        title: "Import JSON Drawing",
        description: "Replace the current drawing or merge the imported JSON elements alongside existing ones?",
        onReplace: () => {
          importDrawingState(doc);
          setImportConfirmDialog(null);
        },
        onMerge: () => {
          mergeDrawingState(doc);
          setImportConfirmDialog(null);
        }
      });
    };
    input.click();
  };

  const handleImportDxf = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dxf,.dwg,.dwf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "dwg" || extension === "dwf") {
        setImportConfirmDialog({
          title: `${extension.toUpperCase()} Format Not Supported`,
          description: `${extension.toUpperCase()} is a proprietary binary format and cannot be read directly. Convert it to DXF first, then use "Import DXF":`,
          detailSteps: [
            "AutoCAD: File → Save As → select .dxf format",
            "LibreCAD (free): open the file → Export → DXF",
            'ODA File Converter (free): opendesign.com → "ODA File Converter"',
            "Online: cloudconvert.com or anyconv.com (DWG → DXF)",
          ],
        });
        return;
      }

      const text = await file.text();
      try {
        const importedElements = dxfToElements(text);
        if (importedElements.length === 0) {
          alert("No elements found in this DXF file.");
          return;
        }

        const layers = [{ id: "0", name: "0", visible: true, locked: false }];
        const doc: DrawingDocument = {
          fileType: "ARCH-TECH-CAD-DOCUMENT",
          version: 1,
          elements: importedElements,
          layers,
          activeLayerId: "0",
          blockDefs: {},
          currentArchitecturalPlan: null,
          measurements: [],
          constraints: [],
        };

        setImportConfirmDialog({
          title: "Import DXF Drawing",
          description: "Replace the current drawing or merge the imported DXF elements alongside existing ones?",
          onReplace: () => {
            importDrawingState(doc);
            setImportConfirmDialog(null);
          },
          onMerge: () => {
            mergeDrawingState(doc);
            setImportConfirmDialog(null);
          }
        });
      } catch (err) {
        console.error(err);
        alert("Failed to parse DXF file.");
      }
    };
    input.click();
  };

  const handleConfirmAnnotation = (payload: AnnotationConfirmPayload) => {
    if (!activeDialog) return;
    const { point } = activeDialog;

    if (payload.type === "room-label") {
      const nameText = payload.roomLabel?.trim() || "Room";
      const areaVal = payload.roomArea?.trim();
      const finalLabel = areaVal ? `${nameText} (${areaVal} m²)` : nameText;
      
      addElement({
        id: genId(),
        type: "text",
        text: finalLabel,
        x: point.x,
        y: point.y,
        fontSize: 14,
        strokeColor: isDark ? "#cbd5e1" : "#0F172A",
        layerId: "A-ROOM",
        roomType: payload.roomType || "bedroom",
      });
      autoSave();
    } else if (payload.type === "text") {
      const txt = payload.textContent?.trim();
      if (txt) {
        addElement({
          id: genId(),
          type: "text",
          text: txt,
          x: point.x,
          y: point.y,
          fontSize: payload.textSize || 16,
          strokeColor: payload.textColor || (isDark ? "#ffffff" : "#1f2937"),
          layerId: activeLayerId,
        });
        autoSave();
      }
    } else if (payload.type === "leader") {
      const txt = payload.textContent?.trim() || "";
      setIsDrawing(true);
      setStartPoint(point);
      setDragPoint(point);
      setTextInput(txt);
    }
    
    setActiveDialog(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedElementIds.length > 0) deleteSelectedElements();
    }
    if (e.key === "F7") {
      e.preventDefault();
      setGridVisible(!gridVisible);
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.key === "g") { e.preventDefault(); setGridVisible(!gridVisible); }
    }
  };

  const mirrorSelected = (axis: "h" | "v") => {
    if (selectedElementIds.length === 0) return;
    const pivot = getSelectionCentroid(elements, selectedElementIds);
    selectedElementIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (!el) return;
      let updates: Partial<DrawingElement> = {};
      const mirrorPt = (p: Point): Point =>
        axis === "h" ? { x: 2 * pivot.x - p.x, y: p.y } : { x: p.x, y: 2 * pivot.y - p.y };

      if (el.type === "line") {
        const p1 = mirrorPt({ x: el.x1!, y: el.y1! });
        const p2 = mirrorPt({ x: el.x2!, y: el.y2! });
        updates = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
        const c = mirrorPt({ x: el.cx!, y: el.cy! });
        updates = { cx: c.x, cy: c.y };
      } else if (el.type === "rectangle" || el.type === "text") {
        const p = mirrorPt({ x: el.x!, y: el.y! });
        updates = { x: p.x, y: p.y };
      } else if (el.type === "wall") {
        const s = (el as any).start, e2 = (el as any).end;
        updates = { start: mirrorPt(s), end: mirrorPt(e2) } as any;
      } else if (el.type === "polyline" || el.type === "leader" || el.type === "hatch") {
        updates = { points: (el.points || []).map((p: Point) => mirrorPt(p)) };
      } else if (el.type === "dimension") {
        const p1 = mirrorPt({ x: el.x1!, y: el.y1! });
        const p2 = mirrorPt({ x: el.x2!, y: el.y2! });
        updates = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (Object.keys(updates).length > 0) updateElement(id, updates as any);
    });
    autoSave();
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

  const canvasCursor = tool === "pan"
    ? (isPanning ? "cursor-grabbing" : "cursor-grab")
    : (tool === "select" ? "cursor-default" : "cursor-crosshair");

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0B0E14] transition-colors duration-300 text-slate-700 dark:text-gray-300 font-sans selection:bg-cyan-500/30 selection:text-cyan-50" onKeyDown={handleKeyDown} tabIndex={0}>
      <EditorHeader
        onBack={handleBack}
        show3D={show3D}
        setShow3D={setShow3D}
        onImportDxf={handleImportDxf}
        onImportJson={handleImportJson}
        onExportCanvas={exportCanvas}
        onSave={handleSave}
        saveStatus={saveStatus}
      />

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Full CAD Sidebar Wrapper */}
        <div 
          className="transition-all duration-300 ease-in-out overflow-hidden flex shrink-0"
          style={{ width: sidebarCollapsed ? "0px" : "220px" }}
        >
          <CadSidebar
            tool={tool}
            setTool={(t) => {
              if (isReadOnly && t !== "pan" && t !== "select") {
                return;
              }
              setTool(t as ToolType);
            }}
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
            panOffset={panOffset}
            setPanOffset={setPanOffset}
            insertBlock={insertBlock}
            selectedElement={selectedElementIds.length > 0 ? elements.find(e => e.id === selectedElementIds[0]) : undefined}
            onExportSvg={() => exportCanvas("svg")}
            onExportPng={() => exportCanvas("png")}
            onExportDxf={() => exportCanvas("dxf")}
            onExportJson={() => exportCanvas("json")}
            onImportJson={handleImportJson}
            onImportDxf={handleImportDxf}
            addElements={(els) => addElements(els.map(el => ({ ...el, layerId: el.layerId || activeLayerId })))}
            authToken={useAuthStore.getState().token ?? undefined}
            onMirrorH={() => mirrorSelected("h")}
            onMirrorV={() => mirrorSelected("v")}
          />
        </div>

        {/* Sidebar Toggle Handle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 z-30 w-4 h-16 bg-slate-800/80 dark:bg-[#151B23]/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 hover:bg-cyan-500 hover:text-white dark:hover:bg-cyan-500 rounded-r-md flex items-center justify-center text-slate-400 dark:text-slate-505 transition-all duration-300 ease-in-out shadow-md"
          style={{ left: sidebarCollapsed ? "0px" : "220px" }}
          title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          <span className="text-[10px] font-bold select-none">{sidebarCollapsed ? "▶" : "◀"}</span>
        </button>

        {/* Canvas Area */}
        <div 
          ref={containerRef} 
          className="flex-1 relative overflow-hidden bg-white dark:bg-[#0B0E14] transition-colors duration-300 pb-8"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const point = {
              x: (e.clientX - rect.left - panOffset.x) / zoom,
              y: (e.clientY - rect.top - panOffset.y) / zoom,
            };
            const action = resolveCanvasDropAction({
              blockId: e.dataTransfer.getData("blockId"),
              toolId: e.dataTransfer.getData("toolId"),
              point,
            });

            if (action.kind === "insert-block") {
              insertBlock(action.blockId, action.point.x, action.point.y);
              return;
            }

            if (action.kind === "insert-element") {
              const element = buildDroppedToolElement({
                tool: action.tool,
                point: action.point,
                layerId: activeLayerId,
                id: genId(),
              });
              if (!element) return;

              addElement(element);
              setTool(action.tool);
              autoSave();
            }
          }}
        >
          {/* AI Streaming Status Banner */}
          {isAiLoading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-sm border border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.3)] pointer-events-none">
              <svg className="animate-spin w-4 h-4 text-cyan-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {aiStreamCount > 0
                  ? <><span className="text-cyan-400">{aiStreamCount}</span> entities drawn — streaming<span className="animate-pulse">...</span></>
                  : <>AI is thinking<span className="animate-pulse">...</span></>
                }
              </span>
              {aiStreamCount > 0 && (
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: `${i * 100}ms`}} />
                  ))}
                </div>
              )}
            </div>
          )}



          {!show3D && !showPaperSpace && (
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${canvasCursor}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={handleCanvasDrop}
            />
          )}

          <DrawingHUD
            isDrawing={isDrawing}
            startPoint={startPoint}
            dragPoint={dragPoint}
            mouseClientPos={mouseClientPos}
            snapPoint={snapPoint}
          />

          <StatusBar
            orthoEnabled={orthoEnabled}
            setOrthoEnabled={setOrthoEnabled}
            snapPoint={snapPoint}
            mouseClientPos={mouseClientPos}
          />

          {/* Lazy loaded heavy components */}
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-cyan-400 z-30 font-mono text-xs">Loading 3D Viewer...</div>}>
            <ThreeViewer elements={elements} plan={currentArchitecturalPlan} blockDefs={blockDefs} visible={show3D} revisionKey={revisionKey} />
          </Suspense>

          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-cyan-400 z-30 font-mono text-xs">Loading Paper Layout...</div>}>
            <PaperSpace elements={elements} visible={showPaperSpace} onClose={() => setShowPaperSpace(false)} />
          </Suspense>

          {/* Custom Annotation Modal */}
          {activeDialog && (
            <AnnotationDialog
              activeDialog={activeDialog}
              onClose={() => setActiveDialog(null)}
              onConfirm={handleConfirmAnnotation}
            />
          )}

          {importConfirmDialog && (
            <ImportConfirmDialog
              dialog={importConfirmDialog}
              onClose={() => setImportConfirmDialog(null)}
            />
          )}

          {/* Top Right Widget (TOP) */}
          <div className="absolute top-6 right-6 w-16 h-16 bg-slate-50 dark:bg-[#151B23] transition-colors duration-300/90 backdrop-blur border border-slate-200 dark:border-[#1E293B] rounded flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer z-20 shadow-lg">
            <span className="text-[8px] font-bold text-cyan-400 mb-1">TOP</span>
            <div className="w-6 h-6 border-2 border-cyan-500/50 transform rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 border border-cyan-400"></div>
            </div>
          </div>

          {!isReadOnly && (
            <AiCommandBox
              isAiLoading={isAiLoading}
              setIsAiLoading={setIsAiLoading}
              aiStreamCount={aiStreamCount}
              setAiStreamCount={setAiStreamCount}
            />
          )}
        </div>

        {/* Properties Palette - floats over the entire workspace */}
        <PropertyPanel />
      </div>

      {/* Bottom Footer Console */}
      <footer className="h-8 bg-white dark:bg-[#0B0E14] transition-colors duration-300 border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between px-4 shrink-0 overflow-hidden text-[9px] font-mono">
        <div className="flex items-center space-x-4 h-full">
          <span className="font-bold text-yellow-500 tracking-wider">ARCH-TECH COMMAND LINE [AI ENABLED]</span>
          <span className="text-slate-400 dark:text-gray-500 font-medium tracking-wide">&gt; ZOOM {(zoom*100).toFixed(0)}% COMPLETED &gt; LAYER "{activeLayer?.name || "Structural_Walls"}" SELECTED</span>
        </div>
        
        <div className="flex items-center space-x-6 text-slate-500 dark:text-gray-400 font-bold tracking-wider">
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Logs</span>
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Units (mm)</span>
          <span className="hover:text-gray-200 cursor-pointer transition-colors">Grid (10mm)</span>
        </div>
      </footer>
    </div>
  );
}
