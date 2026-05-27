import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useTranslationStore } from "../../stores/translationStore";
import { organizations as orgsApi } from "../../api/client";

interface SidebarProps {
  onNavigate: (target: string, id?: string) => void;
  activeItem?: string;
  onOpenInviteModal?: () => void;
}

export default function Sidebar({ onNavigate, activeItem = "Project", onOpenInviteModal }: SidebarProps) {
  const { logout, user } = useAuthStore();
  const { t } = useTranslationStore();
  const [orgName, setOrgName] = useState("Core Engineering");
  const [orgLogo, setOrgLogo] = useState("");
  const [orgCreatedAt, setOrgCreatedAt] = useState("");

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const data = await orgsApi.list();
        if (data && data.length > 0) {
          setOrgName(data[0].name);
          setOrgLogo(data[0].image_org || "");
          const createdVal = data[0].created_at || data[0].CreatedAt;
          if (createdVal) {
            setOrgCreatedAt(new Date(createdVal).toLocaleDateString());
          }
        }
      } catch (err) {
        console.error("Failed to fetch sidebar org:", err);
      }
    };
    fetchOrg();
  }, []);

  const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
  const logoSrc = orgLogo
    ? (orgLogo.startsWith("http") ? orgLogo : `${API_BASE}${orgLogo}`)
    : "";

  return (
    <aside className="w-56 bg-white dark:bg-[#151B23] border-r border-slate-200 dark:border-[#1E293B] flex flex-col shadow-xl z-0 shrink-0 select-none">
      <div className="p-5 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center space-x-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1E293B]/20 transition-colors">
        <div className="w-8 h-8 rounded bg-[#38BDF8] text-[#0B0E14] flex items-center justify-center border border-slate-300 dark:border-[#2A3441] overflow-hidden shrink-0">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5 text-[#0B0E14]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-gray-100">{orgName}</h3>
          <p className="text-[9px] font-mono text-slate-500 dark:text-[#94A3B8] uppercase">
            {t("createdAt")}: {orgCreatedAt || "..."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="mb-6">
          <h4 className="px-5 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-2">
            {t("general")}
          </h4>
          <nav className="space-y-0.5">
            {[
              { id: "Project", labelKey: "project", target: "dashboard", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2l2 2h8a2 2 0 012 2v2M4 6v12a2 2 0 002 2h12a2 2 0 002-2V8m-8 4h4m-4 4h4" /> },
              { id: "Organization", labelKey: "organization", target: "settings", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
              { id: "Members", labelKey: "members", target: "team", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
              { id: "Trash", labelKey: "trash", target: "trash", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> }
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.target)}
                className={`w-full flex items-center px-5 py-2 text-xs font-medium transition-colors ${activeItem === item.id ? "text-slate-800 dark:text-gray-200 bg-slate-300 dark:bg-[#2A3441] border-l-2 border-cyan-400" : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-[#1E293B]/50 hover:text-slate-800 dark:hover:text-gray-200 border-l-2 border-transparent"}`}
              >
                <svg className={`w-4 h-4 mr-3 ${activeItem === item.id ? "text-cyan-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
                {t(item.labelKey as any)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-4 space-y-2 border-t border-slate-200 dark:border-[#1E293B]/50">
        {user?.system_role === "system_admin" && (
          <button 
            onClick={() => onNavigate("admin")}
            className="w-full flex items-center justify-center px-4 py-2 border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-semibold rounded-lg transition-colors mb-2 uppercase font-mono tracking-wider gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            {t("adminConsole")}
          </button>
        )}
        <button 
          onClick={onOpenInviteModal}
          className="w-full flex items-center justify-center px-4 py-2 bg-slate-200 dark:bg-[#1E293B] hover:bg-slate-300 dark:hover:bg-[#2A3441] text-slate-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          {t("inviteMember")}
        </button>
        <button onClick={() => logout()} className="w-full flex items-center px-4 py-2 text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1E293B]/30 text-xs font-semibold rounded-lg transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          {t("logOut")}
        </button>
      </div>
    </aside>
  );
}
