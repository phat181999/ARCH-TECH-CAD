import { useState, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { Drawing } from "../types";
import AppShell from "../components/layout/AppShell";
import { useTranslationStore } from "../stores/translationStore";
import ManageProjectAssignmentsModal from "../components/ui/ManageProjectAssignmentsModal";
import EditProjectModal from "../components/ui/EditProjectModal";

interface DrawingDashboardProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function DrawingDashboard({ onNavigate }: DrawingDashboardProps) {
  const { drawings, loading, error, fetchDrawings, createDrawing, deleteDrawing, duplicateDrawing }: any = useDrawingStore();
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useTranslationStore();
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  const handleCreate = async () => {
    setIsCreating(true);
    const drawing = await createDrawing(t("newProject"));
    setIsCreating(false);
    if (drawing) {
      onNavigate("editor", drawing.id);
    }
  };

  const handleDuplicate = async (drawing: Drawing) => {
    await duplicateDrawing(drawing);
  };

  // Helper to format date
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return t("justNow");
    if (diff < 3600) return `${Math.floor(diff / 60)}${t("minutesAgo")}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t("hoursAgo")}`;
    return `${Math.floor(diff / 86400)}${t("daysAgo")}`;
  };

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Dashboard" activeSidebarItem="Project">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t("projectsTitle")}</h1>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">{t("projectsSubtitle")}</p>
          </div>
          <div className="flex bg-white dark:bg-[#151B23] rounded-lg border border-slate-200 dark:border-[#1E293B] p-1">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-slate-300 dark:bg-[#2A3441] text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white"}`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-slate-300 dark:bg-[#2A3441] text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white"}`}
              title="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Projects */}
            {drawings.map((d: Drawing) => (
              <div key={d.id} className="bg-white dark:bg-[#151B23] rounded-lg border border-slate-200 dark:border-[#1E293B] overflow-hidden group hover:border-cyan-500/50 transition-colors flex flex-col">
                {/* Thumbnail area */}
                <div 
                  className="h-32 bg-slate-50 dark:bg-[#0B0E14] relative border-b border-slate-200 dark:border-[#1E293B] cursor-pointer overflow-hidden"
                  onClick={() => onNavigate("editor", d.id)}
                >
                  <div className="absolute inset-0 bg-cyan-500/5 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>
                  {d.image_url ? (
                    <img 
                      src={d.image_url.startsWith("http") ? d.image_url : `${(import.meta as any).env?.VITE_API_URL || "http://localhost:8080"}${d.image_url}`} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <img src="/cad-wireframe.png" alt="Thumbnail" className="w-full h-full object-cover object-center opacity-70 grayscale contrast-125 mix-blend-lighten group-hover:scale-105 transition-transform duration-300" />
                  )}
                  {Math.random() > 0.7 && (
                    <div className="absolute top-2 right-2 text-yellow-500 z-20">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </div>
                  )}
                </div>
                
                {/* Card content */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <button
                      className="font-bold text-sm text-slate-800 dark:text-gray-100 truncate cursor-pointer hover:text-cyan-400 text-left"
                      onClick={() => onNavigate("editor", d.id)}
                    >
                      <h3>{d.name}</h3>
                    </button>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDrawing(d);
                          setIsEditModalOpen(true);
                        }}
                        className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                        title="Edit project details"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDrawing(d);
                          setIsAssignModalOpen(true);
                        }}
                        className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                        title="Manage assignments"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(d);
                        }}
                        className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                        title={t("duplicateProject")}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t("deleteDrawingConfirm"))) deleteDrawing(d.id);
                        }}
                        className="text-slate-500 dark:text-[#94A3B8] hover:text-red-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                        title={t("delete")}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-auto flex items-center justify-between text-[10px] pt-3">
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-200 dark:bg-[#1E293B] text-slate-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider">DWG</span>
                      <span className="text-slate-500 dark:text-[#94A3B8]">{t("edit") /* Modified */}: {timeAgo(d.updated_at || d.created_at || new Date().toISOString())}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-slate-500/5 dark:bg-[#1E293B]/20 px-2 py-0.5 rounded border border-slate-200/50 dark:border-[#1E293B] select-none">
                      <div className="w-4 h-4 rounded-full bg-cyan-500 text-[#0B0E14] flex items-center justify-center text-[8px] font-extrabold" title={d.user?.name || "Unassigned"}>
                        {d.user?.name ? d.user.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold max-w-[70px] truncate" title={d.user?.name || "Unassigned"}>
                        {d.user?.name || "Unassigned"}
                      </span>
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
              <span className="text-sm font-bold">{isCreating ? t("initializing") : t("initializeDrawing")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-lg overflow-hidden flex flex-col animate-in fade-in duration-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#1E293B]/30 border-b border-slate-200 dark:border-[#1E293B] text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                    <th className="py-3 px-4 w-12">Cover</th>
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4 w-40">Last Modified</th>
                    <th className="py-3 px-4 w-40">Owner / Member</th>
                    <th className="py-3 px-4 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1E293B] text-slate-700 dark:text-gray-300">
                  {drawings.map((d: Drawing) => (
                    <tr 
                      key={d.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/20 transition-colors group cursor-pointer"
                      onClick={() => onNavigate("editor", d.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="w-10 h-7 rounded bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] overflow-hidden shrink-0">
                          {d.image_url ? (
                            <img 
                              src={d.image_url.startsWith("http") ? d.image_url : `${(import.meta as any).env?.VITE_API_URL || "http://localhost:8080"}${d.image_url}`} 
                              alt="Cover" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-200 dark:bg-[#0B0E14] flex items-center justify-center text-[6px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase">DWG</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-xs text-slate-800 dark:text-gray-100 truncate max-w-[200px]">
                        {d.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#94A3B8]">
                        {timeAgo(d.updated_at || d.created_at || new Date().toISOString())}
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center space-x-1.5 bg-slate-500/5 dark:bg-[#1E293B]/20 px-2 py-0.5 rounded border border-slate-200/50 dark:border-[#1E293B] select-none text-xs">
                          <div className="w-4 h-4 rounded-full bg-cyan-500 text-[#0B0E14] flex items-center justify-center text-[8px] font-extrabold" title={d.user?.name || "Unassigned"}>
                            {d.user?.name ? d.user.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold max-w-[70px] truncate" title={d.user?.name || "Unassigned"}>
                            {d.user?.name || "Unassigned"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button 
                            onClick={() => {
                              setSelectedDrawing(d);
                              setIsEditModalOpen(true);
                            }}
                            className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                            title="Edit details"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                           <button 
                            onClick={() => {
                              setSelectedDrawing(d);
                              setIsAssignModalOpen(true);
                            }}
                            className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                            title="Manage assignments"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => {
                              handleDuplicate(d);
                            }}
                            className="text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                            title={t("duplicateProject")}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(t("deleteDrawingConfirm"))) deleteDrawing(d.id);
                            }}
                            className="text-slate-500 dark:text-[#94A3B8] hover:text-red-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-[#1E293B]"
                            title={t("delete")}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Initialize New Drawing Button for List Mode */}
            <div className="p-4 bg-slate-50/50 dark:bg-[#1E293B]/10 border-t border-slate-200 dark:border-[#1E293B] flex justify-between items-center">
              <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] font-bold font-mono">
                TOTAL PROJECTS: {drawings.length}
              </span>
              <button 
                onClick={handleCreate}
                disabled={isCreating || loading}
                className="px-3 py-1.5 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{isCreating ? t("initializing") : t("initializeDrawing")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Right Health Widget */}
      <div className="absolute bottom-8 right-8 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl p-4 shadow-2xl w-64 backdrop-blur-sm bg-opacity-90">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">{t("workspaceHealth")}</h4>
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
        </div>
        
        <div className="flex justify-between items-end mb-1">
          <div>
            <div className="text-lg font-bold text-cyan-400">12.4 GB</div>
            <div className="text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">{t("cloudStorage")}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{drawings?.length || 42}</div>
            <div className="text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">{t("activeProjects")}</div>
          </div>
        </div>
        
        <div className="w-full bg-slate-50 dark:bg-[#0B0E14] rounded-full h-1 mt-3">
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-1 rounded-full w-[70%]"></div>
        </div>
      </div>
      <ManageProjectAssignmentsModal 
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedDrawing(null);
          fetchDrawings();
        }}
        drawingId={selectedDrawing?.id || ""}
        drawingName={selectedDrawing?.name || ""}
      />
      <EditProjectModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDrawing(null);
        }}
        drawingId={selectedDrawing?.id || ""}
        drawingName={selectedDrawing?.name || ""}
        drawingImageUrl={selectedDrawing?.image_url}
        onSaveSuccess={() => {
          fetchDrawings();
        }}
      />
    </AppShell>
  );
}