import { useState, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { Drawing } from "../types";
import AppShell from "../components/layout/AppShell";
import { useTranslationStore } from "../stores/translationStore";
import ManageProjectAssignmentsModal from "../components/ui/ManageProjectAssignmentsModal";
import EditProjectModal from "../components/ui/EditProjectModal";
import { LayoutGrid, List, Plus, Activity } from "lucide-react";

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

  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return t("justNow");
    if (diff < 3600) return `${Math.floor(diff / 60)}${t("minutesAgo")}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t("hoursAgo")}`;
    return `${Math.floor(diff / 86400)}${t("daysAgo")}`;
  };

  const actionBtnCls = "text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Dashboard" activeSidebarItem="Project">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t("projectsTitle")}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("projectsSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-700"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-700"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drawings.map((d: Drawing) => (
              <div key={d.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all flex flex-col">
                {/* Thumbnail */}
                <div
                  className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative border-b border-slate-200 dark:border-slate-800 cursor-pointer overflow-hidden"
                  onClick={() => onNavigate("editor", d.id)}
                >
                  {d.image_url ? (
                    <img
                      src={d.image_url.startsWith("http") ? d.image_url : `${(import.meta as any).env?.VITE_API_URL || "http://localhost:8080"}${d.image_url}`}
                      alt="Thumbnail"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <img src="/cad-wireframe.png" alt="Thumbnail" className="w-full h-full object-cover opacity-60 grayscale group-hover:scale-105 transition-transform duration-300" />
                  )}
                  <div className="absolute top-2 left-2">
                    <span className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border border-slate-200 dark:border-slate-700">DWG</span>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <button
                      className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 text-left"
                      onClick={() => onNavigate("editor", d.id)}
                    >
                      <h3>{d.name}</h3>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedDrawing(d); setIsEditModalOpen(true); }} className={actionBtnCls} title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedDrawing(d); setIsAssignModalOpen(true); }} className={actionBtnCls} title="Manage assignments">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(d); }} className={actionBtnCls} title={t("duplicateProject")}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(t("deleteDrawingConfirm"))) deleteDrawing(d.id); }} className="text-slate-400 dark:text-slate-500 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" title={t("delete")}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between text-xs">
                    <span className="text-slate-400 dark:text-slate-500">{timeAgo(d.updated_at || d.created_at || new Date().toISOString())}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300" title={d.user?.name || "Unassigned"}>
                        {d.user?.name ? d.user.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      <span className="text-slate-400 dark:text-slate-500 max-w-[70px] truncate text-[11px]" title={d.user?.name || "Unassigned"}>
                        {d.user?.name || "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* New drawing card */}
            <button
              onClick={handleCreate}
              disabled={isCreating || loading}
              className="bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/10 transition-all flex flex-col items-center justify-center min-h-[220px] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">{isCreating ? t("initializing") : t("initializeDrawing")}</span>
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-12">Cover</th>
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4 w-40">Last Modified</th>
                    <th className="py-3 px-4 w-40">Owner</th>
                    <th className="py-3 px-4 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {drawings.map((d: Drawing) => (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => onNavigate("editor", d.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="w-10 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                          {d.image_url ? (
                            <img src={d.image_url.startsWith("http") ? d.image_url : `${(import.meta as any).env?.VITE_API_URL || "http://localhost:8080"}${d.image_url}`} alt="Cover" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">DWG</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[200px]">{d.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">{timeAgo(d.updated_at || d.created_at || new Date().toISOString())}</td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            {d.user?.name ? d.user.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <span className="text-slate-500 dark:text-slate-400 max-w-[80px] truncate">{d.user?.name || "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => { setSelectedDrawing(d); setIsEditModalOpen(true); }} className={actionBtnCls} title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => { setSelectedDrawing(d); setIsAssignModalOpen(true); }} className={actionBtnCls} title="Manage assignments">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                          </button>
                          <button onClick={() => handleDuplicate(d)} className={actionBtnCls} title={t("duplicateProject")}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </button>
                          <button onClick={() => { if (confirm(t("deleteDrawingConfirm"))) deleteDrawing(d.id); }} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {drawings.length} project{drawings.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleCreate}
                disabled={isCreating || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {isCreating ? t("initializing") : t("initializeDrawing")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom stats widget */}
      <div className="absolute bottom-8 right-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-lg w-56">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("workspaceHealth")}</h4>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{drawings?.length || 0}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t("activeProjects")}</div>
        </div>
      </div>

      <ManageProjectAssignmentsModal
        isOpen={isAssignModalOpen}
        onClose={() => { setIsAssignModalOpen(false); setSelectedDrawing(null); fetchDrawings(); }}
        drawingId={selectedDrawing?.id || ""}
        drawingName={selectedDrawing?.name || ""}
      />
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedDrawing(null); }}
        drawingId={selectedDrawing?.id || ""}
        drawingName={selectedDrawing?.name || ""}
        drawingImageUrl={selectedDrawing?.image_url}
        onSaveSuccess={() => { fetchDrawings(); }}
      />
    </AppShell>
  );
}
