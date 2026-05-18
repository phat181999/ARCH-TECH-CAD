import { useState, useRef, useCallback } from "react";
import type { DrawingElement } from "../types";

const PAPER_SIZES: Record<string, { w: number; h: number }> = {
  "A4": { w: 210, h: 297 },
  "A3": { w: 297, h: 420 },
  "A2": { w: 420, h: 594 },
  "A1": { w: 594, h: 841 },
  "A0": { w: 841, h: 1189 },
  "Letter": { w: 215.9, h: 279.4 },
  "Legal": { w: 215.9, h: 355.6 },
};

const SCALES = [
  { label: "1:1", value: 1 },
  { label: "1:10", value: 0.1 },
  { label: "1:50", value: 0.02 },
  { label: "1:100", value: 0.01 },
  { label: "1:200", value: 0.005 },
];

interface PaperSpaceProps {
  elements: DrawingElement[];
  visible: boolean;
  onClose: () => void;
}

export default function PaperSpace({ elements, visible, onClose }: PaperSpaceProps) {
  const [layouts, setLayouts] = useState([
    { id: "layout-1", name: "Layout 1", paperSize: "A4", scale: 0.01, viewport: { x: 20, y: 20, w: 170, h: 257 } },
  ]);
  const [activeLayout, setActiveLayout] = useState("layout-1");
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printScale, setPrintScale] = useState(0.01);
  const [printSize, setPrintSize] = useState("A4");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeLayoutData = layouts.find((l) => l.id === activeLayout);

  const drawLayout = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeLayoutData) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect()!;
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const paper = PAPER_SIZES[activeLayoutData.paperSize] || PAPER_SIZES["A4"];
    const scale = activeLayoutData.scale || 0.01;

    const margin = 20;
    const paperW = paper.w * scale * 10;
    const paperH = paper.h * scale * 10;
    const offsetX = (rect.width - paperW) / 2;
    const offsetY = (rect.height - paperH) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(offsetX, offsetY, paperW, paperH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, paperW, paperH);

    const tbW = 180;
    const tbH = 60;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(offsetX + paperW - tbW - 10, offsetY + paperH - tbH - 10, tbW, tbH);
    ctx.fillStyle = "#333";
    ctx.font = "8px Arial";
    ctx.textAlign = "left";
    ctx.fillText("ARCH-TECH-CAD", offsetX + paperW - tbW - 5, offsetY + paperH - tbH + 12);
    ctx.fillText(`Scale: 1:${Math.round(1 / scale)}`, offsetX + paperW - tbW - 5, offsetY + paperH - tbH + 24);
    ctx.fillText(`Paper: ${activeLayoutData.paperSize}`, offsetX + paperW - tbW - 5, offsetY + paperH - tbH + 36);
    ctx.fillText(new Date().toLocaleDateString(), offsetX + paperW - tbW - 5, offsetY + paperH - tbH + 48);

    const vp = activeLayoutData.viewport;
    const vpX = offsetX + vp.x * scale * 10;
    const vpY = offsetY + vp.y * scale * 10;
    const vpW = vp.w * scale * 10;
    const vpH = vp.h * scale * 10;

    ctx.save();
    ctx.beginPath();
    ctx.rect(vpX, vpY, vpW, vpH);
    ctx.clip();

    ctx.translate(vpX + vpW / 2, vpY + vpH / 2);
    ctx.scale(scale, scale);

    elements.forEach((el: DrawingElement) => {
      ctx.save();
      ctx.strokeStyle = el.strokeColor || "#1f2937";
      ctx.fillStyle = el.fillColor || "transparent";
      ctx.lineWidth = el.strokeWidth || 2;

      if (el.type === "rectangle") {
        ctx.strokeRect(el.x!, el.y!, el.width!, el.height!);
        if (el.fillColor && el.fillColor !== "transparent") {
          ctx.fillRect(el.x!, el.y!, el.width!, el.height!);
        }
      } else if (el.type === "circle") {
        ctx.beginPath();
        ctx.arc(el.cx!, el.cy!, el.radius!, 0, Math.PI * 2);
        ctx.stroke();
        if (el.fillColor && el.fillColor !== "transparent") ctx.fill();
      } else if (el.type === "line") {
        ctx.beginPath();
        ctx.moveTo(el.x1!, el.y1!);
        ctx.lineTo(el.x2!, el.y2!);
        ctx.stroke();
      } else if (el.type === "text") {
        ctx.fillStyle = el.strokeColor || "#1f2937";
        ctx.font = `${el.fontSize || 16}px Arial`;
        ctx.fillText(el.text || "", el.x!, el.y!);
      }

      ctx.restore();
    });

    ctx.restore();

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.setLineDash([]);
  }, [activeLayoutData, elements]);

  const drawRef = useRef(drawLayout);
  drawRef.current = drawLayout;
  useCallback(() => { drawRef.current(); }, [drawLayout]);

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${activeLayoutData?.name || "layout"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const addLayout = () => {
    const id = `layout-${Date.now()}`;
    setLayouts([...layouts, { id, name: `Layout ${layouts.length + 1}`, paperSize: "A4", scale: 0.01, viewport: { x: 20, y: 20, w: 170, h: 257 } }]);
    setActiveLayout(id);
  };

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 bg-gray-800 flex flex-col">
      <div className="bg-gray-700 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-300 hover:text-white px-2 py-1 text-sm">
          ← Back to Model
        </button>
        <span className="text-gray-400 text-sm">|</span>
        <span className="text-gray-300 text-sm font-medium">Paper Space</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLayout(l.id)}
              className={`px-3 py-1 text-sm rounded ${
                activeLayout === l.id ? "bg-blue-600 text-white" : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              {l.name}
            </button>
          ))}
          <button onClick={addLayout} className="px-2 py-1 text-sm text-gray-300 hover:text-white">
            + Layout
          </button>
        </div>
        <button
          onClick={() => setShowPrintDialog(!showPrintDialog)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Plot/Print
        </button>
      </div>

      {showPrintDialog && (
        <div className="bg-gray-700 border-b border-gray-600 px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm">Paper Size:</label>
            <select
              value={printSize}
              onChange={(e) => setPrintSize(e.target.value)}
              className="bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500"
            >
              {Object.keys(PAPER_SIZES).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm">Scale:</label>
            <select
              value={printScale}
              onChange={(e) => setPrintScale(parseFloat(e.target.value))}
              className="bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500"
            >
              {SCALES.map((s) => (
                <option key={s.label} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Export PNG
          </button>
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) {
                const win = window.open("")!;
                win.document.write(`<img src="${canvas.toDataURL("image/png")}" onload="window.print();window.close()" />`);
              }
            }}
            className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Print
          </button>
        </div>
      )}

      <div className="flex-1 bg-gray-600 overflow-hidden p-4">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  );
}
