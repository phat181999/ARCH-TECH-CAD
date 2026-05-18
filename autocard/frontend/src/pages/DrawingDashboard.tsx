import { useState, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { Drawing } from "../types";
import AppShell from "../components/layout/AppShell";

interface DrawingDashboardProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function DrawingDashboard({ onNavigate }: DrawingDashboardProps) {
  const { drawings, loading, error, fetchDrawings, createDrawing, deleteDrawing }: any = useDrawingStore();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  const handleCreate = async () => {
    setIsCreating(true);
    const drawing = await createDrawing("New Project");
    setIsCreating(false);
    if (drawing) {
      onNavigate("editor", drawing.id);
    }
  };

  // Helper to format date
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Dashboard" activeSidebarItem="Recent">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Recent Projects</h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">Last accessed within the past 7 days</p>
          </div>
          <div className="flex bg-white dark:bg-[#151B23] rounded-lg border border-slate-200 dark:border-[#1E293B] p-1">
            <button className="p-1 bg-slate-300 dark:bg-[#2A3441] rounded text-slate-900 dark:text-white shadow-sm"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
            <button className="p-1 text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white rounded transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* Projects */}
          {drawings.map((d: Drawing) => (
            <div key={d.id} className="bg-white dark:bg-[#151B23] rounded-lg border border-slate-200 dark:border-[#1E293B] overflow-hidden group hover:border-cyan-500/50 transition-colors flex flex-col">
              {/* Thumbnail area */}
              <div 
                className="h-32 bg-slate-50 dark:bg-[#0B0E14] relative border-b border-slate-200 dark:border-[#1E293B] cursor-pointer overflow-hidden"
                onClick={() => onNavigate("editor", d.id)}
              >
                <div className="absolute inset-0 bg-cyan-500/10 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img src="/cad-wireframe.png" alt="Thumbnail" className="w-full h-full object-cover object-center opacity-70 grayscale contrast-125 mix-blend-lighten" />
                {Math.random() > 0.7 && (
                  <div className="absolute top-2 right-2 text-yellow-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  </div>
                )}
              </div>
              
              {/* Card content */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-gray-100 truncate cursor-pointer hover:text-cyan-400" onClick={() => onNavigate("editor", d.id)}>
                    {d.name}
                  </h3>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this drawing?")) deleteDrawing(d.id);
                    }}
                    className="text-slate-500 dark:text-[#94A3B8] hover:text-red-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </button>
                </div>
                
                <div className="mt-auto flex items-center justify-between text-[10px] pt-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-slate-200 dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider">DWG</span>
                    <span className="text-slate-500 dark:text-[#94A3B8]">Modified {timeAgo(d.updated_at || d.created_at || new Date().toISOString())}</span>
                  </div>
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-600 border border-[#151B23] flex items-center justify-center text-slate-900 dark:text-white text-[8px] font-bold">A</div>
                    <div className="w-5 h-5 rounded-full bg-cyan-600 border border-[#151B23] flex items-center justify-center text-slate-900 dark:text-white text-[8px] font-bold">M</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Initialize New Drawing Card */}
          <button 
            onClick={handleCreate}
            disabled={isCreating || loading}
            className="bg-slate-50 dark:bg-[#0B0E14] rounded-lg border border-dashed border-slate-200 dark:border-[#1E293B] hover:border-cyan-500/50 hover:bg-white dark:bg-[#151B23] transition-all flex flex-col items-center justify-center min-h-[220px] text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-sm font-bold">{isCreating ? "Initializing..." : "Initialize New Drawing"}</span>
          </button>
        </div>
      </div>

      {/* Bottom Right Health Widget */}
      <div className="absolute bottom-8 right-8 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 shadow-2xl w-64 backdrop-blur-sm bg-opacity-90">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">Workspace Health</h4>
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
        </div>
        
        <div className="flex justify-between items-end mb-1">
          <div>
            <div className="text-lg font-bold text-cyan-400">12.4 GB</div>
            <div className="text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">Cloud Storage Used</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{drawings?.length || 42}</div>
            <div className="text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">Active Projects</div>
          </div>
        </div>
        
        <div className="w-full bg-slate-50 dark:bg-[#0B0E14] rounded-full h-1 mt-3">
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-1 rounded-full w-[70%]"></div>
        </div>
      </div>
    </AppShell>
  );
}