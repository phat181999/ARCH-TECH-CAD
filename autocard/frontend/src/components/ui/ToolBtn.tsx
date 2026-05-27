import React from "react";
import { getDroppedToolType } from "../../canvas/drop";

interface ToolBtnProps {
  label: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
  shortcut?: string;
  disabled?: boolean;
  dragToolId?: string;
}

export const ToolBtn: React.FC<ToolBtnProps> = ({
  label,
  icon,
  active,
  onClick,
  shortcut,
  disabled,
  dragToolId,
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
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded transition-all text-left group ${
        active
          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
          : disabled
          ? "text-gray-600 cursor-not-allowed"
          : "text-slate-500 dark:text-gray-400 transition-colors duration-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] hover:text-gray-200 border border-transparent"
      }`}
    >
      <span className="text-sm w-4 text-center flex-shrink-0">{icon}</span>
      <span className="text-[11px] font-semibold flex-1">{label}</span>
      {shortcut && (
        <span
          className={`text-[9px] font-mono px-1 py-0.5 rounded ${
            active
              ? "bg-cyan-500/20 text-cyan-400"
              : "bg-slate-200 dark:bg-[#1E293B] text-gray-600 group-hover:text-slate-500 dark:text-gray-400 transition-colors duration-300"
          }`}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};
