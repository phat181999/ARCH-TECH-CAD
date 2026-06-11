import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useDrawingStore } from "../../stores/drawingStore";
import { useThemeStore } from "../../stores/themeStore";
import { useTranslationStore } from "../../stores/translationStore";
import { Sun, Moon, Bell, Settings, Plus } from "lucide-react";

interface TopNavProps {
  onNavigate: (target: string, id?: string) => void;
  activeTab?: string;
}

export default function TopNav({ onNavigate, activeTab = "Dashboard" }: TopNavProps) {
  const { user } = useAuthStore();
  const { createDrawing }: any = useDrawingStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { language, setLanguage, t } = useTranslationStore();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    const drawing = await createDrawing("New Project");
    setIsCreating(false);
    if (drawing) {
      onNavigate("editor", drawing.id);
    }
  };

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("dashboard")}>
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">AutoCard</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLanguage(language === "en" ? "vi" : "en")}
          className="text-xs font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
          title={language === "en" ? "Chuyển sang Tiếng Việt" : "Switch to English"}
        >
          {language === "en" ? "VI" : "EN"}
        </button>

        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => onNavigate("settings")}
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 ml-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {isCreating ? t("loading") : t("newProject")}
        </button>

        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-200 dark:border-blue-700 flex items-center justify-center text-xs text-blue-700 dark:text-blue-300 font-bold overflow-hidden cursor-pointer ml-1">
          {user?.name?.[0]?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
