import { useState, useEffect } from "react";
import { drawings as drawingsApi, organizations as orgsApi } from "../../api/client";
import { useTranslationStore } from "../../stores/translationStore";

interface ManageProjectAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawingId: string;
  drawingName: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Permission {
  id: string;
  drawing_id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export default function ManageProjectAssignmentsModal({
  isOpen,
  onClose,
  drawingId,
  drawingName
}: ManageProjectAssignmentsModalProps) {
  const { t } = useTranslationStore();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEmail, setSelectedEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("editor"); // "editor" (all) or "viewer" (view)

  // Fetch permissions and org members
  useEffect(() => {
    if (!isOpen || !drawingId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch permissions for this drawing
        const perms = await drawingsApi.getPermissions(drawingId);
        setPermissions(perms || []);

        // Fetch organization members to select from
        const orgs = await orgsApi.list();
        if (orgs && orgs.length > 0) {
          const membersRes = await orgsApi.getMembers(orgs[0].id);
          if (membersRes && membersRes.members) {
            setOrgMembers(membersRes.members);
          }
        }
      } catch (err: any) {
        console.error("Failed to load project assignments data:", err);
        setError("Failed to load project assignments data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, drawingId]);

  if (!isOpen) return null;

  // Filter members that are not already assigned
  const unassignedMembers = orgMembers.filter(
    (m) => !permissions.some((p) => p.email === m.email || p.user_id === m.id)
  );

  const handleAssign = async () => {
    if (!selectedEmail) {
      setError("Please select a member to assign.");
      return;
    }
    setError(null);
    setAssignLoading(true);
    try {
      await drawingsApi.share(drawingId, {
        email: selectedEmail,
        role: selectedRole
      });
      setSelectedEmail("");
      // Refresh permissions
      const perms = await drawingsApi.getPermissions(drawingId);
      setPermissions(perms || []);
    } catch (err: any) {
      setError(err?.message || "Failed to assign project member.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setError(null);
    try {
      await drawingsApi.removePermission(drawingId, userId);
      // Refresh permissions
      const perms = await drawingsApi.getPermissions(drawingId);
      setPermissions(perms || []);
    } catch (err: any) {
      setError(err?.message || "Failed to remove member assignment.");
    }
  };

  // Helper to find member name by email or userId
  const getMemberName = (perm: Permission) => {
    const member = orgMembers.find(
      (m) => m.email === perm.email || m.id === perm.user_id
    );
    return member ? member.name : "System User";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-50 dark:bg-[#0B0E14]/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div>
            <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
              <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Member Assignment
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] font-semibold mt-0.5">
              Project: <span className="text-cyan-400 font-bold">{drawingName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto max-h-[400px] space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Assignment form */}
          <div className="bg-slate-50 dark:bg-[#0B0E14]/40 border border-slate-200 dark:border-[#1E293B] rounded-lg p-4">
            <h4 className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-3">
              Assign New Member
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-1.5">
                  Select Organization Member
                </label>
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  disabled={loading || assignLoading}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="">-- Select Member --</option>
                  {unassignedMembers.map((m) => (
                    <option key={m.id} value={m.email}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-1.5">
                  Assign Access Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={loading || assignLoading}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="editor">All (Can Edit & View)</option>
                  <option value="viewer">View Only</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  onClick={handleAssign}
                  disabled={loading || assignLoading || !selectedEmail}
                  className="w-full py-1.5 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {assignLoading ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>

          {/* Members assigned list */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2.5">
              Assigned Project Members ({permissions.length})
            </h4>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-500 dark:text-[#94A3B8]">
                Loading assignments...
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 dark:text-[#94A3B8] italic border border-dashed border-slate-200 dark:border-[#1E293B] rounded-lg">
                No members assigned to this project yet.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-[#1E293B] rounded-lg overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#1E293B]/30 border-b border-slate-200 dark:border-[#1E293B]">
                      <th className="py-2 px-3 text-[9px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">
                        Member
                      </th>
                      <th className="py-2 px-3 text-[9px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">
                        Access Role
                      </th>
                      <th className="py-2 px-3 text-right text-[9px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1E293B]">
                    {permissions.map((perm) => (
                      <tr
                        key={perm.id}
                        className="hover:bg-slate-50 dark:hover:bg-[#1E293B]/10 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="text-xs text-slate-800 dark:text-gray-200 font-bold">
                            {getMemberName(perm)}
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-[#94A3B8] font-mono">
                            {perm.email}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {perm.role === "owner" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Owner
                            </span>
                          ) : perm.role === "editor" ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              All (Edit & View)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              View Only
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {perm.role !== "owner" && (
                            <button
                              onClick={() => handleRemove(perm.user_id)}
                              className="text-red-500 hover:text-red-400 text-[10px] font-bold transition-colors hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end bg-white dark:bg-[#151B23]">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-[#1E293B] text-slate-800 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
