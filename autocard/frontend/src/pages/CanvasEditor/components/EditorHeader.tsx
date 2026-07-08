import React, { useState, useEffect, useRef } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useThemeStore } from "../../../stores/themeStore";
import { useAuthStore } from "../../../stores/authStore";
import { ToolType } from "../../../types";
import {
  Sun, Moon, ChevronDown, ChevronLeft,
  MousePointer2, RectangleHorizontal, DoorOpen, Pen, Square, Circle, Type, Ruler, ArrowUpRight, Grid3X3, Hand,
  Upload, Download, Save, Zap, Cable
} from "lucide-react";

const TOOLS: { id: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "select",    label: "Select (V)",    Icon: MousePointer2 },
  { id: "wall",      label: "Wall",          Icon: RectangleHorizontal },
  { id: "door",      label: "Door",          Icon: DoorOpen },
  { id: "pipe",      label: "Pipe/Wire",     Icon: Cable },
  { id: "line",      label: "Line (L)",      Icon: Pen },
  { id: "rectangle", label: "Rectangle (R)", Icon: Square },
  { id: "circle",    label: "Circle (C)",    Icon: Circle },
  { id: "text",      label: "Text (T)",      Icon: Type },
  { id: "dimension", label: "Dimension (D)", Icon: Ruler },
  { id: "leader",    label: "Leader",        Icon: ArrowUpRight },
  { id: "hatch",     label: "Hatch (H)",     Icon: Grid3X3 },
  { id: "pan",       label: "Pan (P)",       Icon: Hand },
];

interface EditorHeaderProps {
  onBack: () => void;
  show3D: boolean;
  setShow3D: (show: boolean) => void;
  showPaperSpace: boolean;
  setShowPaperSpace: (show: boolean) => void;
  showViews: boolean;
  setShowViews: (show: boolean) => void;
  showEstimation: boolean;
  setShowEstimation: (show: boolean) => void;
  onImportDxf: () => void;
  onImportJson: () => void;
  onImportIfc: () => void;
  onExportCanvas: (format: string) => void;
  onSave: () => void;
  saveStatus: string;
  turboMode: boolean;
  setTurboMode: (val: boolean) => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  onBack,
  show3D,
  setShow3D,
  showPaperSpace,
  setShowPaperSpace,
  showViews,
  setShowViews,
  showEstimation,
  setShowEstimation,
  onImportDxf,
  onImportJson,
  onImportIfc,
  onExportCanvas,
  onSave,
  saveStatus,
  turboMode,
  setTurboMode,
}) => {
  const tool = useDrawingStore((state) => state.tool);
  const setTool = useDrawingStore((state) => state.setTool);
  const zoom = useDrawingStore((state) => state.zoom);
  const setZoom = useDrawingStore((state) => state.setZoom);
  const setPanOffset = useDrawingStore((state) => state.setPanOffset);
  const loading = useDrawingStore((state) => state.loading);
  const currentDrawing = useDrawingStore((state) => state.currentDrawing);
  const permissions = useDrawingStore((state) => state.permissions);
  const fetchPermissions = useDrawingStore((state) => state.fetchPermissions);
  const unit = useDrawingStore((state) => state.unit);
  const setUnit = useDrawingStore((state) => state.setUnit);

  const { user } = useAuthStore();
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const importDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentDrawing?.id) {
      fetchPermissions(currentDrawing.id);
    }
  }, [currentDrawing?.id, fetchPermissions]);

  // Ownership is unknown until both the drawing and user load — don't flash
  // the Read Only badge at the actual owner while fetchMe() is in flight.
  const permissionsResolved = Boolean(currentDrawing && user);
  const isOwner = Boolean(currentDrawing && user && (currentDrawing.user?.id === user.id || (currentDrawing as any).user_id === user.id));
  const userPermission = permissions.find((p) => p.user_id === user?.id || p.email === user?.email);
  const userRole = isOwner ? "owner" : (userPermission?.role || "viewer");
  const isReadOnly = permissionsResolved && userRole === "viewer";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
        setShowImportDropdown(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => { document.removeEventListener("click", handleClickOutside); };
  }, []);

  const viewBtnCls = (active: boolean) =>
    `px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
    }`;

  const dropdownItemCls = "w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2 transition-colors";

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 shrink-0 z-10 shadow-sm">
      {/* Left: back + project info */}
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors group"
          onClick={onBack}
        >
          <ChevronLeft className="w-4 h-4" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-none">
              {currentDrawing?.name || "Drawing Project"}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                v{currentDrawing?.version || "1"}
              </span>
              {isReadOnly && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                  View Only
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Tool buttons */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTool(id as ToolType)}
              className={`p-1.5 rounded transition-colors ${
                tool === id
                  ? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-1">
          <button
            onClick={() => setZoom(Math.max(0.1, zoom / 1.25))}
            className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Zoom Out"
          >
            −
          </button>
          <span className="text-xs font-mono text-slate-700 dark:text-slate-300 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom * 1.25)}
            className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
            className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            title="Fit Screen"
          >
            FIT
          </button>
        </div>
      </div>

      {/* Right: view switch, selects, import/export, save, theme, avatar */}
      <div className="flex items-center gap-2">
        {/* View switch */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button className={viewBtnCls(!show3D && !showPaperSpace && !showEstimation && !showViews)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(false); setShowViews(false); }}>Mô hình 2D</button>
          <button className={viewBtnCls(show3D)} onClick={() => { setShow3D(true); setShowPaperSpace(false); setShowEstimation(false); setShowViews(false); }}>Mô hình 3D</button>
          <button className={viewBtnCls(showViews)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(false); setShowViews(true); }} title="Bản vẽ 2D tự động từ mô hình 3D">Bản vẽ</button>
          <button className={viewBtnCls(showPaperSpace)} onClick={() => { setShow3D(false); setShowPaperSpace(true); setShowEstimation(false); setShowViews(false); }} title="Layout / Paper Space">Layout</button>
          <button className={viewBtnCls(showEstimation)} onClick={() => { setShow3D(false); setShowPaperSpace(false); setShowEstimation(true); setShowViews(false); }} title="Dự toán & Vật tư">Dự toán</button>
        </div>

        {/* Turbo Mode Toggle */}
        {!show3D && !showPaperSpace && !showEstimation && (
          <button
            onClick={() => setTurboMode(!turboMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              turboMode
                ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-500/40 hover:text-amber-500"
            }`}
            title="WebGL 2D Turbo Mode (60 FPS for large DXFs)"
          >
            <Zap className="w-3.5 h-3.5" />
            Turbo
          </button>
        )}

        <select
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-1.5 rounded-lg outline-none focus:border-blue-500"
        >
          <option>1:100</option>
          <option>1:50</option>
          <option>1:200</option>
        </select>

        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as any)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-1.5 rounded-lg outline-none focus:border-blue-500"
        >
          <option value="m">m</option>
          <option value="mm">mm</option>
          <option value="ft">ft</option>
          <option value="in">in</option>
        </select>

        {/* Import dropdown */}
        <div className="relative" ref={importDropdownRef}>
          <button
            onClick={() => { setShowImportDropdown(!showImportDropdown); setShowExportDropdown(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
            <ChevronDown className="w-3 h-3" />
          </button>
          {showImportDropdown && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-50">
              <button onClick={() => { onImportDxf(); setShowImportDropdown(false); }} className={dropdownItemCls}>
                <Upload className="w-3.5 h-3.5" /> DXF / DWG / DWF
              </button>
              <button onClick={() => { onImportJson(); setShowImportDropdown(false); }} className={dropdownItemCls}>
                <Upload className="w-3.5 h-3.5" /> JSON File
              </button>
              <button onClick={() => { onImportIfc(); setShowImportDropdown(false); }} className={dropdownItemCls}>
                <Upload className="w-3.5 h-3.5" /> IFC (BIM)
              </button>
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => { setShowExportDropdown(!showExportDropdown); setShowImportDropdown(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>
          {showExportDropdown && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-50">
              {[
                { label: "PNG Image", format: "png" },
                { label: "SVG Vector", format: "svg" },
                { label: "DXF CAD File", format: "dxf" },
                { label: "JSON Data", format: "json" },
              ].map(({ label, format }) => (
                <button key={format} onClick={() => { onExportCanvas(format); setShowExportDropdown(false); }} className={dropdownItemCls}>
                  <Download className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-800 my-0.5" />
              <button onClick={() => { window.print(); setShowExportDropdown(false); }} className={dropdownItemCls}>
                <Download className="w-3.5 h-3.5" /> PDF Print
              </button>
            </div>
          )}
        </div>

        {isReadOnly ? (
          <span className="px-3 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
            Read Only
          </span>
        ) : (
          <button
            onClick={onSave}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {loading ? "Saving..." : saveStatus || "Save"}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700">
          <img src="https://i.pravatar.cc/100" alt="avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
};
