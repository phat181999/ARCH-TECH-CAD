interface PropertiesSectionProps {
  selectedElement?: any;
  activeLayer?: { name?: string; id?: string };
}

export function PropertiesSection({ selectedElement, activeLayer }: PropertiesSectionProps) {
  return (
    <div className="px-3 pb-2 space-y-2">
      {selectedElement ? (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "X", value: selectedElement.x?.toFixed(1) ?? "—" },
              { label: "Y", value: selectedElement.y?.toFixed(1) ?? "—" },
              { label: "W", value: selectedElement.width?.toFixed(1) ?? "—" },
              { label: "H", value: selectedElement.height?.toFixed(1) ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[8px] font-bold text-slate-500 dark:text-gray-400 uppercase">{label}</span>
                <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-300 transition-colors duration-300">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-500 dark:text-gray-400 uppercase mb-1">Layer</span>
            <div className="bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-300 transition-colors duration-300">
              {activeLayer?.name ?? "—"}
            </div>
          </div>
        </>
      ) : (
        <div className="text-[10px] text-slate-500 dark:text-gray-400 italic py-1 px-1">
          Select an object to inspect
        </div>
      )}
    </div>
  );
}
