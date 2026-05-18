import AppShell from "../components/layout/AppShell";
import { useState } from "react";

interface TeamPageProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function TeamPage({ onNavigate }: TeamPageProps) {
  const [search, setSearch] = useState("");

  const members = [
    { id: 1, name: "Julian Draxler", email: "julian@arch-tech.io", role: "Admin", status: "Active" },
    { id: 2, name: "Sarah Connor", email: "sarah@arch-tech.io", role: "Editor", status: "Pending" },
    { id: 3, name: "Marcus Wright", email: "marcus@arch-tech.io", role: "Viewer", status: "Active" },
    { id: 4, name: "Kyle Reese", email: "kyle@arch-tech.io", role: "Editor", status: "Active" },
  ];

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Team" activeSidebarItem="Members">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Team Management</h1>
            <p className="text-slate-500 dark:text-[#94A3B8] text-sm">Manage organization members, roles and access permissions.</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text"
                placeholder="Search members..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 dark:text-gray-200 placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-colors w-64"
              />
            </div>
            
            <button className="px-4 py-2 bg-slate-200 dark:bg-[#1E293B] hover:bg-slate-300 dark:bg-[#2A3441] text-slate-800 dark:text-gray-200 text-sm font-bold rounded-lg transition-colors flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              Filter
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-200 dark:bg-[#1E293B]/30">
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider w-1/3">Member</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">Email Address</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">Role</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/20 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#1E293B] text-cyan-400 font-bold flex items-center justify-center mr-3 border border-[#2A3441]">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-gray-200 text-sm">{member.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500 dark:text-[#94A3B8]">
                      {member.email}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-medium text-slate-700 dark:text-gray-300 bg-slate-200 dark:bg-[#1E293B] px-2 py-1 rounded">
                        {member.role}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${member.status === 'Active' ? 'bg-cyan-400' : 'bg-yellow-500'}`}></div>
                        <span className={member.status === 'Active' ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-[#94A3B8]'}>{member.status}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-slate-400 dark:text-[#475569] hover:text-slate-900 dark:text-white transition-colors p-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
