import { useState, useEffect } from "react";
import AppShell from "../components/layout/AppShell";
import InviteMemberModal from "../components/ui/InviteMemberModal";
import { organizations as orgsApi } from "../api/client";
import { 
  Users, 
  Mail, 
  Trash2, 
  Clock, 
  Check, 
  Plus,
  AlertTriangle,
  Building
} from "lucide-react";
import { useTranslationStore } from "../stores/translationStore";

interface TeamPageProps {
  onNavigate: (target: string, id?: string) => void;
}

interface Organization {
  id: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Invitation {
  email: string;
  role: string;
  invited_by: string;
  created_at: string;
}

export default function TeamPage({ onNavigate }: TeamPageProps) {
  const { t } = useTranslationStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Organization creation form
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  
  // Modals / State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orgsApi.list();
      setOrganizations(data);
      if (data.length > 0) {
        setSelectedOrgId(data[0].id);
        await fetchMembersAndInvites(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembersAndInvites = async (orgId: string) => {
    if (!orgId) return;
    try {
      const res = await orgsApi.getMembers(orgId);
      setMembers(res.members || []);
      setInvitations(res.invitations || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load team members.");
    }
  };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    await fetchMembersAndInvites(orgId);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const newOrg = await orgsApi.create({ name: newOrgName.trim() });
      setNewOrgName("");
      setShowCreateOrg(false);
      setSuccess(t("orgCreatedSuccess").replace("{name}", newOrg.name));
      await fetchOrgs();
    } catch (err: any) {
      setError(err?.message || "Failed to create organization.");
    } finally {
      setLoading(false);
    }
  };

  // Promote/Demote Member Role
  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null);
    setSuccess(null);
    try {
      await orgsApi.updateMemberRole(selectedOrgId, userId, { role: newRole });
      setSuccess(t("memberRoleUpdated"));
      await fetchMembersAndInvites(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Failed to update member role.");
    }
  };

  // Remove Member
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(t("removeMemberConfirm").replace("{name}", userName))) return;
    setError(null);
    setSuccess(null);
    try {
      await orgsApi.removeMember(selectedOrgId, userId);
      setSuccess(t("memberRemovedSuccess").replace("{name}", userName));
      await fetchMembersAndInvites(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Failed to remove member.");
    }
  };

  // Cancel/Remove Invitation
  const handleCancelInvitation = async (email: string) => {
    if (!confirm(t("cancelInviteConfirm").replace("{email}", email))) return;
    setError(null);
    setSuccess(null);
    try {
      await orgsApi.removeInvitation(selectedOrgId, email);
      setSuccess(t("inviteCancelledSuccess").replace("{email}", email));
      await fetchMembersAndInvites(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Failed to cancel invitation.");
    }
  };

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Team" activeSidebarItem="Members" onOpenInviteModal={() => selectedOrgId ? setIsInviteOpen(true) : alert(t("selectOrgFirst"))}>
      <div className="max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-200 dark:border-[#1E293B] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">{t("teamWorkspace")}</h1>
            <p className="text-slate-500 dark:text-[#94A3B8] text-sm">{t("teamSubtitle")}</p>
          </div>

          <div className="flex items-center gap-3">
            {organizations.length > 0 ? (
              <div className="relative">
                <select 
                  value={selectedOrgId}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  className="bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-[#2A3441] rounded-lg pl-3 pr-8 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none font-bold transition-colors"
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                  <Building className="h-4 w-4 text-slate-400 dark:text-[#475569]" />
                </div>
              </div>
            ) : (
              <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                {t("noOrgsFound")}
              </span>
            )}

            <button 
              onClick={() => setShowCreateOrg(!showCreateOrg)}
              className="px-4 py-2 border border-slate-200 dark:border-[#1E293B] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-800 dark:text-gray-200 text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t("newOrg")}
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm flex items-center gap-3">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Create Organization Form Overlay */}
        {showCreateOrg && (
          <form onSubmit={handleCreateOrg} className="mb-8 p-6 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl space-y-4 max-w-md">
            <h3 className="font-bold text-slate-800 dark:text-gray-200 text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-cyan-400" /> {t("createOrgTitle")}
            </h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                {t("orgNameLabel")}
              </label>
              <input
                type="text"
                placeholder={t("orgNamePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                onClick={() => setShowCreateOrg(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
              >
                {t("cancel")}
              </button>
              <button 
                type="submit"
                disabled={loading || !newOrgName.trim()}
                className="px-5 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors"
              >
                {loading ? t("creating") : t("create")}
              </button>
            </div>
          </form>
        )}

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* TABLES - ONLY WHEN SELECTED ORGANISATIONS ARE LOADED */}
        {!loading && selectedOrgId && (
          <div className="space-y-10">
            
            {/* 1. ACTIVE MEMBERS TABLE */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" /> {t("activeMembers")}
              </h2>
              <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("userCol")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("email")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("workspaceRole")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                      {members.map(member => (
                        <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#1E293B] text-cyan-400 font-bold flex items-center justify-center mr-3 border border-[#2A3441]">
                                {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                              </div>
                              <span className="font-bold text-slate-800 dark:text-gray-200 text-sm">{member.name || "Unnamed User"}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-500 dark:text-[#94A3B8]">{member.email}</td>
                          <td className="py-4 px-6">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none font-medium pr-8 cursor-pointer transition-colors"
                            >
                              <option value="owner">{t("owner")}</option>
                              <option value="editor">{t("editor")}</option>
                              <option value="viewer">{t("viewer")}</option>
                            </select>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button 
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded"
                              title="Remove Member"
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 2. PENDING INVITATIONS TABLE (REDIS KEY-STORE) */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-cyan-400" /> {t("pendingInvites")}
              </h2>
              <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("email")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("proposedRole")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("invitedOn")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                      {invitations.map(invite => (
                        <tr key={invite.email} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-4 px-6 text-sm text-slate-800 dark:text-gray-200 font-bold">{invite.email}</td>
                          <td className="py-4 px-6">
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded border border-cyan-500/20 uppercase tracking-wider">
                              {invite.role === "owner" ? t("owner") : invite.role === "editor" ? t("editor") : t("viewer")}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500 dark:text-[#94A3B8] font-mono flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(invite.created_at).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button 
                              onClick={() => handleCancelInvitation(invite.email)}
                              className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 font-bold border border-transparent hover:border-red-500/20 hover:bg-red-500/5 rounded-lg transition-colors"
                              title="Cancel Invitation"
                            >
                              {t("cancelInvite")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {invitations.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-slate-500 italic">{t("noPendingInvites")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Modal invite */}
        <InviteMemberModal 
          isOpen={isInviteOpen} 
          onClose={() => setIsInviteOpen(false)} 
          orgId={selectedOrgId} 
          onSuccess={() => fetchMembersAndInvites(selectedOrgId)}
        />
      </div>
    </AppShell>
  );
}
