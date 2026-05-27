import { useState, useEffect } from "react";
import AppShell from "../components/layout/AppShell";
import { admin } from "../api/client";
import { useTranslationStore } from "../stores/translationStore";
import { 
  Building2, 
  Users, 
  ShieldAlert, 
  Settings2, 
  Trash2, 
  Edit3, 
  Clock, 
  CreditCard,
  UserCheck,
  UserMinus,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Info
} from "lucide-react";

interface AdminConsolePageProps {
  onNavigate: (target: string, id?: string) => void;
}

interface SubscriptionPackage {
  id: string;
  name: string;
  code: string;
  price: number;
  duration_days: number;
  max_members: number;
  max_drawings: number;
  features: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_package_id: string | null;
  subscription_package?: SubscriptionPackage;
  subscription_expires: string | null;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  system_role: string;
  created_at: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminConsolePage({ onNavigate }: AdminConsolePageProps) {
  const [activeTab, setActiveTab] = useState<"organizations" | "users" | "members" | "packages">("organizations");
  const { t } = useTranslationStore();
  
  // Data lists
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);

  // Loading/Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Subscription Modal State (Assign Package)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [proposedExpiration, setProposedExpiration] = useState<string>("");

  // Create/Edit Package Modal State
  const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgCode, setPkgCode] = useState("");
  const [pkgPrice, setPkgPrice] = useState<number>(0);
  const [pkgDuration, setPkgDuration] = useState<number>(30);
  const [pkgMaxMembers, setPkgMaxMembers] = useState<number>(5);
  const [pkgMaxDrawings, setPkgMaxDrawings] = useState<number>(10);
  const [pkgFeatures, setPkgFeatures] = useState("");

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "organizations") {
        const data = await admin.getOrganizations();
        setOrganizations(data);
        const pkgs = await admin.getPackages();
        setPackages(pkgs);
      } else if (activeTab === "users") {
        const data = await admin.getUsers();
        setUsers(data);
      } else if (activeTab === "members") {
        const orgsData = await admin.getOrganizations();
        setOrganizations(orgsData);
        if (orgsData.length > 0) {
          const defaultOrgId = selectedOrgId || orgsData[0].id;
          setSelectedOrgId(defaultOrgId);
          await fetchOrgMembers(defaultOrgId);
        }
      } else if (activeTab === "packages") {
        const pkgs = await admin.getPackages();
        setPackages(pkgs);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch admin data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgMembers = async (orgId: string) => {
    if (!orgId) return;
    try {
      const res = await admin.getOrganizations(); // For permissions endpoint or mapping members
      // The orgs endpoint returns users or we can get members using the organization API:
      const membersRes = await fetch(`/api/organizations/${orgId}/members`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      const data = await membersRes.json();
      setOrgMembers(data.members || []);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch organization members.");
    }
  };

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    await fetchOrgMembers(orgId);
  };

  // Toggle User System Role
  const handleToggleSystemRole = async (userId: string, currentRole: string) => {
    setError(null);
    setSuccess(null);
    const nextRole = currentRole === "system_admin" ? "user" : "system_admin";
    try {
      await admin.updateSystemRole(userId, { system_role: nextRole });
      setSuccess("User role updated successfully.");
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to update user role.");
    }
  };

  // Open Assign Package Modal
  const handleOpenAssignPkg = (org: Organization) => {
    setEditingOrg(org);
    const activePkgId = org.subscription_package_id || (packages.length > 0 ? packages[0].id : "");
    setSelectedPackageId(activePkgId);
    
    // Auto-calculate proposed expiration
    const pkg = packages.find(p => p.id === activePkgId);
    if (pkg) {
      const date = new Date();
      date.setDate(date.getDate() + pkg.duration_days);
      setProposedExpiration(date.toISOString().split("T")[0]);
    } else {
      setProposedExpiration("");
    }
  };

  const handlePackageSelectionChange = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      const date = new Date();
      date.setDate(date.getDate() + pkg.duration_days);
      setProposedExpiration(date.toISOString().split("T")[0]);
    }
  };

  // Submit Package Assignment to Organization
  const handleAssignPackage = async () => {
    if (!editingOrg || !selectedPackageId) return;
    setError(null);
    setSuccess(null);
    try {
      await admin.assignPackage(editingOrg.id, { package_id: selectedPackageId });
      setSuccess(`Package successfully assigned and email receipt dispatched for ${editingOrg.name}.`);
      setEditingOrg(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to assign package.");
    }
  };

  // Delete Organization
  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!confirm(t("deleteOrgConfirmAdmin").replace("{name}", orgName))) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await admin.deleteOrganization(orgId);
      setSuccess(`Organization "${orgName}" deleted.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete organization.");
    }
  };

  // Open Create/Edit Package form
  const handleOpenPackageForm = (pkg?: SubscriptionPackage) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPkgName(pkg.name);
      setPkgCode(pkg.code);
      setPkgPrice(pkg.price);
      setPkgDuration(pkg.duration_days);
      setPkgMaxMembers(pkg.max_members);
      setPkgMaxDrawings(pkg.max_drawings);
      setPkgFeatures(pkg.features);
    } else {
      setEditingPackage(null);
      setPkgName("");
      setPkgCode("");
      setPkgPrice(0);
      setPkgDuration(30);
      setPkgMaxMembers(5);
      setPkgMaxDrawings(10);
      setPkgFeatures("");
    }
    setShowPackageForm(true);
  };

  // Submit Package Creation / Update
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const payload = {
      name: pkgName.trim(),
      code: pkgCode.trim(),
      price: +pkgPrice,
      duration_days: +pkgDuration,
      max_members: +pkgMaxMembers,
      max_drawings: +pkgMaxDrawings,
      features: pkgFeatures.trim()
    };

    try {
      if (editingPackage) {
        await admin.updatePackage(editingPackage.id, payload);
        setSuccess(`Package "${pkgName}" updated successfully.`);
      } else {
        await admin.createPackage(payload);
        setSuccess(`Package "${pkgName}" created successfully.`);
      }
      setShowPackageForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to save package.");
    }
  };

  // Delete Package
  const handleDeletePackage = async (id: string, name: string) => {
    if (!confirm(t("deletePkgConfirmAdmin").replace("{name}", name))) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await admin.deletePackage(id);
      setSuccess(`Package "${name}" deleted successfully.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete package.");
    }
  };

  // Update Org Member Role
  const handleUpdateMemberRole = async (userId: string, newRole: string) => {
    setError(null);
    setSuccess(null);
    try {
      await fetch(`/api/organizations/${selectedOrgId}/members/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ role: newRole })
      });
      setSuccess("Member role updated successfully.");
      await fetchOrgMembers(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Failed to update member role.");
    }
  };

  // Remove Member from Org
  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(t("removeMemberConfirm").replace("{name}", userName))) return;
    setError(null);
    setSuccess(null);
    try {
      await fetch(`/api/organizations/${selectedOrgId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      setSuccess(`Removed "${userName}" from organization.`);
      await fetchOrgMembers(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Failed to remove member.");
    }
  };

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Admin" activeSidebarItem="Admin Console">
      <div className="max-w-6xl mx-auto pb-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-[#1E293B] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {t("platformAdmin")}
            </h1>
            <p className="text-slate-500 dark:text-[#94A3B8] text-sm">
              {t("adminSubtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4" /> {t("sysAdminTag")}
            </span>
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
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-[#1E293B] mb-6">
          <button
            onClick={() => setActiveTab("organizations")}
            className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-colors ${
              activeTab === "organizations"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Building2 className="w-4 h-4" /> {t("tabOrgs")}
          </button>
          <button
            onClick={() => setActiveTab("packages")}
            className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-colors ${
              activeTab === "packages"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <CreditCard className="w-4 h-4" /> {t("tabPackages")}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-colors ${
              activeTab === "users"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Users className="w-4 h-4" /> {t("tabUsers")}
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 -mb-[2px] transition-colors ${
              activeTab === "members"
                ? "border-cyan-400 text-cyan-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            <Settings2 className="w-4 h-4" /> {t("tabMembers")}
          </button>
        </div>

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* ORGANIZATIONS TAB */}
        {!loading && activeTab === "organizations" && (
          <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("orgName")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("orgId")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("subTier")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("expPeriod")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("createdAt")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                  {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#1E293B] text-cyan-400 font-bold flex items-center justify-center border border-slate-300 dark:border-[#2A3441] overflow-hidden shrink-0">
                            {org.image_org ? (
                              <img 
                                src={org.image_org.startsWith("http") ? org.image_org : `${(import.meta as any).env?.VITE_API_URL || "http://localhost:8080"}${org.image_org}`} 
                                alt="Logo" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              org.name ? org.name.charAt(0).toUpperCase() : "?"
                            )}
                          </div>
                          <span className="font-bold text-slate-800 dark:text-gray-200 text-sm">{org.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 dark:text-gray-500 font-mono">{org.id}</td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                          org.subscription_package?.code === "enterprise-annual"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : org.subscription_package?.code === "pro-monthly"
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}>
                          {org.subscription_package?.name || org.subscription_tier}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600 dark:text-[#94A3B8] font-mono flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {org.subscription_expires ? new Date(org.subscription_expires).toLocaleDateString() : t("lifetime")}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-[#94A3B8] font-mono">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenAssignPkg(org)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors border border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/10 rounded"
                            title={t("managePkg")}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrg(org.id, org.name)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded"
                            title={t("deleteOrg")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500 italic">{t("noOrgsRegistered")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION PACKAGES TAB */}
        {!loading && activeTab === "packages" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={() => handleOpenPackageForm()}
                className="px-4 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> {t("createPkg")}
              </button>
            </div>

            <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("pkgName")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("pkgCode")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("pkgPrice")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("pkgDuration")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("maxMembers")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("maxDrawings")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("features")}</th>
                      <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                    {packages.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-800 dark:text-gray-200 text-sm">{pkg.name}</td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">{pkg.code}</td>
                        <td className="py-4 px-6 text-sm font-semibold text-slate-800 dark:text-gray-200">${pkg.price}</td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">{pkg.duration_days} days</td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">{pkg.max_members}</td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 font-mono">{pkg.max_drawings}</td>
                        <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={pkg.features}>{pkg.features}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenPackageForm(pkg)}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors border border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/10 rounded"
                              title={t("edit")}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded"
                              title={t("delete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {packages.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-slate-500 italic">{t("noPackagesFound")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM USERS TAB */}
        {!loading && activeTab === "users" && (
          <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("userCol")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("email")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("orgId")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("sysRole")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("joinedAt")}</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6 flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#1E293B] text-cyan-400 font-bold flex items-center justify-center mr-1 border border-[#2A3441]">
                          {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <span className="font-bold text-slate-800 dark:text-gray-200 text-sm">{user.name || "Unnamed"}</span>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600 dark:text-[#94A3B8]">{user.email}</td>
                      <td className="py-4 px-6 text-xs text-slate-400 dark:text-gray-500 font-mono">{user.id}</td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                          user.system_role === "system_admin"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}>
                          {user.system_role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-[#94A3B8] font-mono">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {/* Protect against demoting oneself */}
                        <button
                          onClick={() => handleToggleSystemRole(user.id, user.system_role)}
                          className={`px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ml-auto ${
                            user.system_role === "system_admin"
                              ? "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                              : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                          }`}
                          title={user.system_role === "system_admin" ? t("demote") : t("promote")}
                        >
                          {user.system_role === "system_admin" ? (
                            <><UserMinus className="w-3.5 h-3.5" /> {t("demote")}</>
                          ) : (
                            <><UserCheck className="w-3.5 h-3.5" /> {t("promote")}</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORG MEMBERS TAB */}
        {!loading && activeTab === "members" && (
          <div className="space-y-6">
            {/* Select Organization */}
            <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  {t("selectOrgInspect")}
                </label>
                <div className="relative max-w-md">
                  <select
                    value={selectedOrgId}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none transition-colors"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-[#94A3B8]">
                {t("currentlyViewing")} <span className="font-bold text-cyan-400 font-mono">{orgMembers.length}</span> {t("activeMembersLower")}
              </div>
            </div>

            {/* Members table */}
            {selectedOrgId && (
              <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1E293B] bg-slate-100 dark:bg-[#1E293B]/30">
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("userCol")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("email")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">{t("orgId")}</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider">Workspace Role</th>
                        <th className="py-4 px-6 text-[10px] font-bold text-slate-500 dark:text-[#475569] uppercase tracking-wider text-right">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1E293B]">
                      {orgMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="py-4 px-6 flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-200 dark:bg-[#1E293B] text-cyan-400 font-bold flex items-center justify-center mr-1 border border-[#2A3441]">
                              {member.name ? member.name.charAt(0).toUpperCase() : "?"}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-gray-200 text-sm">{member.name || "Unnamed"}</span>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-600 dark:text-[#94A3B8]">{member.email}</td>
                          <td className="py-4 px-6 text-xs text-slate-400 dark:text-gray-500 font-mono">{member.id}</td>
                          <td className="py-4 px-6">
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                              className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none font-medium pr-8 cursor-pointer transition-colors"
                            >
                              <option value="owner">Owner</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30 hover:bg-red-500/10 rounded"
                              title="Remove Member from Org"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT SUBSCRIPTION PACKAGE OVERLAY / MODAL */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0E14]/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setEditingOrg(null)}></div>
          
          <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
              <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
                <CreditCard className="w-4 h-4 mr-2 text-cyan-400" />
                {t("managePkg")}: {editingOrg.name}
              </div>
              <button onClick={() => setEditingOrg(null)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  {t("subPkgTier")}
                </label>
                <select
                  value={selectedPackageId}
                  onChange={(e) => handlePackageSelectionChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="">{t("selectPlan")}</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (${p.price} / {p.duration_days} days)</option>
                  ))}
                </select>
              </div>

              {proposedExpiration && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    {t("newExpiration")}
                  </label>
                  <div className="flex items-center gap-2 text-slate-800 dark:text-gray-200 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono">{proposedExpiration}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    {t("calculatedFromCycle")}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end space-x-3 bg-slate-50 dark:bg-[#1E293B]/20">
              <button
                onClick={() => setEditingOrg(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleAssignPackage}
                className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors"
              >
                {t("applyChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SUBSCRIPTION PACKAGE FORM */}
      {showPackageForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0E14]/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowPackageForm(false)}></div>
          
          <form onSubmit={handleSavePackage} className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
              <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
                <CreditCard className="w-4 h-4 mr-2 text-cyan-400" />
                {editingPackage ? t("editPkg") : t("createPkg")}
              </div>
              <button type="button" onClick={() => setShowPackageForm(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("pkgName")}</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Pro Annual"
                  value={pkgName}
                  onChange={e => setPkgName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("pkgCode")}</label>
                <input 
                  type="text"
                  required
                  disabled={!!editingPackage}
                  placeholder="e.g. pro-annual"
                  value={pkgCode}
                  onChange={e => setPkgCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("pkgPrice")}</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={pkgPrice}
                    onChange={e => setPkgPrice(+e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("pkgDuration")}</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={pkgDuration}
                    onChange={e => setPkgDuration(+e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("maxMembers")}</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={pkgMaxMembers}
                    onChange={e => setPkgMaxMembers(+e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("maxDrawings")}</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={pkgMaxDrawings}
                    onChange={e => setPkgMaxDrawings(+e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">{t("features")} {t("commaSeparated")}</label>
                <textarea 
                  placeholder={t("featuresPlaceholder")}
                  value={pkgFeatures}
                  onChange={e => setPkgFeatures(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors h-20 resize-none"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end space-x-3 bg-slate-50 dark:bg-[#1E293B]/20">
              <button 
                type="button" 
                onClick={() => setShowPackageForm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
              >
                {t("cancel")}
              </button>
              <button 
                type="submit"
                className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors"
              >
                {t("save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
