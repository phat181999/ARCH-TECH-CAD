import React from "react";

interface ToggleRowProps {
  label: string;
  icon: string;
  value: boolean;
  onChange: () => void;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({ label, icon, value, onChange }) => {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-gray-400 transition-colors duration-300">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <button
        onClick={onChange}
        className={`relative w-8 h-4 rounded-full transition-colors ${
          value ? "bg-cyan-500" : "bg-slate-200 dark:bg-[#1E293B] transition-colors duration-300"
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
};
