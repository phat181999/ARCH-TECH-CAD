import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, X, Package, Calendar, BarChart3, DollarSign } from "lucide-react";
import type { DrawingElement } from "../../../types";

interface BuildingSummaryPanelProps {
  elements: DrawingElement[];
  visible: boolean;
  onClose: () => void;
}

interface PhaseItem {
  id: string;
  label: string;
  color: string;
  durationDays: number;
  materials: { name: string; qty: string; unit: string }[];
}

export default function BuildingSummaryPanel({ elements, visible, onClose }: BuildingSummaryPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<"materials" | "timeline">("materials");

  const takeoff = useMemo(() => {
    let grossWallVolume = 0;
    let columnVolume = 0;
    let doorCount = 0;
    let windowCount = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasWalls = false;

    elements.forEach((el) => {
      if (el.archType === "wall" || el.type === "wall") {
        hasWalls = true;
        const x1 = el.x1 ?? el.x ?? 0;
        const y1 = el.y1 ?? el.y ?? 0;
        const x2 = el.x2 ?? (el.x ?? 0) + (el.width ?? 0);
        const y2 = el.y2 ?? (el.y ?? 0) + (el.height ?? 0);
        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);

        const dx = x2 - x1, dy = y2 - y1;
        const lengthMm = Math.sqrt(dx * dx + dy * dy);
        const thicknessMm = el.wallThickness || 200;
        const heightMm = el.height || 3000;
        grossWallVolume += (lengthMm * 0.001) * (thicknessMm * 0.001) * (heightMm * 0.001);
      } else if (el.archType === "door") {
        doorCount++;
      } else if (el.archType === "window") {
        windowCount++;
      } else if (el.type === "circle" && el.semanticRole?.toLowerCase().includes("column")) {
        const radiusM = (el.radius || 200) * 0.001;
        columnVolume += Math.PI * radiusM * radiusM * 3.0;
      } else if (el.type === "rectangle" && el.semanticRole?.toLowerCase().includes("column")) {
        columnVolume += ((el.width || 400) * 0.001) * ((el.height || 400) * 0.001) * 3.0;
      }
    });

    // Subtract opening volumes
    let openingVolume = 0;
    elements.forEach((el) => {
      if (el.archType === "door" || el.archType === "window") {
        const opWidth = (el.width || 900) * 0.001;
        const opHeight = (el.height || 2100) * 0.001;
        let wallThickM = 0.2;
        if (el.hostWall) {
          const host = elements.find(w => w.id === el.hostWall);
          if (host) wallThickM = (host.wallThickness || 200) * 0.001;
        }
        openingVolume += opWidth * opHeight * wallThickM;
      }
    });

    const netWallVolume = Math.max(0, grossWallVolume - openingVolume);

    let floorArea = 0;
    const rooms = elements.filter(el => el.archType === "room");
    if (rooms.length > 0) {
      rooms.forEach(r => { floorArea += typeof r.area === "number" ? r.area : 0; });
    }
    if (floorArea === 0 && hasWalls && minX !== Infinity) {
      floorArea = Math.min(1000, ((maxX - minX) * 0.001) * ((maxY - minY) * 0.001) * 0.85);
    }
    if (floorArea === 0) floorArea = 120;

    return { floorArea, netWallVolume, grossWallVolume, columnVolume, doorCount, windowCount };
  }, [elements]);

  const summary = useMemo(() => {
    const { floorArea, netWallVolume, columnVolume, doorCount, windowCount } = takeoff;

    // Concrete
    const foundationConcrete = +(floorArea * 0.15).toFixed(1);       // m³
    const structuralConcrete = +(columnVolume * 1.2 + floorArea * 0.12).toFixed(1); // m³
    const totalConcrete = +(foundationConcrete + structuralConcrete).toFixed(1);

    // Steel (rebar)
    const foundationSteel = +(foundationConcrete * 80).toFixed(0);   // kg
    const structuralSteel = +(structuralConcrete * 120).toFixed(0);  // kg
    const totalSteel = foundationSteel + structuralSteel;

    // Brick (for walls)
    // 1m³ wall = ~300 bricks (100x200x60 Việt Nam standard)
    const brickCount = Math.ceil(netWallVolume * 300);

    // Cement bags (plastering + mortar: ~0.4 bags/m² wall surface)
    const wallSurface = netWallVolume / 0.2; // approx wall surface m²
    const cementBags = Math.ceil(wallSurface * 0.4);

    // Sand m³ (mortar: 0.5 bags sand per bag cement)
    const sandM3 = +(cementBags * 0.025).toFixed(1);

    // Glass m² (windows each ~1.8m²)
    const glassM2 = +(windowCount * 1.8).toFixed(1);

    // Paint m² (wall surface both sides + ceiling)
    const paintM2 = Math.ceil(wallSurface * 2 + floorArea);

    // Roof tiles
    const roofTiles = Math.ceil(floorArea * 1.15 * 16); // ~16 tiles/m²

    // Wood for door frames (each door ~4m of frame)
    const doorWoodM = doorCount * 4;

    // Duration (same formula as EstimationDashboard)
    const durationDays = Math.ceil(30 + (floorArea * 0.4) + (columnVolume * 2) + (takeoff.netWallVolume * 0.2));

    // Cost estimate (VND)
    const concreteCost = totalConcrete * 1_400_000;
    const steelCost = (totalSteel / 1000) * 25_000_000;
    const brickCost = brickCount * 3_000;
    const cementCost = cementBags * 120_000;
    const paintCost = paintM2 * 55_000;
    const materialCost = concreteCost + steelCost + brickCost + cementCost + paintCost;
    const laborCost = materialCost * 0.35;
    const totalCost = materialCost + laborCost;

    return {
      floorArea,
      durationDays,
      totalCost,
      materials: [
        { name: "Bê tông tươi", qty: `${totalConcrete}`, unit: "m³", icon: "🧱", color: "#94a3b8" },
        { name: "Thép cốt bê tông", qty: `${(totalSteel / 1000).toFixed(2)}`, unit: "tấn", icon: "🔩", color: "#64748b" },
        { name: "Gạch xây tường", qty: `${brickCount.toLocaleString("vi-VN")}`, unit: "viên", icon: "🏗️", color: "#b45309" },
        { name: "Xi măng (vữa + trát)", qty: `${cementBags}`, unit: "bao 50kg", icon: "🪣", color: "#78716c" },
        { name: "Cát xây dựng", qty: `${sandM3}`, unit: "m³", icon: "⏳", color: "#d97706" },
        { name: "Kính (cửa sổ)", qty: `${glassM2}`, unit: "m²", icon: "🪟", color: "#0ea5e9" },
        { name: "Sơn tường & trần", qty: `${paintM2.toLocaleString("vi-VN")}`, unit: "m²", icon: "🎨", color: "#a855f7" },
        { name: "Ngói / Tôn mái", qty: `${roofTiles.toLocaleString("vi-VN")}`, unit: "viên", icon: "🏠", color: "#ef4444" },
        { name: "Gỗ khung cửa", qty: `${doorWoodM}`, unit: "m dài", icon: "🚪", color: "#92400e" },
      ],
    };
  }, [takeoff]);

  const phases = useMemo<PhaseItem[]>(() => {
    const { floorArea, netWallVolume, columnVolume } = takeoff;
    const totalDays = Math.ceil(30 + (floorArea * 0.4) + (columnVolume * 2) + (netWallVolume * 0.2));

    return [
      {
        id: "foundation",
        label: "1. Thi công Móng",
        color: "#b45309",
        durationDays: Math.ceil(totalDays * 0.18),
        materials: [
          { name: "Bê tông móng", qty: `${(floorArea * 0.15).toFixed(1)}`, unit: "m³" },
          { name: "Thép móng", qty: `${Math.ceil(floorArea * 0.15 * 80)}`, unit: "kg" },
        ],
      },
      {
        id: "structural",
        label: "2. Kết cấu cột, dầm, sàn",
        color: "#64748b",
        durationDays: Math.ceil(totalDays * 0.25),
        materials: [
          { name: "Bê tông kết cấu", qty: `${(columnVolume * 1.2 + floorArea * 0.12).toFixed(1)}`, unit: "m³" },
          { name: "Thép kết cấu", qty: `${Math.ceil((columnVolume * 1.2 + floorArea * 0.12) * 120 / 1000)}`, unit: "tấn" },
        ],
      },
      {
        id: "walls",
        label: "3. Xây tường bao & ngăn",
        color: "#92400e",
        durationDays: Math.ceil(totalDays * 0.20),
        materials: [
          { name: "Gạch xây", qty: `${Math.ceil(netWallVolume * 300).toLocaleString("vi-VN")}`, unit: "viên" },
          { name: "Xi măng vữa", qty: `${Math.ceil((netWallVolume / 0.2) * 0.4)}`, unit: "bao" },
        ],
      },
      {
        id: "roofmep",
        label: "4. Mái & Điện nước (MEP)",
        color: "#0f766e",
        durationDays: Math.ceil(totalDays * 0.20),
        materials: [
          { name: "Ngói / Tôn mái", qty: `${Math.ceil(floorArea * 1.15 * 16).toLocaleString("vi-VN")}`, unit: "viên" },
          { name: "Ống PVC điện nước", qty: `${Math.ceil(floorArea * 1.2)}`, unit: "m" },
        ],
      },
      {
        id: "finishes",
        label: "5. Hoàn thiện & Sơn",
        color: "#7c3aed",
        durationDays: Math.ceil(totalDays * 0.17),
        materials: [
          { name: "Sơn tường & trần", qty: `${Math.ceil((netWallVolume / 0.2) * 2 + floorArea).toLocaleString("vi-VN")}`, unit: "m²" },
          { name: "Gạch ốp lát", qty: `${Math.ceil(floorArea * 1.05).toLocaleString("vi-VN")}`, unit: "m²" },
        ],
      },
    ];
  }, [takeoff]);

  const totalPhaseDays = phases.reduce((s, p) => s + p.durationDays, 0);

  const fmtCost = (val: number) =>
    val >= 1_000_000_000
      ? `${(val / 1_000_000_000).toFixed(2)} tỷ`
      : `${(val / 1_000_000).toFixed(0)} tr. ₫`;

  if (!visible) return null;

  return (
    <div
      className="absolute right-4 top-16 z-40 w-80 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Vật liệu & Tiến độ XD</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-px border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="flex flex-col items-center py-3 px-2">
              <BarChart3 className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-base font-bold text-white">{summary.floorArea.toFixed(0)}<span className="text-xs font-normal text-slate-400"> m²</span></span>
              <span className="text-[10px] text-slate-500 mt-0.5">Diện tích sàn</span>
            </div>
            <div className="flex flex-col items-center py-3 px-2 border-x border-white/10">
              <Calendar className="w-4 h-4 text-amber-400 mb-1" />
              <span className="text-base font-bold text-white">{summary.durationDays}<span className="text-xs font-normal text-slate-400"> ngày</span></span>
              <span className="text-[10px] text-slate-500 mt-0.5">Thời gian XD</span>
            </div>
            <div className="flex flex-col items-center py-3 px-2">
              <DollarSign className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-sm font-bold text-white">{fmtCost(summary.totalCost)}</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Ước tính</span>
            </div>
          </div>

          {/* Tab switch */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveSection("materials")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeSection === "materials"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Vật liệu cần mua
            </button>
            <button
              onClick={() => setActiveSection("timeline")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeSection === "timeline"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Tiến độ thi công
            </button>
          </div>

          {/* Materials list */}
          {activeSection === "materials" && (
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {summary.materials.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                  <span className="text-base w-5 flex-shrink-0">{m.icon}</span>
                  <span className="flex-1 text-xs text-slate-300 leading-tight">{m.name}</span>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{m.qty}</span>
                    <span className="text-[10px] text-slate-500 ml-1">{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timeline / Gantt */}
          {activeSection === "timeline" && (
            <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
              {phases.map((phase, idx) => {
                const startDays = phases.slice(0, idx).reduce((s, p) => s + p.durationDays, 0);
                const widthPct = (phase.durationDays / totalPhaseDays) * 100;
                const startPct = (startDays / totalPhaseDays) * 100;
                return (
                  <div key={phase.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] text-slate-300 font-medium">{phase.label}</span>
                      <span className="text-[10px] text-slate-500">{phase.durationDays} ngày</span>
                    </div>
                    {/* Gantt bar */}
                    <div className="relative h-5 rounded bg-white/5 overflow-hidden">
                      <div
                        className="absolute h-full rounded"
                        style={{
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          background: phase.color,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    {/* Mini material list */}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {phase.materials.map(mat => (
                        <span key={mat.name} className="text-[10px] text-slate-500">
                          {mat.name}: <span className="text-slate-400">{mat.qty} {mat.unit}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/10 flex justify-between">
                <span className="text-[11px] text-slate-400">Tổng thời gian</span>
                <span className="text-[11px] font-semibold text-amber-400">~{summary.durationDays} ngày ({Math.ceil(summary.durationDays / 30)} tháng)</span>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="px-4 py-2 border-t border-white/5">
            <p className="text-[10px] text-slate-600">
              Tính từ bản vẽ hiện tại · Số liệu mang tính tham khảo
            </p>
          </div>
        </>
      )}
    </div>
  );
}
