import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { useCollaborationStore } from "../stores/collaborationStore";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import { appDialog } from "../stores/dialogStore";
import CadSidebar from "../components/CadSidebar";
import { Point, ToolType, DrawingElement, DrawingDocument } from "../types";
import { findNearestSnap, SnapResult } from "../canvas/snap";
import { CadEngine } from "../canvas/CadEngine";
import { WebGl2dRenderer } from "../canvas/renderers/WebGl2dRenderer";
import { elementsToDxf, dxfToElements, parseDxfInsUnits, summarizeDxfLayers, scaleElements } from "../canvas/dxf";
import { unitFactorToMm } from "../canvas/dxf.units";
import { getPlanBounds } from "../canvas/3d/geometry/planClassification";
import { DxfImportWizard, type DxfImportResult } from "./CanvasEditor/components/DxfImportWizard";
import { pointLineDistance, projectPointOnLineSegment } from "../core/geometry";
import { buildDroppedToolElement, resolveCanvasDropAction } from "../canvas/drop";
import { applyGripDrag } from "../canvas/grips";
import { getConstrainedWallPoint, createWallElement } from "../tools/wallTool";
import { findNearestWall, createOpeningElement } from "../tools/openingTool";

// Newly extracted subcomponents
import { EditorHeader } from "./CanvasEditor/components/EditorHeader";
import { StatusBar } from "./CanvasEditor/components/StatusBar";
import { DrawingHUD } from "./CanvasEditor/components/DrawingHUD";
import { AnnotationDialog, AnnotationConfirmPayload } from "./CanvasEditor/components/AnnotationDialog";
import { ImportConfirmDialog } from "./CanvasEditor/components/ImportConfirmDialog";
import { AiCommandBox } from "./CanvasEditor/components/AiCommandBox";
import { PropertyPanel } from "./CanvasEditor/components/PropertyPanel";
import EstimationDashboard from "./CanvasEditor/components/EstimationDashboard";
// Extracted utilities
import { genId } from "./CanvasEditor/utils/idGen";
import { elementInBox, elementFullyInBox, getShapeAtPoint, checkGripHit } from "./CanvasEditor/utils/hitDetection";
import { getSelectionCentroid, applyElementRotation, applyElementScale, offsetElement, breakElement } from "./CanvasEditor/utils/elementTransforms";
// Extracted hooks
import { useEditSession } from "./CanvasEditor/hooks/useEditSession";
import { usePermissions } from "./CanvasEditor/hooks/usePermissions";
import { lazyWithRetry } from "../utils/lazyWithRetry";
import { ChunkErrorBoundary } from "../components/ChunkErrorBoundary";

// Lazy-loaded heavy components. lazyWithRetry recovers from stale chunk fetches
// after a redeploy ("Failed to fetch dynamically imported module").
const ThreeViewer = lazyWithRetry(() => import("../components/ThreeViewer"), "ThreeViewer");
const PaperSpace = lazyWithRetry(() => import("../components/PaperSpace"), "PaperSpace");

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
    duplicateLayer: storeDuplicateLayer,
    resetEditor,
    blockDefs,
    insertBlock: storeInsertBlock,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    osnapEnabled,
    setOsnapEnabled,
    currentArchitecturalPlan,
    moveArchitecturalElement,
    measurements,
    constraints,
    revisionKey,
    importDrawingState,
    mergeDrawingState,
    permissions,
  } = useDrawingStore();
  const { user, token } = useAuthStore();
  const { isReadOnly, insertBlock, addLayer, toggleLayerLock, deleteLayer, renameLayer, duplicateLayer } = usePermissions({
    currentDrawing,
    user,
    permissions,
    storeInsertBlock,
    storeAddLayer,
    storeToggleLayerLock,
    storeDeleteLayer,
    storeRenameLayer,
    storeDuplicateLayer,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [turboMode, setTurboMode] = useState(false);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGl2dRenderer | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);
  const importDxfInputRef = useRef<HTMLInputElement>(null);
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
  const [showEstimation, setShowEstimation] = useState(false);
  const [hasShown3D, setHasShown3D] = useState(false);
  useEffect(() => {
    if (show3D) {
      setHasShown3D(true);
    }
  }, [show3D]);
  const [showPaperSpace, setShowPaperSpace] = useState(false);
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [copiedElements, setCopiedElements] = useState<DrawingElement[]>([]);
  const [operationPivot, setOperationPivot] = useState<Point | null>(null);
  const [typedValue, setTypedValue] = useState<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { queueEditAction } = useEditSession(drawingId, token);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStreamCount, setAiStreamCount] = useState(0);
  const [currentPolylineId, setCurrentPolylineId] = useState<string | null>(null);
  const [currentSplineId, setCurrentSplineId] = useState<string | null>(null);
  const [markCounter, setMarkCounter] = useState(1);
  const [filletFirstId, setFilletFirstId] = useState<string | null>(null);
  const [chamferFirstId, setChamferFirstId] = useState<string | null>(null);
  const [angularVertex, setAngularVertex] = useState<Point | null>(null);
  const [angularPoint1, setAngularPoint1] = useState<Point | null>(null);
  const [stretchBoxStart, setStretchBoxStart] = useState<Point | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [boxSelectStart, setBoxSelectStart] = useState<Point | null>(null);
  const [boxSelectCurrent, setBoxSelectCurrent] = useState<Point | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const activeGripRef = useRef<{ elementId: string; gripIndex: number } | null>(null);

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
  const [dxfWizard, setDxfWizard] = useState<{
    fileName: string;
    elements: DrawingElement[];
    layers: ReturnType<typeof summarizeDxfLayers>;
    detectedUnit: ReturnType<typeof parseDxfInsUnits>;
    bbox: { width: number; height: number } | null;
  } | null>(null);
  const setDxfLayerOverride = useDrawingStore((s) => s.setDxfLayerOverride);

  // RAG upload prompt after DXF import
  const [ragUploadPrompt, setRagUploadPrompt] = useState<{
    fileName: string;
    file: File;
    status: 'prompt' | 'uploading' | 'success' | 'error';
    message?: string;
  } | null>(null);
  const pendingDxfFileRef = useRef<File | null>(null);

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
      loadDrawing(drawingId).then(() => {
        // Auto-fit viewport after drawing loads (initial open or page refresh)
        const loaded = useDrawingStore.getState().elements;
        if (loaded.length > 0) {
          // Wait for canvas to be painted and have correct dimensions
          setTimeout(() => fitToElements(loaded), 300);
        }
      });
    }
    return () => resetEditor();
  }, [drawingId]);

  useEffect(() => {
    const canvas = turboMode ? webglCanvasRef.current : canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const { zoom: currentZoom, panOffset: currentPan } = useDrawingStore.getState();
      const newZoom = Math.max(0.001, Math.min(4, currentZoom * delta));

      // Zoom toward the mouse cursor:
      // world = (screen - pan) / zoom → after zoom: newPan = screen - world * newZoom
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = (mouseX - currentPan.x) / currentZoom;
      const worldY = (mouseY - currentPan.y) / currentZoom;
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleNativeWheel);
    };
  }, [setZoom, setPanOffset, turboMode]);

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
        } else if (tool === "spline" && currentSplineId) {
          setIsDrawing(false);
          setStartPoint(null);
          setDragPoint(null);
          setCurrentSplineId(null);
          if (e.key === 'Escape') setTool("select");
        } else if (e.key === 'Escape') {
          setTool("select");
          setIsDrawing(false);
          setStartPoint(null);
          setDragPoint(null);
          setFilletFirstId(null);
          setChamferFirstId(null);
          setAngularVertex(null);
          setAngularPoint1(null);
          setStretchBoxStart(null);
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
    tool,
    currentSplineId,
    currentPolylineId,
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
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    if (turboMode) {
      const canvas = webglCanvasRef.current;
      if (!canvas) return;
      const gl = canvas.getContext("webgl2");
      if (!gl) return;
      const rect = canvas.getBoundingClientRect()!;
      if (!webglRendererRef.current) {
        webglRendererRef.current = new WebGl2dRenderer(gl);
      }
      webglRendererRef.current.render(
        rect.width,
        rect.height,
        panOffset,
        zoom,
        elements,
        layers,
        selectedElementIds,
        isDark
      );
    } else {
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
        hoveredElementId,
        collabCursors,
        collabUsers,
        blockDefs,
        architecturalPlan: currentArchitecturalPlan,
        isDarkMode: isDark,
        operationPivot,
        typedValue,
      });
    }
  }, [elements, selectedElementIds, tool, panOffset, zoom, layers, isDrawing, startPoint, dragPoint, snapPoint, hoveredElementId, collabCursors, collabUsers, gridVisible, currentPolylineId, blockDefs, currentArchitecturalPlan, cadEngine, isDark, operationPivot, typedValue, turboMode]);

  useEffect(() => {
    // RAF throttle: coalesce multiple rapid state changes into one frame redraw
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);


  useEffect(() => {
    if (!isDrawing) {
      setTypedValue("");
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      if (e.key === "Escape") {
        setTypedValue("");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (typedValue) {
          const val = parseFloat(typedValue);
          if (!isNaN(val)) {
            finalizeWithTypedValue(val);
          }
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        setTypedValue((prev) => prev.slice(0, -1));
        return;
      }

      if (/^[0-9.-]$/.test(e.key)) {
        e.preventDefault();
        setTypedValue((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawing, typedValue, tool, operationPivot, selectedElementIds, elements, startPoint, dragPoint, currentArchitecturalPlan, activeLayerId]);

  const finalizeWithTypedValue = useCallback((val: number) => {
    if (!startPoint) return;
    
    // For rotate
    if (tool === "rotate" && operationPivot) {
      const delta = (val * Math.PI) / 180;
      selectedElementIds.forEach(id => {
        const el = elements.find(e2 => e2.id === id);
        if (!el) return;
        const updates = applyElementRotation(el, operationPivot, delta);
        if (Object.keys(updates).length > 0) updateElement(id, updates as any);
      });
      autoSave();
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setOperationPivot(null);
      setTypedValue("");
      return;
    }

    // For scale
    if (tool === "scale" && operationPivot) {
      selectedElementIds.forEach(id => {
        const el = elements.find(e2 => e2.id === id);
        if (!el) return;
        const updates = applyElementScale(el, operationPivot, val);
        if (Object.keys(updates).length > 0) updateElement(id, updates as any);
      });
      autoSave();
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setOperationPivot(null);
      setTypedValue("");
      return;
    }

    // For move, copy, lines, walls, rectangles, circles, dimensions
    const drag = dragPoint || startPoint;
    const dx = drag.x - startPoint.x;
    const dy = drag.y - startPoint.y;
    const dist = Math.hypot(dx, dy);
    
    const ux = dist > 0.1 ? dx / dist : 1;
    const uy = dist > 0.1 ? dy / dist : 0;
    const targetPixels = val * 100; // 1 unit = 100 pixels
    const finalPt = {
      x: startPoint.x + ux * targetPixels,
      y: startPoint.y + uy * targetPixels
    };

    if (tool === "move") {
      const shiftX = finalPt.x - startPoint.x;
      const shiftY = finalPt.y - startPoint.y;
      selectedElementIds.forEach((id) => {
        const el = elements.find((e) => e.id === id);
        if (!el) return;
        if (el.archType && currentArchitecturalPlan) {
          moveArchitecturalElement(id, shiftX, shiftY);
          return;
        }
        if (el.type === "rectangle") {
          updateElement(id, { x: el.x! + shiftX, y: el.y! + shiftY });
        } else if (el.type === "circle" || el.type === "arc" || el.type === "ellipse") {
          updateElement(id, { cx: el.cx! + shiftX, cy: el.cy! + shiftY });
        } else if (el.type === "line") {
          updateElement(id, { x1: el.x1! + shiftX, y1: el.y1! + shiftY, x2: el.x2! + shiftX, y2: el.y2! + shiftY });
        } else if (el.type === "text" || el.type === "block") {
          updateElement(id, { x: el.x! + shiftX, y: el.y! + shiftY });
        } else if (el.type === "wall") {
          const s = (el as any).start, e2 = (el as any).end;
          if (s && e2) updateElement(id, { start: { x: s.x + shiftX, y: s.y + shiftY }, end: { x: e2.x + shiftX, y: e2.y + shiftY } } as any);
        } else if (el.type === "polyline" || el.type === "leader" || el.type === "hatch") {
          updateElement(id, { points: (el.points || []).map((p: Point) => ({ x: p.x + shiftX, y: p.y + shiftY })) });
        } else if (el.type === "dimension") {
          updateElement(id, { x1: el.x1! + shiftX, y1: el.y1! + shiftY, x2: el.x2! + shiftX, y2: el.y2! + shiftY });
        }
      });
      queueEditAction({ type: "move", ids: selectedElementIds });
      autoSave();
    } else if (tool === "copy") {
      const shiftX = finalPt.x - startPoint.x;
      const shiftY = finalPt.y - startPoint.y;
      const newIds: string[] = [];
      selectedElementIds.forEach(id => {
        const orig = elements.find(el => el.id === id);
        if (!orig) return;
        const newEl = { ...offsetElement(orig, shiftX, shiftY), id: genId() };
        addElement(newEl);
        newIds.push(newEl.id);
      });
      setSelectedElementIds(newIds);
      autoSave();
    } else if (tool === "line" || tool === "wall") {
      addElement({
        id: genId(),
        type: tool,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: finalPt.x,
        y2: finalPt.y,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId: activeLayerId,
        ...(tool === "wall" ? { start: startPoint, end: finalPt, thickness: 15 } : {})
      } as any);
      autoSave();
    } else if (tool === "rectangle") {
      const w = finalPt.x - startPoint.x;
      const h = finalPt.y - startPoint.y;
      addElement({
        id: genId(),
        type: "rectangle",
        x: Math.min(startPoint.x, finalPt.x),
        y: Math.min(startPoint.y, finalPt.y),
        width: Math.abs(w),
        height: Math.abs(h),
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId: activeLayerId
      });
      autoSave();
    } else if (tool === "circle") {
      const r = Math.hypot(finalPt.x - startPoint.x, finalPt.y - startPoint.y);
      addElement({
        id: genId(),
        type: "circle",
        cx: startPoint.x,
        cy: startPoint.y,
        r,
        strokeColor: "#1f2937",
        strokeWidth: 2,
        layerId: activeLayerId
      });
      autoSave();
    } else if (tool === "dimension") {
      addElement({
        id: genId(),
        type: "dimension",
        x1: startPoint.x,
        y1: startPoint.y,
        x2: finalPt.x,
        y2: finalPt.y,
        offset: 30,
        strokeColor: "#3b82f6",
        strokeWidth: 1,
        layerId: activeLayerId
      });
      autoSave();
    }

    setIsDrawing(false);
    setStartPoint(null);
    setDragPoint(null);
    setOperationPivot(null);
    setTypedValue("");
    setTool("select");
  }, [tool, operationPivot, selectedElementIds, elements, startPoint, dragPoint, currentArchitecturalPlan, activeLayerId, addElement, updateElement, autoSave, queueEditAction, setTool]);

  const handleRotate90 = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    const pivot = getSelectionCentroid(elements, selectedElementIds);
    const delta = Math.PI / 2; // 90 deg clockwise
    selectedElementIds.forEach(id => {
      const el = elements.find(e2 => e2.id === id);
      if (!el) return;
      const updates = applyElementRotation(el, pivot, delta);
      if (Object.keys(updates).length > 0) updateElement(id, updates as any);
    });
    autoSave();
  }, [selectedElementIds, elements, updateElement, autoSave]);

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
      const canvas = e.currentTarget || (turboMode ? webglCanvasRef.current : canvasRef.current);
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
        // For large drawings, pre-filter elements within snap range to avoid iterating all elements
        const snapRange = snapThreshold * 4;
        const snapElements = elements.length > 5000
          ? elements.filter(el => {
              if (el.type === "line") return Math.min(Math.abs(el.x1! - pt.x), Math.abs(el.x2! - pt.x)) < snapRange && Math.min(Math.abs(el.y1! - pt.y), Math.abs(el.y2! - pt.y)) < snapRange;
              const cx = (el as any).cx ?? (el as any).x ?? 0;
              const cy = (el as any).cy ?? (el as any).y ?? 0;
              return Math.abs(cx - pt.x) < snapRange && Math.abs(cy - pt.y) < snapRange;
            })
          : elements;
        const snapped = findNearestSnap(snapElements, pt, snapModes, snapThreshold, 12 / zoom, wallSegs, snapEnabled, osnapEnabled, startPointRef.current);
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

    if ((tool === "select" || tool === "move") && selectedElementIds.length > 0) {
      const grip = checkGripHit(pt, elements, selectedElementIds, zoom);
      if (grip) {
        activeGripRef.current = grip;
        return;
      }
    }

    if (tool === "select" || tool === "move" || tool === "copy" || tool === "rotate" || tool === "scale") {
      const pickable = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickable, pt.x, pt.y);

      if (hit) {
        let activeIds = selectedElementIds;
        if (e.shiftKey) {
          activeIds = selectedElementIds.includes(hit.id)
            ? selectedElementIds.filter(id => id !== hit.id)
            : [...selectedElementIds, hit.id];
          setSelectedElementIds(activeIds);
        } else if (!selectedElementIds.includes(hit.id)) {
          activeIds = [hit.id];
          setSelectedElementIds(activeIds);
        }
        if (isReadOnly) return;

        if (tool === "select" || tool === "move") {
          setIsDraggingElement(true);
          setDragStart(pt);
          return;
        }

        if (tool === "copy") {
          setIsDrawing(true);
          setStartPoint(pt);
          setDragPoint(pt);
          return;
        }

        if (tool === "rotate" || tool === "scale") {
          const pivot = getSelectionCentroid(elements, activeIds);
          setOperationPivot(pivot);
          setIsDrawing(true);
          setStartPoint(pt);
          setDragPoint(pt);
          return;
        }
      }

      if (tool === "move" && selectedElementIds.length > 0) {
        setIsDraggingElement(true);
        setDragStart(pt);
        return;
      }

      if (tool === "copy" && selectedElementIds.length > 0) {
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
        return;
      }

      if ((tool === "rotate" || tool === "scale") && selectedElementIds.length > 0) {
        const pivot = getSelectionCentroid(elements, selectedElementIds);
        setOperationPivot(pivot);
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
        return;
      }

      if (tool === "select") {
        if (!e.shiftKey) setSelectedElementIds([]);
        setBoxSelectStart(pt);
        setBoxSelectCurrent(pt);
      } else if (!e.shiftKey) {
        setSelectedElementIds([]);
      }
      return;
    }

    if (tool === "wall") {
      if (!isDrawing) {
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
      } else if (startPoint) {
        const constrainedPt = getConstrainedWallPoint(startPoint, pt, orthoEnabled);
        const newWall = createWallElement(startPoint, constrainedPt, { layerId: "A-WALL" });
        addElement(newWall);
        autoSave();
        queueEditAction({ type: "add", elementType: "wall", id: newWall.id });
        // Chain
        setStartPoint(constrainedPt);
        setDragPoint(constrainedPt);
      }
      return;
    }

    if (tool === "door") {
      const nearest = findNearestWall(pt, elements, 60);
      if (nearest) {
        const newDoor = createOpeningElement("door", nearest.wall, nearest.projectedPoint);
        addElement(newDoor);
        autoSave();
        queueEditAction({ type: "add", elementType: "opening", id: newDoor.id });
        setTool("select");
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
      const nearest = findNearestWall(pt, elements, 60);
      if (nearest) {
        const newWindow = createOpeningElement("window", nearest.wall, nearest.projectedPoint);
        addElement(newWindow);
        autoSave();
        queueEditAction({ type: "add", elementType: "opening", id: newWindow.id });
        setTool("select");
      } else {
        insertBlock("window", pt.x, pt.y);
      }
      autoSave();
      setTool("select");
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
      if (isDrawing) return;
      setActiveDialog({ type: "leader", point: pt });
      return;
    }

    if (tool === "hatch") {
      setIsDrawing(true);
      setStartPoint(pt);
      setDragPoint(pt);
      return;
    }



    if (tool === "trim") {
      const pickableTrim = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickableTrim, pt.x, pt.y);
      if (!hit || hit.type !== "line") return;
      const lx1 = hit.x1!, ly1 = hit.y1!, lx2 = hit.x2!, ly2 = hit.y2!;
      const ldx = lx2 - lx1, ldy = ly2 - ly1;
      const lenSq = ldx * ldx + ldy * ldy;
      if (lenSq < 0.001) return;
      // Collect intersection parameters along the hit line
      const ts: number[] = [];
      pickableTrim.forEach((other) => {
        if (other.id === hit.id || other.type !== "line") return;
        const ox1 = other.x1!, oy1 = other.y1!, ox2 = other.x2!, oy2 = other.y2!;
        const odx = ox2 - ox1, ody = oy2 - oy1;
        const denom = ldx * ody - ldy * odx;
        if (Math.abs(denom) < 0.001) return;
        const t = ((ox1 - lx1) * ody - (oy1 - ly1) * odx) / denom;
        const s = ((ox1 - lx1) * ldy - (oy1 - ly1) * ldx) / denom;
        if (t >= 0 && t <= 1 && s >= 0 && s <= 1) ts.push(t);
      });
      if (ts.length === 0) return;
      ts.sort((a, b) => a - b);
      // t of click along the hit line
      const tc = ((pt.x - lx1) * ldx + (pt.y - ly1) * ldy) / lenSq;
      if (tc < 0.5) {
        // trim start side up to nearest intersection
        const cut = ts.find(t => t >= tc) ?? ts[ts.length - 1];
        updateElement(hit.id, { x1: lx1 + cut * ldx, y1: ly1 + cut * ldy } as any);
      } else {
        // trim end side back to nearest intersection
        const cut = [...ts].reverse().find(t => t <= tc) ?? ts[0];
        updateElement(hit.id, { x2: lx1 + cut * ldx, y2: ly1 + cut * ldy } as any);
      }
      autoSave();
      return;
    }

    if (tool === "extend") {
      const pickableExt = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickableExt, pt.x, pt.y);
      if (!hit || hit.type !== "line") return;
      const lx1 = hit.x1!, ly1 = hit.y1!, lx2 = hit.x2!, ly2 = hit.y2!;
      const ldx = lx2 - lx1, ldy = ly2 - ly1;
      const lenSq = ldx * ldx + ldy * ldy;
      if (lenSq < 0.001) return;
      // t of click along the hit line
      const tc = ((pt.x - lx1) * ldx + (pt.y - ly1) * ldy) / lenSq;
      // Find nearest intersecting line past the clicked end (extrapolating beyond [0,1])
      let bestT: number | null = null;
      pickableExt.forEach((other) => {
        if (other.id === hit.id || other.type !== "line") return;
        const ox1 = other.x1!, oy1 = other.y1!, ox2 = other.x2!, oy2 = other.y2!;
        const odx = ox2 - ox1, ody = oy2 - oy1;
        const denom = ldx * ody - ldy * odx;
        if (Math.abs(denom) < 0.001) return;
        const t = ((ox1 - lx1) * ody - (oy1 - ly1) * odx) / denom;
        const s = ((ox1 - lx1) * ldy - (oy1 - ly1) * ldx) / denom;
        if (s < 0 || s > 1) return; // intersection must be on the boundary line
        if (tc < 0.5) {
          // clicked near start — extend toward t < 0
          if (t < 0 && (bestT === null || t > bestT)) bestT = t;
        } else {
          // clicked near end — extend toward t > 1
          if (t > 1 && (bestT === null || t < bestT)) bestT = t;
        }
      });
      if (bestT === null) return;
      if (tc < 0.5) {
        updateElement(hit.id, { x1: lx1 + bestT * ldx, y1: ly1 + bestT * ldy } as any);
      } else {
        updateElement(hit.id, { x2: lx1 + bestT * ldx, y2: ly1 + bestT * ldy } as any);
      }
      autoSave();
      return;
    }

    // ── Offset ──────────────────────────────────────────────────────────────
    if (tool === "offset") {
      const pickableOffset = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickableOffset, pt.x, pt.y);
      if (!hit) return;

      const offsetDist = parseFloat(prompt("Offset distance (units):", "1") || "1") * 100;
      if (isNaN(offsetDist) || offsetDist <= 0) return;

      if (hit.type === "line") {
        const dx = hit.x2! - hit.x1!, dy = hit.y2! - hit.y1!;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        const nx = -dy / len, ny = dx / len;
        // Determine direction from click side
        const side = (pt.x - (hit.x1! + hit.x2!) / 2) * nx + (pt.y - (hit.y1! + hit.y2!) / 2) * ny > 0 ? 1 : -1;
        const od = offsetDist * side;
        addElement({ ...hit, id: genId(), x1: hit.x1! + nx * od, y1: hit.y1! + ny * od, x2: hit.x2! + nx * od, y2: hit.y2! + ny * od });
      } else if (hit.type === "circle") {
        const side = Math.hypot(pt.x - hit.cx!, pt.y - hit.cy!) > hit.radius! ? 1 : -1;
        const nr = hit.radius! + offsetDist * side;
        if (nr > 0) addElement({ ...hit, id: genId(), radius: nr });
      } else if (hit.type === "rectangle") {
        const od = offsetDist;
        addElement({ ...hit, id: genId(), x: hit.x! - od, y: hit.y! - od, width: hit.width! + 2 * od, height: hit.height! + 2 * od });
      } else if (hit.type === "polyline" && hit.points && hit.points.length >= 2) {
        const pts = hit.points;
        const newPts = pts.map((p: { x: number; y: number }, i: number) => {
          const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
          const dx1 = p.x - prev.x, dy1 = p.y - prev.y;
          const dx2 = next.x - p.x, dy2 = next.y - p.y;
          const l1 = Math.hypot(dx1, dy1) || 1, l2 = Math.hypot(dx2, dy2) || 1;
          const nx = (-dy1 / l1 + -dy2 / l2) / 2, ny = (dx1 / l1 + dx2 / l2) / 2;
          return { x: p.x + nx * offsetDist, y: p.y + ny * offsetDist };
        });
        addElement({ ...hit, id: genId(), points: newPts });
      }
      autoSave();
      return;
    }

    // ── Fillet ───────────────────────────────────────────────────────────────
    if (tool === "fillet") {
      const pickableFillet = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickableFillet, pt.x, pt.y);
      if (!hit || hit.type !== "line") return;

      if (!filletFirstId) {
        setFilletFirstId(hit.id);
        return;
      }

      if (filletFirstId === hit.id) return;

      const line1 = elements.find(e => e.id === filletFirstId);
      const line2 = hit;
      if (!line1 || line1.type !== "line") { setFilletFirstId(null); return; }

      // Compute intersection of the two infinite lines
      const l1dx = line1.x2! - line1.x1!, l1dy = line1.y2! - line1.y1!;
      const l2dx = line2.x2! - line2.x1!, l2dy = line2.y2! - line2.y1!;
      const denom = l1dx * l2dy - l1dy * l2dx;
      if (Math.abs(denom) < 0.001) { setFilletFirstId(null); return; } // Parallel

      const t1 = ((line2.x1! - line1.x1!) * l2dy - (line2.y1! - line1.y1!) * l2dx) / denom;
      const ix = line1.x1! + t1 * l1dx, iy = line1.y1! + t1 * l1dy;

      const radius = parseFloat(prompt("Fillet radius (units):", "0.5") || "0") * 100;
      if (radius <= 0) {
        // No radius = just trim to intersection
        updateElement(line1.id, { x2: ix, y2: iy } as any);
        updateElement(line2.id, { x1: ix, y1: iy } as any);
      } else {
        // Compute tangent points along each line
        const len1 = Math.hypot(l1dx, l1dy), len2 = Math.hypot(l2dx, l2dy);
        const ux1 = l1dx / len1, uy1 = l1dy / len1;
        const ux2 = l2dx / len2, uy2 = l2dy / len2;
        // Half-angle
        const cosHalf = Math.sqrt((1 + (ux1 * ux2 + uy1 * uy2)) / 2);
        const tanLen = cosHalf > 0.01 ? radius / Math.sqrt(1 - cosHalf * cosHalf) * cosHalf : radius;
        const t1x = ix - ux1 * tanLen, t1y = iy - uy1 * tanLen;
        const t2x = ix + ux2 * tanLen, t2y = iy + uy2 * tanLen;
        // Arc center
        const nx1 = -uy1, ny1 = ux1;
        const cx = t1x + nx1 * radius, cy = t1y + ny1 * radius;
        const startAngle = Math.atan2(t1y - cy, t1x - cx) * 180 / Math.PI;
        const endAngle = Math.atan2(t2y - cy, t2x - cx) * 180 / Math.PI;

        updateElement(line1.id, { x2: t1x, y2: t1y } as any);
        updateElement(line2.id, { x1: t2x, y1: t2y } as any);
        addElement({ id: genId(), type: "arc", cx, cy, radius, startAngle, endAngle, strokeColor: line1.strokeColor || "#1f2937", strokeWidth: 2, layerId: activeLayerId });
      }
      setFilletFirstId(null);
      autoSave();
      return;
    }

    // ── Chamfer ──────────────────────────────────────────────────────────────
    if (tool === "chamfer") {
      const pickableChamfer = elements.filter(el => {
        if (!el.layerId) return true;
        const l = layers.find(l => l.id === el.layerId);
        return l ? l.visible : true;
      });
      const hit = getShapeAtPoint(pickableChamfer, pt.x, pt.y);
      if (!hit || hit.type !== "line") return;

      if (!chamferFirstId) {
        setChamferFirstId(hit.id);
        return;
      }
      if (chamferFirstId === hit.id) return;

      const line1 = elements.find(e => e.id === chamferFirstId);
      const line2 = hit;
      if (!line1 || line1.type !== "line") { setChamferFirstId(null); return; }

      const l1dx = line1.x2! - line1.x1!, l1dy = line1.y2! - line1.y1!;
      const l2dx = line2.x2! - line2.x1!, l2dy = line2.y2! - line2.y1!;
      const denom = l1dx * l2dy - l1dy * l2dx;
      if (Math.abs(denom) < 0.001) { setChamferFirstId(null); return; }

      const t1 = ((line2.x1! - line1.x1!) * l2dy - (line2.y1! - line1.y1!) * l2dx) / denom;
      const ix = line1.x1! + t1 * l1dx, iy = line1.y1! + t1 * l1dy;

      const dist = parseFloat(prompt("Chamfer distance (units):", "0.5") || "0") * 100;
      if (dist <= 0) {
        updateElement(line1.id, { x2: ix, y2: iy } as any);
        updateElement(line2.id, { x1: ix, y1: iy } as any);
      } else {
        const len1 = Math.hypot(l1dx, l1dy), len2 = Math.hypot(l2dx, l2dy);
        const ux1 = l1dx / len1, uy1 = l1dy / len1;
        const ux2 = l2dx / len2, uy2 = l2dy / len2;
        const c1x = ix - ux1 * dist, c1y = iy - uy1 * dist;
        const c2x = ix + ux2 * dist, c2y = iy + uy2 * dist;
        updateElement(line1.id, { x2: c1x, y2: c1y } as any);
        updateElement(line2.id, { x1: c2x, y1: c2y } as any);
        addElement({ id: genId(), type: "line", x1: c1x, y1: c1y, x2: c2x, y2: c2y, strokeColor: line1.strokeColor || "#1f2937", strokeWidth: line1.strokeWidth || 2, layerId: activeLayerId });
      }
      setChamferFirstId(null);
      autoSave();
      return;
    }

    // ── Stretch ───────────────────────────────────────────────────────────────
    if (tool === "stretch") {
      if (!stretchBoxStart) {
        // First click: set start of crossing box
        setStretchBoxStart(pt);
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
      }
      return;
    }

    // ── Spline ───────────────────────────────────────────────────────────────
    if (tool === "spline") {
      if (!isDrawing) {
        setIsDrawing(true);
        setStartPoint(pt);
        setDragPoint(pt);
        const newId = genId();
        setCurrentSplineId(newId);
        addElement({ id: newId, type: "spline", points: [pt], strokeColor: "#1f2937", strokeWidth: 2, layerId: activeLayerId });
      } else if (currentSplineId) {
        const el = elements.find(e => e.id === currentSplineId);
        if (el) updateElement(currentSplineId, { points: [...(el.points || []), pt] });
      }
      return;
    }

    // ── M-Text ───────────────────────────────────────────────────────────────
    if (tool === "mtext") {
      const content = prompt("Enter multiline text (use \\n for new lines):", "")?.replace(/\\n/g, "\n") || "";
      if (content.trim()) {
        addElement({ id: genId(), type: "mtext", text: content, x: pt.x, y: pt.y, fontSize: 16, strokeColor: isDark ? "#ffffff" : "#1f2937", layerId: activeLayerId });
        autoSave();
      }
      setTool("select");
      return;
    }

    // ── Linear Dimension ─────────────────────────────────────────────────────
    if (tool === "dim-linear") {
      setIsDrawing(true);
      setStartPoint(pt);
      setDragPoint(pt);
      return;
    }

    // ── Angular Dimension ─────────────────────────────────────────────────────
    if (tool === "dim-angular") {
      if (!angularVertex) {
        setAngularVertex(pt);
        return;
      }
      if (!angularPoint1) {
        setAngularPoint1(pt);
        return;
      }
      // Third click: place with current point as point2
      addElement({
        id: genId(), type: "dim-angular",
        vertex: angularVertex, point1: angularPoint1, point2: pt,
        arcRadius: Math.hypot(angularPoint1.x - angularVertex.x, angularPoint1.y - angularVertex.y) * 0.6,
        strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId,
        x: angularVertex.x, y: angularVertex.y,
      });
      setAngularVertex(null);
      setAngularPoint1(null);
      autoSave();
      setTool("select");
      return;
    }

    // ── Mark No. ─────────────────────────────────────────────────────────────
    if (tool === "mark") {
      addElement({ id: genId(), type: "mark", x: pt.x, y: pt.y, markNumber: markCounter, fontSize: 11, strokeColor: isDark ? "#ffffff" : "#1f2937", strokeWidth: 1.5, layerId: activeLayerId });
      setMarkCounter(prev => prev + 1);
      autoSave();
      return;
    }

    // ── Dim Radius ────────────────────────────────────────────────────────────
    if (tool === "dim-radius") {
      const pickable = elements.filter(el => { const l = layers.find(l2 => l2.id === el.layerId); return l ? l.visible : true; });
      const hit = getShapeAtPoint(pickable, pt.x, pt.y);
      if (hit && (hit.type === "circle" || hit.type === "arc") && typeof hit.cx === "number" && typeof hit.cy === "number" && typeof hit.radius === "number") {
        const angle = Math.atan2(pt.y - hit.cy, pt.x - hit.cx);
        const ex = hit.cx + hit.radius * Math.cos(angle);
        const ey = hit.cy + hit.radius * Math.sin(angle);
        addElement({ id: genId(), type: "dim-radius", cx: hit.cx, cy: hit.cy, ex, ey, radius: hit.radius, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId });
        setTool("select");
        autoSave();
      }
      return;
    }

    // ── Dim Diameter ──────────────────────────────────────────────────────────
    if (tool === "dim-diameter") {
      const pickable = elements.filter(el => { const l = layers.find(l2 => l2.id === el.layerId); return l ? l.visible : true; });
      const hit = getShapeAtPoint(pickable, pt.x, pt.y);
      if (hit && hit.type === "circle" && typeof hit.cx === "number" && typeof hit.cy === "number" && typeof hit.radius === "number") {
        const angle = Math.atan2(pt.y - hit.cy, pt.x - hit.cx);
        addElement({ id: genId(), type: "dim-diameter", cx: hit.cx, cy: hit.cy, radius: hit.radius, angle, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId });
        setTool("select");
        autoSave();
      }
      return;
    }

    // ── Dim Continue ──────────────────────────────────────────────────────────
    if (tool === "dim-continue") {
      if (!isDrawing) {
        setStartPoint(pt);
        setIsDrawing(true);
      } else if (startPoint) {
        const lastDim = [...elements].reverse().find(e => e.type === "dimension" || e.type === "dim-linear");
        const origin = lastDim ? { x: lastDim.x2!, y: lastDim.y2! } : startPoint;
        addElement({ id: genId(), type: "dim-linear", dimAxis: "auto", x1: origin.x, y1: origin.y, x2: pt.x, y2: pt.y, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId });
        setStartPoint(pt);
        autoSave();
      }
      return;
    }

    // ── Break ─────────────────────────────────────────────────────────────────
    if (tool === "break") {
      if (!isDrawing) {
        const pickable = elements.filter(el => { const l = layers.find(l2 => l2.id === el.layerId); return l ? l.visible : true; });
        const hit = getShapeAtPoint(pickable, pt.x, pt.y);
        if (hit) {
          setStartPoint(pt);
          setSelectedElementIds([hit.id]);
          setIsDrawing(true);
        }
      } else if (startPoint && selectedElementIds.length > 0) {
        const hit = elements.find(e => e.id === selectedElementIds[0]);
        if (hit) {
          const broken = breakElement(hit, startPoint, pt);
          if (broken) {
            deleteSelectedElements();
            broken.forEach(el => addElement(el));
          }
        }
        setIsDrawing(false);
        setStartPoint(null);
        setSelectedElementIds([]);
        setTool("select");
        autoSave();
      }
      return;
    }

    // ── Array (canvas mode — just select) ────────────────────────────────────
    if (tool === "array") {
      // In canvas mode, array acts like select; actual duplication is via command line
      const pickable = elements.filter(el => { const l = layers.find(l2 => l2.id === el.layerId); return l ? l.visible : true; });
      const hit = getShapeAtPoint(pickable, pt.x, pt.y);
      if (hit) {
        if (e.shiftKey) {
          setSelectedElementIds(selectedElementIds.includes(hit.id) ? selectedElementIds.filter(id => id !== hit.id) : [...selectedElementIds, hit.id]);
        } else {
          setSelectedElementIds([hit.id]);
        }
      } else if (!e.shiftKey) {
        setSelectedElementIds([]);
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

    if (activeGripRef.current) {
      const { elementId, gripIndex } = activeGripRef.current;
      const el = elements.find(e => e.id === elementId);
      if (el) {
        const updates = applyGripDrag(el, gripIndex, canvasPt);
        if (Object.keys(updates).length > 0) updateElement(elementId, updates as any);
      }
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

    if (boxSelectStart) {
      setBoxSelectCurrent(canvasPt);
    }

    if (isDrawing) {
      if (tool === "wall" && startPoint) {
        setDragPoint(getConstrainedWallPoint(startPoint, canvasPt, orthoEnabled));
      } else if (tool === "line" && startPoint && orthoEnabled) {
        const dx = canvasPt.x - startPoint.x;
        const dy = canvasPt.y - startPoint.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          setDragPoint({ x: canvasPt.x, y: startPoint.y });
        } else {
          setDragPoint({ x: startPoint.x, y: canvasPt.y });
        }
      } else {
        setDragPoint(canvasPt);
      }
    } else if (tool === "door" || tool === "window") {
      setDragPoint(canvasPt);
    }

    if (!isDraggingElement && !isPanning && !isDrawing && !boxSelectStart) {
      // Skip hover detection for large drawings — getShapeAtPoint on 10k+ elements causes lag
      if (elements.length > 5000) {
        // Only clear hover, don't do expensive hit-test
        if (hoveredElementId !== null) setHoveredElementId(null);
      } else {
        const pickable = elements.filter(el => {
          if (!el.layerId) return true;
          const l = layers.find(l => l.id === el.layerId);
          return l ? l.visible : true;
        });
        const hovered = getShapeAtPoint(pickable, canvasPt.x, canvasPt.y);
        setHoveredElementId(hovered?.id ?? null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    if (activeGripRef.current) {
      const gripInfo = activeGripRef.current;
      activeGripRef.current = null;
      autoSave();
      queueEditAction({ type: "grip_drag", elementId: gripInfo.elementId, gripIndex: gripInfo.gripIndex });
      return;
    }

    if (isDraggingElement) {
      setIsDraggingElement(false);
      setDragStart(null);
      autoSave();
      queueEditAction({ type: "move", ids: selectedElementIds });
      if (tool === "move") setTool("select");
      return;
    }

    // Box/rubber-band selection finalize
    if (boxSelectStart && boxSelectCurrent) {
      const dx = Math.abs(boxSelectCurrent.x - boxSelectStart.x);
      const dy = Math.abs(boxSelectCurrent.y - boxSelectStart.y);
      if (dx > 4 || dy > 4) {
        const minX = Math.min(boxSelectStart.x, boxSelectCurrent.x);
        const maxX = Math.max(boxSelectStart.x, boxSelectCurrent.x);
        const minY = Math.min(boxSelectStart.y, boxSelectCurrent.y);
        const maxY = Math.max(boxSelectStart.y, boxSelectCurrent.y);
        const pickable = elements.filter(el => {
          if (!el.layerId) return true;
          const l = layers.find(l => l.id === el.layerId);
          return l ? l.visible : true;
        });
        const isWindowSelect = boxSelectCurrent.x >= boxSelectStart.x;
        const inBox = pickable.filter(el =>
          isWindowSelect
            ? elementFullyInBox(el, minX, minY, maxX, maxY)
            : elementInBox(el, minX, minY, maxX, maxY)
        );
        setSelectedElementIds(inBox.map(el => el.id));
      }
      setBoxSelectStart(null);
      setBoxSelectCurrent(null);
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
      setTool("select");
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
      setTool("select");
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
      setTool("select");
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
      } else if (tool === "dim-linear") {
        // Project endpoints to horizontal or vertical based on which dimension is bigger
        const axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        el = { id: genId(), type: "dim-linear", dimAxis: axis, x1: startPoint.x, y1: startPoint.y, x2: pt.x, y2: pt.y, strokeColor: "#3b82f6", strokeWidth: 1.5, layerId: activeLayerId };
      }

      if (el && tool !== "polyline" && tool !== "wall") {
        addElement(el);
        autoSave();
        queueEditAction({ type: "add", elementType: el.type, id: el.id });
      }
    }


    // ── Stretch finalize on mouse up ──────────────────────────────────────────
    if (tool === "stretch" && stretchBoxStart && startPoint && dragPoint) {
      const pt2 = getCanvasPoint(e);
      const minX = Math.min(stretchBoxStart.x, pt2.x);
      const maxX = Math.max(stretchBoxStart.x, pt2.x);
      const minY = Math.min(stretchBoxStart.y, pt2.y);
      const maxY = Math.max(stretchBoxStart.y, pt2.y);
      const stretchDx = pt2.x - startPoint.x;
      const stretchDy = pt2.y - startPoint.y;

      elements.forEach(el => {
        if (el.type === "line") {
          const p1in = el.x1! >= minX && el.x1! <= maxX && el.y1! >= minY && el.y1! <= maxY;
          const p2in = el.x2! >= minX && el.x2! <= maxX && el.y2! >= minY && el.y2! <= maxY;
          if (p1in || p2in) {
            updateElement(el.id, {
              x1: p1in ? el.x1! + stretchDx : el.x1,
              y1: p1in ? el.y1! + stretchDy : el.y1,
              x2: p2in ? el.x2! + stretchDx : el.x2,
              y2: p2in ? el.y2! + stretchDy : el.y2,
            } as any);
          }
        } else if (el.type === "rectangle") {
          const corners = [
            { x: el.x!, y: el.y! },
            { x: el.x! + el.width!, y: el.y! },
            { x: el.x!, y: el.y! + el.height! },
            { x: el.x! + el.width!, y: el.y! + el.height! },
          ];
          const inBox = corners.some(c => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY);
          if (inBox) updateElement(el.id, { width: el.width! + stretchDx, height: el.height! + stretchDy } as any);
        } else if ((el.type === "polyline" || el.type === "spline") && el.points) {
          const newPts = el.points.map((p: Point) => {
            const inside = p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
            return inside ? { x: p.x + stretchDx, y: p.y + stretchDy } : p;
          });
          updateElement(el.id, { points: newPts });
        }
      });

      autoSave();
      setStretchBoxStart(null);
      setIsDrawing(false);
      setStartPoint(null);
      setDragPoint(null);
      setTool("select");
      return;
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

    if (tool !== "select" && tool !== "polyline" && tool !== "spline") {
      setTool("select");
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
    setBoxSelectStart(null);
    setBoxSelectCurrent(null);
    activeGripRef.current = null;
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


  const exportCanvas = (format: string) => {
    const canvas = turboMode ? webglCanvasRef.current : canvasRef.current;
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
    importJsonInputRef.current?.click();
  };

  const handleImportDxf = () => {
    importDxfInputRef.current?.click();
  };

  /**
   * Fit the viewport to show all given elements.
   * Computes AABB of the element set and sets zoom + panOffset so everything
   * is visible with a comfortable 5% margin on each side.
   */
  const fitToElements = (els: DrawingElement[]) => {
    if (els.length === 0) return;
    const canvas = turboMode ? webglCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of els) {
      if (el.type === "line") {
        minX = Math.min(minX, el.x1!, el.x2!); maxX = Math.max(maxX, el.x1!, el.x2!);
        minY = Math.min(minY, el.y1!, el.y2!); maxY = Math.max(maxY, el.y1!, el.y2!);
      } else if (el.type === "circle" || el.type === "arc") {
        const r = (el.radius as number) || 0;
        minX = Math.min(minX, el.cx! - r); maxX = Math.max(maxX, el.cx! + r);
        minY = Math.min(minY, el.cy! - r); maxY = Math.max(maxY, el.cy! + r);
      } else if (el.type === "ellipse") {
        const rx = (el as any).rx || 50, ry = (el as any).ry || 30;
        minX = Math.min(minX, el.cx! - rx); maxX = Math.max(maxX, el.cx! + rx);
        minY = Math.min(minY, el.cy! - ry); maxY = Math.max(maxY, el.cy! + ry);
      } else if (el.type === "rectangle") {
        minX = Math.min(minX, el.x!); maxX = Math.max(maxX, el.x! + (el.width || 0));
        minY = Math.min(minY, el.y!); maxY = Math.max(maxY, el.y! + (el.height || 0));
      } else if (el.type === "text" || el.type === "mtext") {
        minX = Math.min(minX, el.x!); maxX = Math.max(maxX, el.x! + 50);
        minY = Math.min(minY, el.y! - 20); maxY = Math.max(maxY, el.y! + 4);
      } else if ((el as any).x !== undefined) {
        minX = Math.min(minX, (el as any).x); maxX = Math.max(maxX, (el as any).x);
        minY = Math.min(minY, (el as any).y ?? 0); maxY = Math.max(maxY, (el as any).y ?? 0);
      } else if ((el as any).cx !== undefined) {
        minX = Math.min(minX, (el as any).cx); maxX = Math.max(maxX, (el as any).cx);
        minY = Math.min(minY, (el as any).cy ?? 0); maxY = Math.max(maxY, (el as any).cy ?? 0);
      }
      if (el.points) {
        for (const p of (el.points as any[])) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
      }
    }

    if (!isFinite(minX) || !isFinite(minY)) {
      console.warn("[fitToElements] ⚠️ Could not compute bounding box — no finite coordinates found");
      return;
    }

    const drawW = maxX - minX || 1;
    const drawH = maxY - minY || 1;
    const margin = 0.92; // use 92% of canvas for content
    // Clamp max zoom to 200 to handle large-coordinate DXF (mm units: 50000×30000mm → rawZoom ~0.02)
    const rawZoom = Math.min((width / drawW) * margin, (height / drawH) * margin);
    const newZoom = Math.max(0.001, Math.min(200, rawZoom));
    // Recalculate panOffset using the CLAMPED zoom so they always stay in sync
    const newPanX = (width - drawW * newZoom) / 2 - minX * newZoom;
    const newPanY = (height - drawH * newZoom) / 2 - minY * newZoom;

    console.group("%c[fitToElements] 🔭 Viewport fit", "color:#22d3ee;font-weight:bold");
    console.log("Canvas size:", `${width.toFixed(0)} × ${height.toFixed(0)} px`);
    console.log("Drawing bounds (world):", `X [${minX.toFixed(1)}, ${maxX.toFixed(1)}]  Y [${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);
    console.log("Drawing size (world):", `${drawW.toFixed(1)} × ${drawH.toFixed(1)}`);
    console.log("Raw zoom (before clamp):", rawZoom.toFixed(6));
    console.log("New zoom (after clamp):", newZoom.toFixed(6));
    console.log("New panOffset:", `{ x: ${newPanX.toFixed(1)}, y: ${newPanY.toFixed(1)} }`);
    console.groupEnd();

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };


  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so same file can be re-selected
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { appDialog.alert("Invalid JSON file", { title: "Import Error", variant: "danger" }); return; }

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
      appDialog.alert("Unrecognized file format", { title: "Import Error", variant: "danger" }); return;
    }

    setImportConfirmDialog({
      title: `Import: ${file.name}`,
      description: `${doc.elements.length.toLocaleString()} elements found. Replace the current drawing or merge alongside existing ones?`,
      onReplace: () => {
        importDrawingState(doc);
        setImportConfirmDialog(null);
        // Auto-fit viewport after a brief delay so state has settled
        setTimeout(() => fitToElements(doc.elements), 300);
      },
      onMerge: () => {
        mergeDrawingState(doc);
        setImportConfirmDialog(null);
        setTimeout(() => fitToElements(doc.elements), 300);
      }
    });
  };

  const handleDxfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so same file can be re-selected
    e.target.value = "";
    if (!file) return;

    console.group("%c[DXF Import] 📂 File selected", "color:#f59e0b;font-weight:bold");
    console.log("File name:", file.name);
    console.log("File size:", `${(file.size / 1024).toFixed(1)} KB`);
    console.log("File type:", file.type || "(no MIME type)");
    console.groupEnd();

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

    console.log("%c[DXF Import] ⏳ Reading file...", "color:#f59e0b");

    // ── Robust encoding detection ────────────────────────────────────────────
    // Vietnamese AutoCAD files use Windows-1258 (ANSI_1258) which stores tone
    // marks as combining characters. When read as UTF-8, these single bytes
    // become U+FFFD replacement chars → garbled text like "TIE◆T" instead of "TIẾT".
    //
    // Strategy (must handle cases where the header itself is garbled):
    //   1. Try UTF-8 first
    //   2. If replacement chars detected → retry windows-1258
    //   3. Sniff $DWGCODEPAGE from raw bytes as secondary signal
    //   4. Detect Vietnamese byte patterns in raw buffer as tertiary signal
    let text: string;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // ── Signal 1: Check $DWGCODEPAGE from raw ASCII bytes (no decoding needed) ──
    let codepage: number | null = null;
    const asciiProbe = Array.from(bytes.slice(0, 8192), b => b < 128 ? String.fromCharCode(b) : "?").join("");
    const cpMatch = asciiProbe.match(/\$DWGCODEPAGE[\s\S]{0,30}ANSI_(\d+)/i);
    if (cpMatch) codepage = parseInt(cpMatch[1]);

    // ── Signal 2: Detect Windows-1258 byte patterns ──────────────────────────
    // In Windows-1258, Vietnamese combining marks live at bytes 0xCC, 0xEC, 0xD2, 0xDE, 0xF2
    // (combining acute, grave, hook above, tilde, dot below).
    // These are extremely rare in normal ASCII/UTF-8 but very common in Vietnamese text.
    let suspect1258Bytes = 0;
    const checkRange = Math.min(bytes.length, 16384);
    for (let i = 0; i < checkRange; i++) {
      const b = bytes[i];
      // These bytes are combining Vietnamese tone marks in CP1258
      if (b === 0xCC || b === 0xEC || b === 0xD2 || b === 0xDE || b === 0xF2) {
        // Only count if preceded by a letter-like byte (vowel base)
        if (i > 0 && bytes[i - 1] >= 0x41 && bytes[i - 1] <= 0xFD) {
          suspect1258Bytes++;
        }
      }
    }
    const likely1258 = suspect1258Bytes > 5; // more than 5 combining marks → very likely 1258

    // ── Signal 3: Try UTF-8 and check for replacement characters ─────────────
    const utf8Strict = new TextDecoder("utf-8", { fatal: false });
    const utf8Text = utf8Strict.decode(buffer);
    const hasReplacementChars = utf8Text.includes("\uFFFD");

    // ── Decision ──────────────────────────────────────────────────────────────
    if (codepage === 1258 || likely1258 || (hasReplacementChars && (codepage === null || codepage === 1258))) {
      text = new TextDecoder("windows-1258").decode(buffer);
      console.log(
        `%c[DXF Import] 🔤 Encoding: Windows-1258 (Vietnamese)`,
        "color:#a78bfa",
        `| codepage=${codepage} suspect1258=${suspect1258Bytes} hasFFD=${hasReplacementChars}`
      );
    } else if (codepage && codepage !== 1252 && codepage !== 65001) {
      try {
        text = new TextDecoder(`windows-${codepage}`).decode(buffer);
      } catch {
        text = utf8Text;
      }
      console.log(`%c[DXF Import] 🔤 Encoding: Windows-${codepage}`, "color:#a78bfa");
    } else if (hasReplacementChars) {
      // UTF-8 failed but no codepage hint — try 1258 as best guess for VN files
      const try1258 = new TextDecoder("windows-1258").decode(buffer);
      // Verify: 1258 decode should produce fewer garbled chars
      const fffd1258 = (try1258.match(/\uFFFD/g) || []).length;
      const fffdUtf8 = (utf8Text.match(/\uFFFD/g) || []).length;
      if (fffd1258 < fffdUtf8) {
        text = try1258;
        console.log("%c[DXF Import] 🔤 Encoding: Windows-1258 (fallback, fewer garbled chars)", "color:#a78bfa");
      } else {
        text = utf8Text;
        console.log("%c[DXF Import] 🔤 Encoding: UTF-8 (with replacement chars)", "color:#f59e0b");
      }
    } else {
      text = utf8Text;
      console.log("%c[DXF Import] 🔤 Encoding: UTF-8", "color:#a78bfa");
    }
    // ────────────────────────────────────────────────────────────────────────


    console.log("%c[DXF Import] ✅ File read complete", "color:#22c55e", `(${text.length.toLocaleString()} chars)`);


    try {
      console.log("%c[DXF Import] ⚙️ Parsing DXF...", "color:#f59e0b");
      let importedElements = dxfToElements(text);

      // ── DXF structure debug ────────────────────────────────────────────
      const sections = [...text.matchAll(/^\s*2\s*\r?\n\s*(HEADER|BLOCKS|ENTITIES|OBJECTS)\s*$/gm)]
        .map(m => m[1]);
      const entityMatches = [...text.matchAll(/^\s*0\s*\r?\n\s*(\w+)\s*$/gm)].map(m => m[1]);
      const entityCounts: Record<string, number> = {};
      for (const e of entityMatches) entityCounts[e] = (entityCounts[e] || 0) + 1;
      console.group("%c[DXF Structure]", "color:#a78bfa;font-weight:bold");
      console.log("Sections found:", sections);
      console.log("First 100 chars:", text.slice(0, 200));
      console.log("All entity/object type counts:", entityCounts);
      console.groupEnd();
      // ──────────────────────────────────────────────────────────────────

      // Element type breakdown
      const typeCounts: Record<string, number> = {};
      for (const el of importedElements) { typeCounts[el.type] = (typeCounts[el.type] || 0) + 1; }

      console.group("%c[DXF Import] 📊 Parse result", "color:#22d3ee;font-weight:bold");
      console.log("Total elements:", importedElements.length);
      console.table(typeCounts);

      // Sample first element for sanity check
      if (importedElements.length > 0) {
        console.log("First element sample:", importedElements[0]);
        console.log("Last element sample:", importedElements[importedElements.length - 1]);
      }
      console.groupEnd();

      if (importedElements.length === 0) {
        console.warn("%c[DXF Import] ⚠️ No drawable elements found in file", "color:#ef4444");
        appDialog.alert("No elements found in this DXF file.", { title: "DXF Import", variant: "warning" });
        return;
      }

      const MAX_ELEMENTS = 50000;
      if (importedElements.length > MAX_ELEMENTS) {
        console.warn(`%c[DXF Import] ⚠️ Element cap triggered: ${importedElements.length} → ${MAX_ELEMENTS}`, "color:#f59e0b");
        const proceed = await appDialog.confirm(
          `⚠️ Large file detected!\n\n` +
          `This DXF contains ${importedElements.length.toLocaleString()} elements — importing all of them will slow down the editor.\n\n` +
          `Click OK to import the first ${MAX_ELEMENTS.toLocaleString()} elements (recommended).\n` +
          `Click Cancel to abort the import.`,
          { title: "DXF Import", variant: "warning", confirmLabel: "Continue" }
        );
        if (!proceed) { console.log("%c[DXF Import] ❌ User cancelled import", "color:#ef4444"); return; }
        importedElements = importedElements.slice(0, MAX_ELEMENTS);
      }

      const bounds = getPlanBounds(importedElements);
      pendingDxfFileRef.current = file; // Store for optional RAG upload after import
      setDxfWizard({
        fileName: file.name,
        elements: importedElements,
        layers: summarizeDxfLayers(importedElements),
        detectedUnit: parseDxfInsUnits(text),
        bbox: bounds ? { width: bounds.maxX - bounds.minX, height: bounds.maxZ - bounds.minZ } : null,
      });

    } catch (err) {
      console.error("%c[DXF Import] ❌ Parse error", "color:#ef4444", err);
      appDialog.alert("Failed to parse DXF file.", { title: "DXF Error", variant: "danger" });
    }
  };

  const handleDxfWizardConfirm = (result: DxfImportResult) => {
    if (!dxfWizard) return;
    const factor = unitFactorToMm(result.unit);
    const scaled = scaleElements(dxfWizard.elements, factor);
    setDxfLayerOverride(result.override);

    const doc: DrawingDocument = {
      fileType: "ARCH-TECH-CAD-DOCUMENT",
      version: 1,
      elements: scaled,
      // Build a layer entry for every layerId present in the DXF so none are
      // filtered out by the visibility check in the canvas renderer.
      layers: [
        { id: "0", name: "0", visible: true, locked: false },
        ...Array.from(new Set(scaled.map((e) => e.layerId).filter(Boolean)))
          .filter((id) => id !== "0")
          .map((id) => ({ id: id!, name: id!, visible: true, locked: false })),
      ],
      activeLayerId: "0",
      blockDefs: {},
      currentArchitecturalPlan: null,
      measurements: [],
      constraints: [],
    };

    if (result.mode === "replace") importDrawingState(doc);
    else mergeDrawingState(doc);

    setDxfWizard(null);
    setTimeout(() => fitToElements(scaled), 300);

    // Show RAG upload prompt if we have the original file
    if (pendingDxfFileRef.current) {
      setRagUploadPrompt({
        fileName: pendingDxfFileRef.current.name,
        file: pendingDxfFileRef.current,
        status: 'prompt',
      });
    }
  };

  // Handler for uploading the imported DXF/DWG file to the RAG knowledge base
  const handleRagUpload = async () => {
    if (!ragUploadPrompt) return;
    setRagUploadPrompt({ ...ragUploadPrompt, status: 'uploading' });

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", ragUploadPrompt.file);

      const res = await fetch("/api/rag/upload-cad", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const result = await res.json();
      setRagUploadPrompt({
        ...ragUploadPrompt,
        status: 'success',
        message: `Added ${result.chunks_created} knowledge chunk(s) from ${result.file_name}`,
      });
      // Auto-dismiss after 4 seconds
      setTimeout(() => setRagUploadPrompt(null), 4000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Upload failed";
      setRagUploadPrompt({
        ...ragUploadPrompt,
        status: 'error',
        message: errMsg,
      });
      setTimeout(() => setRagUploadPrompt(null), 5000);
    }
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
      setTool("select");
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
      setTool("select");
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
        showPaperSpace={showPaperSpace}
        setShowPaperSpace={setShowPaperSpace}
        showEstimation={showEstimation}
        setShowEstimation={setShowEstimation}
        onImportDxf={handleImportDxf}
        onImportJson={handleImportJson}
        onExportCanvas={exportCanvas}
        onSave={handleSave}
        saveStatus={saveStatus}
        turboMode={turboMode}
        setTurboMode={setTurboMode}
      />

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Full CAD Sidebar Wrapper */}
        <div 
          className="transition-all duration-300 ease-in-out overflow-hidden flex shrink-0"
          style={{ width: (sidebarCollapsed || showEstimation) ? "0px" : "220px" }}
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
            duplicateLayer={duplicateLayer}
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
            show3D={show3D}
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
            onRotate90={handleRotate90}
          />
        </div>

        {/* Sidebar Toggle Handle — z-50 keeps it above the canvas, 3D viewer and
            any transient overlays so it is always clickable. Wider hit area and a
            clear label when collapsed make "show sidebar" easy to find. */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((c) => !c)}
          className={`absolute top-1/2 -translate-y-1/2 z-50 h-16 backdrop-blur-sm border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/95 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 rounded-r-md flex items-center justify-center gap-1 text-slate-500 dark:text-slate-300 transition-[left,background-color] duration-300 ease-in-out shadow-md ${sidebarCollapsed ? "w-7" : "w-4"}`}
          style={{ left: (sidebarCollapsed || showEstimation) ? "0px" : "220px", display: showEstimation ? "none" : "flex" }}
          title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          aria-label={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          <span className="text-xs font-bold select-none">{sidebarCollapsed ? "▶" : "◀"}</span>
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



          {/* Rubber-band box-select overlay */}
          {boxSelectStart && boxSelectCurrent && !show3D && !showPaperSpace && (() => {
            const isWindow = boxSelectCurrent.x >= boxSelectStart.x;
            const left = Math.min(boxSelectStart.x, boxSelectCurrent.x) * zoom + panOffset.x;
            const top  = Math.min(boxSelectStart.y, boxSelectCurrent.y) * zoom + panOffset.y;
            const w    = Math.abs(boxSelectCurrent.x - boxSelectStart.x) * zoom;
            const h    = Math.abs(boxSelectCurrent.y - boxSelectStart.y) * zoom;
            return (
              <div
                style={{
                  position: "absolute", left, top, width: w, height: h,
                  pointerEvents: "none", zIndex: 15,
                  border: `1px solid ${isWindow ? "#3b82f6" : "#22c55e"}`,
                  backgroundColor: isWindow ? "rgba(59,130,246,0.07)" : "rgba(34,197,94,0.07)",
                }}
              />
            );
          })()}

          {!show3D && !showPaperSpace && !showEstimation && (
            <>
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full ${canvasCursor} ${turboMode ? "hidden" : ""}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onDrop={handleCanvasDrop}
              />
              <canvas
                ref={webglCanvasRef}
                className={`absolute inset-0 w-full h-full ${canvasCursor} ${turboMode ? "" : "hidden"}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleDoubleClick}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onDrop={handleCanvasDrop}
              />
            </>
          )}

          {!showEstimation && (
            <DrawingHUD
              isDrawing={isDrawing}
              startPoint={startPoint}
              dragPoint={dragPoint}
              mouseClientPos={mouseClientPos}
              snapPoint={snapPoint}
              tool={tool}
              typedValue={typedValue}
            />
          )}

          {!showEstimation && (
            <StatusBar
              orthoEnabled={orthoEnabled}
              setOrthoEnabled={setOrthoEnabled}
              snapPoint={snapPoint}
              mouseClientPos={mouseClientPos}
            />
          )}

          {/* Lazy loaded heavy components */}
          {hasShown3D && (
            <ChunkErrorBoundary label="3D viewer">
              <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-cyan-400 z-30 font-mono text-xs">Loading 3D Viewer...</div>}>
                <ThreeViewer
                  elements={elements.filter(el => {
                    if (!el.layerId) return true;
                    const l = layers.find(l => l.id === el.layerId);
                    return l ? l.visible : true;
                  })}
                  plan={currentArchitecturalPlan}
                  blockDefs={blockDefs}
                  visible={show3D}
                  revisionKey={revisionKey}
                />
              </Suspense>
            </ChunkErrorBoundary>
          )}

          <ChunkErrorBoundary label="paper layout">
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-cyan-400 z-30 font-mono text-xs">Loading Paper Layout...</div>}>
              <PaperSpace elements={elements} visible={showPaperSpace} onClose={() => setShowPaperSpace(false)} />
            </Suspense>
          </ChunkErrorBoundary>

          {showEstimation && (
            <EstimationDashboard elements={elements} drawingId={drawingId} />
          )}

          {/* Custom Annotation Modal */}
          {activeDialog && (
            <AnnotationDialog
              activeDialog={activeDialog}
              onClose={() => { setActiveDialog(null); setTool("select"); }}
              onConfirm={handleConfirmAnnotation}
            />
          )}

          {importConfirmDialog && (
            <ImportConfirmDialog
              dialog={importConfirmDialog}
              onClose={() => setImportConfirmDialog(null)}
            />
          )}

          {dxfWizard && (
            <DxfImportWizard
              fileName={dxfWizard.fileName}
              elementCount={dxfWizard.elements.length}
              bbox={dxfWizard.bbox}
              layers={dxfWizard.layers}
              detectedUnit={dxfWizard.detectedUnit}
              onCancel={() => { setDxfWizard(null); pendingDxfFileRef.current = null; }}
              onConfirm={handleDxfWizardConfirm}
            />
          )}

          {/* RAG Upload Prompt Toast */}
          {ragUploadPrompt && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md
                bg-slate-800/95 border-slate-600/50 text-white max-w-md">
                {ragUploadPrompt.status === 'prompt' && (
                  <>
                    <span className="text-lg">🤖</span>
                    <span className="text-sm flex-1">Add <strong>{ragUploadPrompt.fileName}</strong> to AI Knowledge Base?</span>
                    <button
                      onClick={handleRagUpload}
                      className="px-3 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                    >
                      Yes, Add
                    </button>
                    <button
                      onClick={() => { setRagUploadPrompt(null); pendingDxfFileRef.current = null; }}
                      className="px-3 py-1 text-xs font-medium bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                    >
                      Skip
                    </button>
                  </>
                )}
                {ragUploadPrompt.status === 'uploading' && (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span className="text-sm">Uploading to Knowledge Base...</span>
                  </>
                )}
                {ragUploadPrompt.status === 'success' && (
                  <>
                    <span>✅</span>
                    <span className="text-sm">{ragUploadPrompt.message}</span>
                  </>
                )}
                {ragUploadPrompt.status === 'error' && (
                  <>
                    <span>❌</span>
                    <span className="text-sm text-red-300">{ragUploadPrompt.message}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Hidden file inputs for import — rendered in DOM so browser user-gesture chain is preserved */}
          <input
            ref={importJsonInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleJsonFileChange}
          />
          <input
            ref={importDxfInputRef}
            type="file"
            accept=".dxf,.dwg,.dwf"
            style={{ display: "none" }}
            onChange={handleDxfFileChange}
          />

          {/* Top Right Widget (TOP) — hidden in 3D mode (ViewCube replaces it) */}
          {!show3D && (
          <div className="absolute top-6 right-6 w-16 h-16 bg-slate-50 dark:bg-[#151B23] transition-colors duration-300/90 backdrop-blur border border-slate-200 dark:border-[#1E293B] rounded flex flex-col items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer z-20 shadow-lg">
            <span className="text-[8px] font-bold text-cyan-400 mb-1">TOP</span>
            <div className="w-6 h-6 border-2 border-cyan-500/50 transform rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 border border-cyan-400"></div>
            </div>
          </div>
          )}

          {!isReadOnly && !showEstimation && (
            <AiCommandBox
              isAiLoading={isAiLoading}
              setIsAiLoading={setIsAiLoading}
              aiStreamCount={aiStreamCount}
              setAiStreamCount={setAiStreamCount}
            />
          )}
        </div>

        {/* Properties Palette - floats over the entire workspace */}
        {!showEstimation && <PropertyPanel />}
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
