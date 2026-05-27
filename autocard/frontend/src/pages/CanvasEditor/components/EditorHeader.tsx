import React, { useState, useEffect, useRef } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { useThemeStore } from "../../../stores/themeStore";
import { useAuthStore } from "../../../stores/authStore";
import { ToolType } from "../../../types";
import { Sun, Moon, ChevronDown } from "lucide-react";

const TOOLS = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "wall", label: "Wall", icon: "▤" },
  { id: "door", label: "Door", icon: "🚪" },
  { id: "line", label: "Line", icon: "╱" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "circle", label: "Circle", icon: "○" },
  { id: "text", label: "Text", icon: "T" },
  { id: "dimension", label: "Dimension", icon: "📏" },
  { id: "leader", label: "Leader", icon: "➤" },
  { id: "hatch", label: "Hatch", icon: "▓" },
  { id: "pan", label: "Pan", icon: "✋" },
];

interface EditorHeaderProps {
  onBack: () => void;
  show3D: boolean;
  setShow3D: (show: boolean) => void;
  onImportDxf: () => void;
  onImportJson: () => void;
  onExportCanvas: (format: string) => void;
  onSave: () => void;
  saveStatus: string;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  onBack,
  show3D,
  setShow3D,
  onImportDxf,
  onImportJson,
  onExportCanvas,
  onSave,
  saveStatus,
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

  const isOwner = currentDrawing && user && currentDrawing.user_id === user.id;
  const userPermission = permissions.find(
    (p) => p.user_id === user?.id || p.email === user?.email
  );
  const userRole = isOwner ? "owner" : (userPermission?.role || "viewer");
  const isReadOnly = userRole === "viewer";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        importDropdownRef.current &&
        !importDropdownRef.current.contains(event.target as Node)
      ) {
        setShowImportDropdown(false);
      }
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <header className="h-14 bg-slate-50 dark:bg-[#151B23] transition-colors duration-300 border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
      <div className="flex items-center space-x-6">
        <div className="flex items-center cursor-pointer group" onClick={onBack}>
          <svg
            className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400 transition-colors duration-300 group-hover:text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {currentDrawing?.name || "Drawing Project"}
            </span>
            <div className="flex items-center">
              <span className="font-bold tracking-wider text-cyan-400 text-sm">
                v{currentDrawing?.version || "1"}
              </span>
              {isReadOnly && (
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase ml-2 select-none border border-slate-300 dark:border-slate-700">
                  View Only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-[#1E293B] mx-2"></div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-mono font-bold text-slate-500 mr-2 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded">
            PEN_SIZE
          </span>
          {TOOLS.slice(0, 8).map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id as ToolType)}
              className={`p-1.5 rounded text-sm font-medium transition-colors ${
                tool === t.id
                  ? "text-cyan-400"
                  : "text-slate-500 hover:text-slate-900 dark:text-white"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 ml-4 bg-slate-100 dark:bg-[#11161D] rounded p-1 border border-slate-200 dark:border-[#1E293B]">
          <button
            onClick={() => setTool("pan")}
            className={`px-2 py-1 rounded text-[9px] font-bold transition-colors ${
              tool === "pan"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-slate-500 hover:text-slate-700 dark:text-gray-300"
            }`}
            title="Pan Tool (P)"
          >
            ✋ PAN
          </button>
          <div className="w-px h-3 bg-slate-200 dark:bg-[#1E293B] mx-1"></div>
          <button
            onClick={() => setZoom(Math.max(0.1, zoom / 1.25))}
            className="px-2 py-1 rounded text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:text-gray-300"
            title="Zoom Out"
          >
            Z-
          </button>
          <button
            onClick={() => setZoom(zoom * 1.25)}
            className="px-2 py-1 rounded text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:text-gray-300"
            title="Zoom In"
          >
            Z+
          </button>
          <div className="w-px h-3 bg-slate-200 dark:bg-[#1E293B] mx-1"></div>
          <span className="text-[9px] font-mono font-bold text-cyan-400 px-1">{Math.round(zoom * 100)}%</span>
          <div className="w-px h-3 bg-slate-200 dark:bg-[#1E293B] mx-1"></div>
          <button
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="px-2 py-1 rounded text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:text-gray-300"
            title="Fit Screen"
          >
            FIT
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 rounded text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:text-gray-300"
            title="Reset View"
          >
            1:1
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <select className="bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded outline-none focus:border-cyan-500">
          <option>1:100</option>
          <option>1:50</option>
          <option>1:200</option>
        </select>

        <div className="flex items-center bg-slate-100 dark:bg-[#11161D] rounded border border-slate-200 dark:border-[#1E293B] overflow-hidden">
          <button
            className={`px-3 py-1 text-[10px] font-bold ${
              !show3D ? "bg-cyan-500 text-slate-900" : "text-slate-500 dark:text-slate-400 hover:text-gray-200"
            }`}
            onClick={() => setShow3D(false)}
          >
            2D
          </button>
          <button
            className={`px-3 py-1 text-[10px] font-bold ${
              show3D ? "bg-cyan-500 text-slate-900" : "text-slate-500 dark:text-slate-400 hover:text-gray-200"
            }`}
            onClick={() => setShow3D(true)}
          >
            3D
          </button>
        </div>

        {/* Import Dropdown */}
        <div className="relative" ref={importDropdownRef}>
          <button
            onClick={() => {
              setShowImportDropdown(!showImportDropdown);
              setShowExportDropdown(false);
            }}
            className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:bg-slate-200 dark:hover:bg-[#1E293B] rounded text-slate-700 dark:text-gray-300 flex items-center gap-1"
            title="Import File"
          >
            <span>📥</span> Import <ChevronDown className="w-3 h-3" />
          </button>
          {showImportDropdown && (
            <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#141921]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded shadow-xl py-1 z-50">
              <button
                onClick={() => {
                  onImportDxf();
                  setShowImportDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
              >
                <span>📥</span> DXF / DWG / DWF File
              </button>
              <button
                onClick={() => {
                  onImportJson();
                  setShowImportDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
              >
                <span>📂</span> JSON File
              </button>
            </div>
          )}
        </div>

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => {
              setShowExportDropdown(!showExportDropdown);
              setShowImportDropdown(false);
            }}
            className="px-3 py-1 text-[10px] font-bold bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:bg-slate-200 dark:hover:bg-[#1E293B] rounded text-slate-700 dark:text-gray-300 flex items-center gap-1"
            title="Export File"
          >
            <span>📤</span> Export <ChevronDown className="w-3 h-3" />
          </button>
          {showExportDropdown && (
            <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#141921]/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded shadow-xl py-1 z-50">
              {[
                { label: "PNG Image", icon: "🖼", format: "png" },
                { label: "SVG Vector", icon: "📐", format: "svg" },
                { label: "DXF CAD File", icon: "📋", format: "dxf" },
                { label: "JSON Data", icon: "💾", format: "json" },
              ].map(({ label, icon, format }) => (
                <button
                  key={format}
                  onClick={() => {
                    onExportCanvas(format);
                    setShowExportDropdown(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
              <div className="border-t border-slate-200 dark:border-slate-700 my-0.5"></div>
              <button
                onClick={() => {
                  window.print();
                  setShowExportDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
              >
                <span>📄</span> PDF Print
              </button>
            </div>
          )}
        </div>

        {isReadOnly ? (
          <span className="px-4 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 cursor-not-allowed select-none">
            READ ONLY
          </span>
        ) : (
          <button
            onClick={onSave}
            disabled={loading}
            className="px-4 py-1 text-[10px] font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all"
          >
            {loading ? "SAVING..." : saveStatus || "SAVE"}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-1.5 ml-2 text-slate-500 dark:text-slate-400 hover:text-cyan-400 dark:hover:text-cyan-400"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-700 ml-2">
          <img src="https://i.pravatar.cc/100" alt="avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
};
