import AppShell from "../components/layout/AppShell";

interface SettingsPageProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function SettingsPage({ onNavigate }: SettingsPageProps) {
  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Workspaces" activeSidebarItem="Organization">
      <div className="max-w-4xl mx-auto pb-24"> {/* Padding bottom for the fixed bar */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Organization Settings</h1>
          <p className="text-slate-500 dark:text-[#94A3B8] text-sm">Manage your organization's core identity, visual assets, and industry classification.</p>
        </div>

        {/* General Identity */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#1E293B] mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center justify-between bg-slate-200 dark:bg-[#1E293B]/10">
            <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
              <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              General Identity
            </div>
            <div className="px-2 py-1 rounded bg-slate-300 dark:bg-[#2A3441] text-slate-500 dark:text-[#94A3B8] text-[10px] font-mono tracking-wider font-bold">
              CONFIG_ID: 0822-X
            </div>
          </div>
          
          <div className="p-6 flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Organization Name
                </label>
                <input 
                  type="text" 
                  defaultValue="Core Engineering"
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Industry Sector
                </label>
                <div className="relative">
                  <select className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none transition-colors">
                    <option>Structural Engineering</option>
                    <option>Architecture</option>
                    <option>Mechanical</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="md:w-64">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                Organization Logo
              </label>
              <div className="flex items-start gap-4">
                <div className="relative w-20 h-20 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg overflow-hidden shrink-0 group cursor-pointer">
                  <img src="/cad-wireframe.png" alt="Logo" className="w-full h-full object-cover opacity-50 mix-blend-lighten grayscale" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#38BDF8] rounded-full border-2 border-[#151B23] flex items-center justify-center">
                    <svg className="w-3 h-3 text-[#0B0E14]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-[#94A3B8]">
                  <p className="mb-2">Upload a high-resolution SVG or PNG.</p>
                  <p className="text-[10px] mb-2">Recommended size: 512x512px. Max file size: 2MB.</p>
                  <button className="text-cyan-400 font-bold hover:text-cyan-300 transition-colors">Remove current logo</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2 Column Layout for Storage & Auth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Data Storage */}
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#1E293B] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm bg-slate-200 dark:bg-[#1E293B]/10">
              <svg className="w-4 h-4 mr-2 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
              Data Storage & Residency
            </div>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-slate-400 dark:text-[#475569] mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-gray-200">Primary Region</div>
                  <div className="text-xs text-slate-500 dark:text-[#94A3B8]">US-East-1 (N. Virginia)</div>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-slate-200 dark:border-[#1E293B] rounded hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B] text-xs font-bold text-slate-700 dark:text-gray-300 transition-colors">
                Change
              </button>
            </div>
          </div>

          {/* Auth Rules */}
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#1E293B] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm bg-slate-200 dark:bg-[#1E293B]/10">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Auth Rules
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-gray-300">SSO Required</span>
                <div className="w-10 h-5 bg-cyan-500 rounded-full flex items-center px-0.5 cursor-pointer">
                  <div className="w-4 h-4 bg-black rounded-full translate-x-5 transition-transform"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-gray-300">2FA Enforced</span>
                <div className="w-10 h-5 bg-slate-200 dark:bg-[#1E293B] rounded-full flex items-center px-0.5 cursor-pointer">
                  <div className="w-4 h-4 bg-gray-400 rounded-full transition-transform"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-[#151B23] rounded-xl border border-red-900/50 overflow-hidden">
          <div className="p-4 border-b border-red-900/30 flex items-center text-red-400 font-bold text-sm bg-red-900/10">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Danger Zone
          </div>
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-lg">
              Permanently delete this organization and all associated CAD assets, project histories, and member access. This action cannot be undone.
            </p>
            <button className="px-4 py-2 bg-red-900/30 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded flex items-center whitespace-nowrap transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete Organization
            </button>
          </div>
        </div>

        {/* Unsaved Changes Fixed Footer */}
        <div className="fixed bottom-8 right-8 left-[18rem] max-w-4xl bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-4 flex items-center justify-between z-20">
          <div className="flex items-center text-xs font-medium text-slate-700 dark:text-gray-300">
            <div className="w-2 h-2 rounded-full bg-cyan-400 mr-3"></div>
            Unsaved changes detected in General Identity
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">Discard</button>
            <button className="px-6 py-2 bg-[#38BDF8] hover:bg-cyan-300 text-[#0B0E14] text-xs font-bold rounded-lg transition-colors">
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
