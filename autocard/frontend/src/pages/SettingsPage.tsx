import { useState, useEffect, useRef } from "react";
import AppShell from "../components/layout/AppShell";
import { useTranslationStore } from "../stores/translationStore";
import { organizations as orgsApi } from "../api/client";
import { Building, Upload, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

interface SettingsPageProps {
  onNavigate: (target: string, id?: string) => void;
}

interface Organization {
  id: string;
  name: string;
  image_org: string;
}

export default function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { t } = useTranslationStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [industry, setIndustry] = useState("Structural Engineering");
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const firstOrg = data[0];
        setSelectedOrg(firstOrg);
        setName(firstOrg.name);
        setLogo(firstOrg.image_org || "");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load organizations.");
    } finally {
      setLoading(false);
    }
  };

  const handleOrgChange = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setSelectedOrg(org);
      setName(org.name);
      setLogo(org.image_org || "");
      setHasChanges(false);
      setSuccess(null);
      setError(null);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setHasChanges(val.trim() !== "" && val !== (selectedOrg?.name || ""));
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrg) return;
    
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await orgsApi.uploadLogo(selectedOrg.id, file);
      setLogo(res.image_org);
      setSuccess("Logo uploaded successfully.");
      
      const updatedOrgs = organizations.map(o => {
        if (o.id === selectedOrg.id) {
          return { ...o, image_org: res.image_org };
        }
        return o;
      });
      setOrganizations(updatedOrgs);
      setSelectedOrg({ ...selectedOrg, image_org: res.image_org });
    } catch (err: any) {
      setError(err?.message || "Failed to upload logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!selectedOrg) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await orgsApi.update(selectedOrg.id, { name, image_org: "" });
      setLogo("");
      setSuccess("Logo removed successfully.");
      
      const updatedOrgs = organizations.map(o => {
        if (o.id === selectedOrg.id) {
          return { ...o, image_org: "" };
        }
        return o;
      });
      setOrganizations(updatedOrgs);
      setSelectedOrg({ ...selectedOrg, image_org: "" });
    } catch (err: any) {
      setError(err?.message || "Failed to remove logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedOrg || !name.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await orgsApi.update(selectedOrg.id, { name: name.trim(), image_org: logo });
      setSuccess("Organization settings updated successfully.");
      setHasChanges(false);
      
      const updatedOrgs = organizations.map(o => {
        if (o.id === selectedOrg.id) {
          return { ...o, name: name.trim() };
        }
        return o;
      });
      setOrganizations(updatedOrgs);
      setSelectedOrg({ ...selectedOrg, name: name.trim() });
    } catch (err: any) {
      setError(err?.message || "Failed to update organization.");
    } finally {
      setLoading(false);
    }
  };

  const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
  const logoSrc = logo
    ? (logo.startsWith("http") ? logo : `${API_BASE}${logo}`)
    : "";

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Workspaces" activeSidebarItem="Organization">
      <div className="max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-200 dark:border-[#1E293B] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {t("orgSettingsTitle")}
            </h1>
            <p className="text-slate-500 dark:text-[#94A3B8] text-sm">
              {t("orgSettingsSubtitle")}
            </p>
          </div>

          {organizations.length > 0 && (
            <div className="relative">
              <select 
                value={selectedOrg?.id || ""}
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
          )}
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

        {loading && !selectedOrg ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : selectedOrg ? (
          /* General Identity */
          <div className="bg-white dark:bg-[#151B23] rounded-xl border border-slate-200 dark:border-[#1E293B] mb-6 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-[#1E293B]/50 flex items-center justify-between bg-slate-200 dark:bg-[#1E293B]/10">
              <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
                <Building className="w-4 h-4 mr-2 text-cyan-400" />
                {t("generalIdentity")}
              </div>
              <div className="px-2 py-1 rounded bg-slate-300 dark:bg-[#2A3441] text-slate-500 dark:text-[#94A3B8] text-[10px] font-mono tracking-wider font-bold">
                CONFIG_ID: 0822-X
              </div>
            </div>
            
            <div className="p-6 flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    {t("orgName")}
                  </label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    {t("industrySector")}
                  </label>
                  <div className="relative">
                    <select 
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 appearance-none transition-colors"
                    >
                      <option value="Structural Engineering">{t("structuralEngineering")}</option>
                      <option value="Architecture">{t("architecture")}</option>
                      <option value="Mechanical">{t("mechanical")}</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400 dark:text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="md:w-64">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  {t("orgLogo")}
                </label>
                <div className="flex items-start gap-4">
                  <div 
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className="relative w-20 h-20 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg overflow-hidden shrink-0 group cursor-pointer hover:border-cyan-500 transition-colors flex items-center justify-center"
                  >
                    {logoSrc ? (
                      <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-slate-400 dark:text-[#475569] group-hover:text-cyan-400 transition-colors" />
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#94A3B8]">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleUploadLogo} 
                      className="hidden" 
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/gif" 
                    />
                    <p className="mb-1.5">{t("uploadLogoHelp")}</p>
                    <p className="text-[10px] mb-2">{t("logoSizeHelp")}</p>
                    {logoSrc && (
                      <button 
                        onClick={handleRemoveLogo}
                        className="text-red-400 font-bold hover:text-red-300 transition-colors flex items-center gap-1 mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t("removeLogo")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 italic">
            {t("noOrgsFound")}
          </div>
        )}

        {/* Unsaved Changes Fixed Footer */}
        {hasChanges && (
          <div className="fixed bottom-8 right-8 left-[18rem] max-w-4xl bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-4 flex items-center justify-between z-20">
            <div className="flex items-center text-xs font-medium text-slate-700 dark:text-gray-300">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-3 animate-pulse"></div>
              {t("unsavedChanges")}
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  setName(selectedOrg?.name || "");
                  setHasChanges(false);
                }}
                className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t("discard")}
              </button>
              <button 
                onClick={handleSaveChanges}
                className="px-6 py-2 bg-[#38BDF8] hover:bg-cyan-300 text-[#0B0E14] text-xs font-bold rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
              >
                {t("applyChanges")}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
