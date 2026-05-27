import React from "react";

interface SectionHeaderProps {
  label: string;
  color: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ label, color }) => {
  return (
    <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
      <div className={`w-2 h-2 rounded-sm ${color}`} />
      <span className="text-[9px] font-black tracking-widest uppercase text-slate-500 dark:text-gray-400 transition-colors duration-300">
        {label}
      </span>
    </div>
  );
};
