import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useDrawingStore } from "../../stores/drawingStore";
import { useThemeStore } from "../../stores/themeStore";
interface TopNavProps {
  onNavigate: (target: string, id?: string) => void;
  activeTab?: string;
}

export default function TopNav({ onNavigate, activeTab = "Dashboard" }: TopNavProps) {
  const { user } = useAuthStore();
  const { createDrawing }: any = useDrawingStore();
  const { isDark, toggleTheme } = useThemeStore();
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
    <header className="h-14 bg-white dark:bg-[#151B23] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between px-4 shrink-0 z-10 shadow-sm shadow-black/50">
      <div className="flex items-center space-x-6">
        <div className="flex items-center">
          <span className="font-bold tracking-wider text-cyan-400 text-sm uppercase">ARCH-TECH CAD</span>
          <div className="h-4 w-px bg-slate-200 dark:bg-[#1E293B] mx-4"></div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center">
            <span>ARCH-TECH</span>
            <svg className="w-3 h-3 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-slate-800 dark:text-gray-200">Core Workspace</span>
          </div>
        </div>
        
        <nav className="hidden md:flex space-x-1 h-14">
          {["Dashboard", "Workspaces", "Assets", "Team"].map((item) => (
            <button 
              key={item} 
              onClick={() => onNavigate(item.toLowerCase())}
              className={`px-4 h-full flex items-center text-xs font-semibold tracking-wide transition-colors ${activeTab === item ? "text-cyan-400 border-b-2 border-cyan-400" : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-800 dark:text-gray-200"}`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        <button onClick={toggleTheme} className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors" title="Toggle Theme">
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>
        <button className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        </button>
        <button className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors" onClick={() => onNavigate("settings")}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
        <button className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors pr-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        
        <button 
          onClick={handleCreate}
          disabled={isCreating}
          className="flex items-center px-3 py-1.5 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded hover:bg-cyan-300 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {isCreating ? "Initializing..." : "New Project"}
        </button>
        
        <div className="w-7 h-7 rounded bg-slate-200 dark:bg-[#1E293B] border border-cyan-500/30 flex items-center justify-center text-xs text-slate-900 dark:text-white font-bold overflow-hidden cursor-pointer">
           {user?.name?.[0]?.toUpperCase() || "O"}
        </div>
      </div>
    </header>
  );
}
