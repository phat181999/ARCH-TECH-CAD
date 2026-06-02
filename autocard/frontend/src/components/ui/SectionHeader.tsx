import React from "react";

interface SectionHeaderProps {
  label: string;
  color: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  label,
  color,
  isCollapsible,
  isCollapsed,
  onToggle
}) => {
  return (
    <div
      onClick={isCollapsible ? onToggle : undefined}
      className={`flex items-center justify-between px-3 pt-4 pb-1.5 select-none ${
        isCollapsible ? "cursor-pointer hover:bg-slate-200/5 dark:hover:bg-white/5 rounded transition-colors" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-sm ${color}`} />
        <span className="text-[9px] font-black tracking-widest uppercase text-slate-500 dark:text-gray-400 transition-colors duration-300">
          {label}
        </span>
      </div>
      {isCollapsible && (
        <span className="text-[8px] font-bold text-slate-500 dark:text-gray-500">
          {isCollapsed ? "▶" : "▼"}
        </span>
      )}
    </div>
  );
};
