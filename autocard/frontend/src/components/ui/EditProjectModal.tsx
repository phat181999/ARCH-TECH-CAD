import { useState, useEffect, useRef } from "react";
import { drawings as drawingsApi } from "../../api/client";
import { useTranslationStore } from "../../stores/translationStore";

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawingId: string;
  drawingName: string;
  drawingImageUrl?: string;
  onSaveSuccess: () => void;
}

export default function EditProjectModal({
  isOpen,
  onClose,
  drawingId,
  drawingName,
  drawingImageUrl,
  onSaveSuccess
}: EditProjectModalProps) {
  const { t } = useTranslationStore();
  const [name, setName] = useState(drawingName);
  const [imageUrl, setImageUrl] = useState(drawingImageUrl || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(drawingName);
      setImageUrl(drawingImageUrl || "");
      setError(null);
    }
  }, [isOpen, drawingName, drawingImageUrl]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("projectName") + " cannot be empty.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await drawingsApi.rename(drawingId, name.trim());
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update project name.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploading(true);
    setError(null);
    try {
      const res = await drawingsApi.uploadAvatar(drawingId, file);
      setImageUrl(res.image_url);
      onSaveSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to upload project image.");
    } finally {
      setUploading(false);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
  const displayImageUrl = imageUrl
    ? (imageUrl.startsWith("http") ? imageUrl : `${API_BASE}${imageUrl}`)
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 dark:bg-[#0B0E14]/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
            <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t("editProjectDetails")}
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
        <form onSubmit={handleSave} className="p-5 flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Avatar Upload area */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-[#0B0E14]/40 border border-slate-200 dark:border-[#1E293B] rounded-lg">
            <label className="block text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-2 self-start">
              {t("projectThumbnail")}
            </label>
            <div className="relative w-28 h-20 bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg overflow-hidden group mb-3">
              {displayImageUrl ? (
                <img src={displayImageUrl} alt="Project Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-[#0B0E14]">
                  <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] font-bold">{t("noImage")}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-[10px] text-white font-semibold">
                  {t("loading")}
                </div>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={triggerUpload}
              disabled={uploading || loading}
              className="px-3 py-1 bg-slate-200 dark:bg-[#1E293B] hover:bg-slate-300 dark:hover:bg-[#2A3441] text-slate-800 dark:text-gray-200 text-[10px] font-bold rounded transition-colors disabled:opacity-50"
            >
              {t("uploadThumbnail")}
            </button>
          </div>

          {/* Name input */}
          <div>
            <label className="block text-[8px] font-bold text-slate-400 dark:text-[#475569] uppercase tracking-wider mb-1.5">
              {t("projectName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || uploading}
              placeholder={t("enterProjectName")}
              className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-200 dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-[#1E293B] text-slate-800 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || uploading || !name.trim()}
              className="px-3 py-1.5 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
