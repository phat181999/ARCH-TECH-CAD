import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useTranslationStore } from "../../stores/translationStore";
import { organizations as orgsApi } from "../../api/client";
import { FolderKanban, Building2, Users, Trash2, UserPlus, LogOut, ShieldAlert } from "lucide-react";

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

  const navItems = [
    { id: "Project", labelKey: "project", target: "dashboard", Icon: FolderKanban },
    { id: "Organization", labelKey: "organization", target: "settings", Icon: Building2 },
    { id: "Members", labelKey: "members", target: "team", Icon: Users },
    { id: "Trash", labelKey: "trash", target: "trash", Icon: Trash2 },
  ];

  return (
    <aside className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-0 shrink-0 select-none">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center overflow-hidden shrink-0">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{orgName}</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {orgCreatedAt ? `Since ${orgCreatedAt}` : "..."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <div className="mb-4">
          <h4 className="px-4 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            {t("general")}
          </h4>
          <nav className="space-y-0.5 px-2">
            {navItems.map(({ id, labelKey, target, Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(target)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeItem === id
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-l-2 border-blue-600 dark:border-blue-500 -ml-px pl-[11px]"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${activeItem === id ? "text-blue-600 dark:text-blue-400" : ""}`} />
                {t(labelKey as any)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-3 space-y-1 border-t border-slate-200 dark:border-slate-800">
        {user?.system_role === "system_admin" && (
          <button
            onClick={() => onNavigate("admin")}
            className="w-full flex items-center gap-2 px-3 py-2 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            {t("adminConsole")}
          </button>
        )}
        <button
          onClick={onOpenInviteModal}
          className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {t("inviteMember")}
        </button>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-medium rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t("logOut")}
        </button>
      </div>
    </aside>
  );
}
