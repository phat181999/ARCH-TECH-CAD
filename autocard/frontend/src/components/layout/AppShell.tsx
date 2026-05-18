import { ReactNode, useState } from "react";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import InviteMemberModal from "../ui/InviteMemberModal";

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
  activeSidebarItem = "Recent",
  onOpenInviteModal
}: AppShellProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E14] text-slate-700 dark:text-gray-300 font-sans flex flex-col selection:bg-[#38BDF8] selection:text-black">
      <TopNav onNavigate={onNavigate} activeTab={activeNavTab} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onNavigate={onNavigate} activeItem={activeSidebarItem} onOpenInviteModal={onOpenInviteModal || (() => setIsInviteOpen(true))} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
      
      <InviteMemberModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </div>
  );
}
