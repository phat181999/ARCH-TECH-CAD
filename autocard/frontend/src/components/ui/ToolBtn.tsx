import React from "react";
import { getDroppedToolType } from "../../canvas/drop";

interface ToolBtnProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  shortcut?: string;
  disabled?: boolean;
  dragToolId?: string;
  compact?: boolean;
}

export const ToolBtn: React.FC<ToolBtnProps> = ({
  label,
  icon,
  active,
  onClick,
  shortcut,
  disabled,
  dragToolId,
  compact,
}) => {
  const draggable = !disabled && !!getDroppedToolType(dragToolId);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable || !dragToolId) return;
        e.dataTransfer.setData("toolId", dragToolId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`w-full flex items-center ${compact ? "gap-1.5 px-2 py-1" : "gap-2.5 px-3 py-1.5"} rounded transition-all text-left group ${
        active
          ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/30"
          : disabled
          ? "text-slate-400 dark:text-slate-600 cursor-not-allowed"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
      }`}
    >
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className={`${compact ? "text-xs" : "text-xs"} font-semibold flex-1 truncate`}>{label}</span>
      {shortcut && !compact && (
        <span
          className={`text-[10px] font-mono px-1 py-0.5 rounded ${
            active
              ? "bg-blue-600/10 text-blue-600 dark:text-blue-400"
              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors"
          }`}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};
