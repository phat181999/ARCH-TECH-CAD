import React from "react";

export interface ImportConfirmDialogProps {
  dialog: {
    title: string;
    description: string;
    detailSteps?: string[];
    showConvertBtn?: boolean;
    onConvert?: () => void;
    onReplace?: () => void;
    onMerge?: () => void;
  };
  onClose: () => void;
}

export const ImportConfirmDialog: React.FC<ImportConfirmDialogProps> = ({ dialog, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#0B0E14]/65 dark:bg-[#0B0E14]/80 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
            <svg className="w-4 h-4 mr-2 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {dialog.title}
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed font-medium">
            {dialog.description}
          </p>
          {dialog.detailSteps && (
            <ol className="space-y-1.5 pl-1">
              {dialog.detailSteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end space-x-3 bg-white dark:bg-[#151B23]">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">
            Cancel
          </button>
          {dialog.showConvertBtn ? (
            <button
              onClick={() => {
                if (dialog.onConvert) {
                  dialog.onConvert();
                }
              }}
              className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors shadow-lg"
            >
              Convert Now
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  if (dialog.onMerge) {
                    dialog.onMerge();
                  }
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Merge
              </button>
              <button
                onClick={() => {
                  if (dialog.onReplace) {
                    dialog.onReplace();
                  }
                }}
                className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors shadow-lg animate-pulse"
              >
                Replace
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
