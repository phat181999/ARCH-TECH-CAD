/**
 * IfcImportPanel — drag-drop or file-picker for IFC files.
 * Shows import summary, then calls addElements from the drawing store.
 */
import { useState, useCallback } from "react";
import { importIfcBuffer, type IfcImportResult } from "../canvas/bim/ifcImporter";
import { useDrawingStore } from "../stores/drawingStore";

interface IfcImportPanelProps {
  onClose: () => void;
}

type ImportState = "idle" | "parsing" | "done" | "error";

export function IfcImportPanel({ onClose }: IfcImportPanelProps) {
  const [state, setState]       = useState<ImportState>("idle");
  const [result, setResult]     = useState<IfcImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const addElements = useDrawingStore((s) => s.addElements);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setState("parsing");
    try {
      const buffer = await file.arrayBuffer();
      const res    = await importIfcBuffer(buffer);
      setResult(res);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định");
      setState("error");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".ifc") || file.name.endsWith(".ifczip"))) {
      void handleFile(file);
    }
  }, [handleFile]);

  const openFilePicker = useCallback(() => {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = ".ifc,.ifczip";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void handleFile(file);
    };
    input.click();
  }, [handleFile]);

  const handleImport = useCallback(() => {
    if (!result) return;
    addElements(result.elements);
    onClose();
  }, [result, addElements, onClose]);

  return (
    <div className="flex flex-col gap-4 p-4 min-w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-sm">Import IFC</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Drop zone */}
      {state === "idle" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={openFilePicker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openFilePicker(); }}
          className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="text-4xl mb-3">🏗</div>
          <div className="text-slate-300 text-sm font-medium">Kéo thả file IFC vào đây</div>
          <div className="text-slate-500 text-xs mt-1">hoặc click để chọn file (.ifc, .ifczip)</div>
          <div className="text-slate-600 text-xs mt-2">Hỗ trợ: IFC 2x3, IFC 4 (Revit, ArchiCAD, Tekla)</div>
        </div>
      )}

      {/* Parsing */}
      {state === "parsing" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-slate-300 text-sm">Đang phân tích {fileName}...</div>
          <div className="text-slate-500 text-xs">web-ifc WASM đang chạy, vui lòng chờ</div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div className="flex flex-col gap-3">
          <div className="bg-red-900/40 border border-red-700 rounded p-3 text-red-300 text-xs">
            {errorMsg}
          </div>
          <button
            onClick={() => { setState("idle"); setErrorMsg(""); }}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded py-1.5"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Done — summary */}
      {state === "done" && result && (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-lg p-3 flex flex-col gap-1.5">
            <div className="text-slate-300 text-xs font-bold mb-1">
              ✅ Phân tích xong: {fileName}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
              {(Object.entries(result.summary) as Array<[string, number]>).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-slate-500 capitalize">{k}</span>
                  <span className="text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>

            {result.storeys.length > 0 && (
              <div className="mt-2">
                <div className="text-slate-500 text-xs mb-1">Tầng phát hiện:</div>
                {result.storeys.map((s) => (
                  <div key={s.id} className="text-xs text-slate-400 flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-mono">{(s.elevation / 1000).toFixed(2)}m</span>
                  </div>
                ))}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="text-yellow-600 text-xs mt-1">
                ⚠ {result.warnings.length} cảnh báo khi parse
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded py-2 font-medium"
            >
              Import {result.elements.length} elements →
            </button>
            <button
              onClick={() => { setState("idle"); setResult(null); }}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs rounded py-2 px-3"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
