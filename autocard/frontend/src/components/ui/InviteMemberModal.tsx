import { useState } from "react";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteMemberModal({ isOpen, onClose }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Editor (Modify assets)");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-50 dark:bg-[#0B0E14]/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
            <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Invite Member
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@arch-tech.io"
                className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg pl-10 pr-4 py-2 text-sm text-slate-800 dark:text-gray-200 placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
              Assign Role
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <select 
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg pl-10 pr-10 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none transition-colors"
              >
                <option>Editor (Modify assets)</option>
                <option>Viewer (Read only)</option>
                <option>Admin (Full access)</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
              Personal Message (Optional)
            </label>
            <textarea 
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Join our Core Engineering workspace..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg p-3 text-sm text-slate-800 dark:text-gray-200 placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end space-x-3 bg-white dark:bg-[#151B23]">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              // Mock invite logic
              onClose();
            }}
            className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors"
          >
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}
