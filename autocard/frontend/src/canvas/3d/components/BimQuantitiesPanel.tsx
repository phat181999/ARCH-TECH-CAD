import { useQuantities } from "../../bim/useQuantities";

export function BimQuantitiesPanel() {
  const { summary } = useQuantities();

  const rows: Array<{ label: string; value: string; unit: string; note?: string }> = [
    { label: "Tường (net, trừ cửa)", value: summary.totalWallNetArea.toFixed(2),         unit: "m²", note: `gross: ${summary.totalWallGrossArea.toFixed(2)} m²` },
    { label: "Sàn (net)",            value: summary.totalFloorNetArea.toFixed(2),         unit: "m²" },
    { label: "Bê tông (tổng)",       value: summary.totalConcreteVolume.toFixed(3),       unit: "m³", note: "tường + cột + sàn" },
    { label: "Ống MEP (tổng)",       value: (summary.totalPipeLength / 1000).toFixed(1),  unit: "m" },
    { label: "Diện tích phòng",      value: summary.roomTotalArea.toFixed(2),             unit: "m²", note: `${summary.roomCount} phòng` },
  ];

  const counts = [
    { label: "Tường",     value: summary.wallCount },
    { label: "Cửa đi",   value: summary.doorCount },
    { label: "Cửa sổ",   value: summary.windowCount },
    { label: "Cột",      value: summary.columnCount },
    { label: "Cầu thang", value: summary.stairCount },
  ];

  return (
    <div className="flex flex-col gap-3 p-3 text-xs overflow-y-auto">
      <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">
        Khối lượng BIM (tự động)
      </div>

      {/* Main quantities */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="bg-slate-800 rounded px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{row.label}</span>
              <span className="text-white font-mono font-bold">
                {row.value}
                <span className="text-slate-500 font-normal ml-1">{row.unit}</span>
              </span>
            </div>
            {row.note && (
              <div className="text-slate-600 text-[9px] mt-0.5">{row.note}</div>
            )}
          </div>
        ))}
      </div>

      {/* Element counts */}
      <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mt-1">
        Số lượng element
      </div>
      <div className="grid grid-cols-3 gap-1">
        {counts.map((c) => (
          <div key={c.label} className="bg-slate-800 rounded px-2 py-1.5 text-center">
            <div className="text-white font-mono font-bold text-sm">{c.value}</div>
            <div className="text-slate-500 text-[9px]">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="text-slate-600 text-[9px] mt-1 text-center">
        Cập nhật tự động khi thay đổi bản vẽ
      </div>
    </div>
  );
}
