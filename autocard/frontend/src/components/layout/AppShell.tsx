import { ReactNode } from "react";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
  onNavigate: (target: string, id?: string) => void;
  activeNavTab?: string;
  activeSidebarItem?: string;
  onOpenInviteModal?: () => void;
}

export default function AppShell({
  children,
  onNavigate,
  activeNavTab = "Dashboard",
  activeSidebarItem = "Project",
  onOpenInviteModal
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-sans flex flex-col selection:bg-blue-200 selection:text-blue-900">
      <TopNav onNavigate={onNavigate} activeTab={activeNavTab} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onNavigate={onNavigate} activeItem={activeSidebarItem} onOpenInviteModal={onOpenInviteModal || (() => onNavigate("team"))} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
