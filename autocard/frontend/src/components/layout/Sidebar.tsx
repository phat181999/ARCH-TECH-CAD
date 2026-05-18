import { useAuthStore } from "../../stores/authStore";

interface SidebarProps {
  onNavigate: (target: string, id?: string) => void;
  activeItem?: string;
  onOpenInviteModal?: () => void;
}

export default function Sidebar({ onNavigate, activeItem = "Recent", onOpenInviteModal }: SidebarProps) {
  const { logout } = useAuthStore();

  return (
    <aside className="w-56 bg-white dark:bg-[#151B23] border-r border-slate-200 dark:border-[#1E293B] flex flex-col shadow-xl z-0 shrink-0">
      <div className="p-5 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center space-x-3 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/20 transition-colors">
        <div className="w-8 h-8 rounded bg-[#38BDF8] text-[#0B0E14] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </div>
        <div>
          <h3 className="text-xs font-bold text-gray-100">Core Engineering</h3>
          <p className="text-[9px] font-mono text-slate-500 dark:text-[#94A3B8] uppercase">V-2 ALPHA SITE</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="mb-6">
          <h4 className="px-5 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-2">General</h4>
          <nav className="space-y-0.5">
            {[
              { id: "Recent", target: "dashboard", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2l2 2h8a2 2 0 012 2v2M4 6v12a2 2 0 002 2h12a2 2 0 002-2V8m-8 4h4m-4 4h4" /> },
              { id: "Organization", target: "settings", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
              { id: "Members", target: "team", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
              { id: "Billing", target: "billing", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /> },
              { id: "Trash", target: "trash", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> }
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.target)}
                className={`w-full flex items-center px-5 py-2 text-xs font-medium transition-colors ${activeItem === item.id ? "text-slate-800 dark:text-gray-200 bg-slate-300 dark:bg-[#2A3441] border-l-2 border-cyan-400" : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/50 hover:text-slate-800 dark:text-gray-200 border-l-2 border-transparent"}`}
              >
                <svg className={`w-4 h-4 mr-3 ${activeItem === item.id ? "text-cyan-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
                {item.id}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <h4 className="px-5 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-2">System</h4>
          <nav className="space-y-0.5">
            {[
              { id: "Layers", target: "layers", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
              { id: "Components", target: "components", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
              { id: "Settings", target: "settings", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> }
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => onNavigate(item.target)}
                className={`w-full flex items-center px-5 py-2 text-xs font-medium transition-colors ${activeItem === item.id ? "text-slate-800 dark:text-gray-200 bg-slate-300 dark:bg-[#2A3441] border-l-2 border-cyan-400" : "text-slate-500 dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/50 hover:text-slate-800 dark:text-gray-200 border-l-2 border-transparent"}`}
              >
                <svg className={`w-4 h-4 mr-3 ${activeItem === item.id ? "text-cyan-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {item.icon}
                </svg>
                {item.id}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-4 space-y-2 border-t border-slate-200 dark:border-[#1E293B]/50">
        <button 
          onClick={onOpenInviteModal}
          className="w-full flex items-center justify-center px-4 py-2 bg-slate-200 dark:bg-[#1E293B] hover:bg-slate-300 dark:bg-[#2A3441] text-slate-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          Invite Member
        </button>
        <button onClick={() => logout()} className="w-full flex items-center px-4 py-2 text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/30 text-xs font-semibold rounded-lg transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Log Out
        </button>
      </div>
    </aside>
  );
}
