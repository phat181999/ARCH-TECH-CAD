import React, { useEffect, useRef } from "react";
import { useDialogStore, type DialogVariant } from "../../stores/dialogStore";

// ── Variant styles ──────────────────────────────────────────────────────────
const VARIANT_ICON: Record<DialogVariant, React.ReactNode> = {
  info: (
    <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  danger: (
    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const VARIANT_BG: Record<DialogVariant, string> = {
  info:    "bg-cyan-500/10 border-cyan-500/20",
  success: "bg-emerald-500/10 border-emerald-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  danger:  "bg-red-500/10 border-red-500/20",
};

const CONFIRM_BTN: Record<DialogVariant, string> = {
  info:    "bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/20",
  success: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20",
  warning: "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20",
  danger:  "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20",
};

// ── Component ───────────────────────────────────────────────────────────────
export default function AppDialog() {
  const { isOpen, type, title, message, variant, confirmLabel, cancelLabel, _close } = useDialogStore();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when opened; trap Escape key
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      (type === "confirm" ? cancelRef : confirmRef).current?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); _close(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [isOpen, type, _close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease]"
        onClick={() => _close(false)}
        style={{ animation: "fadeIn 0.15s ease" }}
      />

      {/* Dialog card */}
      <div
        className="relative w-full max-w-sm bg-white dark:bg-[#1A2030] border border-slate-200 dark:border-[#2A3441] rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "dialogEnter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        {/* Top accent stripe */}
        <div className={`h-1 w-full ${
          variant === "danger" ? "bg-gradient-to-r from-red-500 to-pink-500" :
          variant === "warning" ? "bg-gradient-to-r from-amber-500 to-orange-500" :
          variant === "success" ? "bg-gradient-to-r from-emerald-500 to-teal-500" :
          "bg-gradient-to-r from-cyan-500 to-blue-500"
        }`} />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${VARIANT_BG[variant]}`}>
              {VARIANT_ICON[variant]}
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  {title}
                </h3>
              )}
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          {type === "confirm" && (
            <button
              ref={cancelRef}
              onClick={() => _close(false)}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/40"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={() => _close(true)}
            className={`px-5 py-2 text-xs font-bold rounded-lg shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${CONFIRM_BTN[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dialogEnter { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}
