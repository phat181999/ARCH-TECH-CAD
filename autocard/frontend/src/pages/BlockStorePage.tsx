import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { useDrawingStore } from "../stores/drawingStore";
import { BlockPreview } from "../components/ui/BlockPreview";
import { importBlockFromFile } from "../utils/blockImporter";
import type { OrgBlockRecord, CreateBlockPayload } from "../services/blockStoreService";
import {
  listMyBlocks,
  listOrgBlocks,
  createMyBlock,
  createOrgBlock,
  publishOrgBlock,
  deleteMyBlock,
} from "../services/blockStoreService";
import type { BlockDef } from "../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "custom",
  "living",
  "bedroom",
  "dining",
  "kitchen",
  "bathroom",
  "office",
  "structural",
  "electrical",
  "landscape",
  "elevation",
  "annotation",
] as const;

type Tab = "org" | "mine";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlockStorePageProps {
  onNavigate: (page: string) => void;
  orgId?: string | null;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  id: number;
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  return { toast, show };
}

// ─── Upload Dialog ────────────────────────────────────────────────────────────

interface UploadDialogProps {
  orgId?: string | null;
  token: string;
  onClose: () => void;
  onSaved: (tab: Tab) => void;
}

function UploadDialog({ orgId, token, onClose, onSaved }: UploadDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [tagsRaw, setTagsRaw] = useState("");
  const [description, setDescription] = useState("");
  const [parsedDef, setParsedDef] = useState<BlockDef | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savingMine, setSavingMine] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsedDef(null);
    const def = await importBlockFromFile(file);
    if (!def) {
      setParseError("Could not parse file. Supported formats: .json, .svg, .dxf");
      return;
    }
    if (!name) setName(def.name);
    setParsedDef(def);
  }

  function buildPayload(): CreateBlockPayload {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      name: name.trim() || "Untitled Block",
      description,
      category,
      tags,
      block_def: parsedDef!,
    };
  }

  async function handleSaveMine() {
    if (!parsedDef) return;
    setSavingMine(true);
    setApiError(null);
    try {
      await createMyBlock(token, buildPayload());
      onSaved("mine");
    } catch (err: any) {
      setApiError(err.message ?? "Save failed");
    } finally {
      setSavingMine(false);
    }
  }

  async function handlePublishOrg() {
    if (!parsedDef || !orgId) return;
    setSavingOrg(true);
    setApiError(null);
    try {
      const created = await createOrgBlock(token, orgId, buildPayload());
      await publishOrgBlock(token, orgId, created.id, true);
      onSaved("org");
    } catch (err: any) {
      setApiError(err.message ?? "Publish failed");
    } finally {
      setSavingOrg(false);
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg rounded-xl bg-[#11161D] border border-[#1E293B] shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Upload Block</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ergonomic Chair"
            className="rounded-lg bg-[#0D1117] border border-[#1E293B] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg bg-[#0D1117] border border-[#1E293B] px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Tags (comma-separated)</label>
          <input
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="e.g. furniture, seating, modern"
            className="rounded-lg bg-[#0D1117] border border-[#1E293B] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description..."
            className="rounded-lg bg-[#0D1117] border border-[#1E293B] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 resize-none"
          />
        </div>

        {/* File Input */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Block File *</label>
          <input
            type="file"
            accept=".json,.svg,.dxf"
            onChange={handleFileChange}
            className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#1E293B] file:text-gray-300 hover:file:bg-slate-600 file:cursor-pointer"
          />
          {parseError && (
            <p className="text-xs text-rose-400 mt-0.5">{parseError}</p>
          )}
        </div>

        {/* Preview */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[#0B0E14] border border-[#1E293B]">
          {parsedDef ? (
            <>
              <div className="shrink-0 flex items-center justify-center w-20 h-20 rounded-lg bg-[#0D1117]">
                <BlockPreview def={parsedDef} size={80} isDark={true} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-gray-200 truncate">{parsedDef.name}</span>
                <span className="text-xs text-gray-500">{parsedDef.elements.length} elements</span>
              </div>
            </>
          ) : (
            <span className="text-xs text-gray-600 italic">No preview yet — import a file above</span>
          )}
        </div>

        {/* API Error */}
        {apiError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {apiError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSaveMine}
            disabled={!parsedDef || savingMine || savingOrg}
            className="flex-1 rounded-lg bg-[#1E293B] hover:bg-slate-600 text-gray-200 text-sm font-medium py-2 px-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingMine ? "Saving…" : "Save to My Imports"}
          </button>
          {orgId && (
            <button
              onClick={handlePublishOrg}
              disabled={!parsedDef || savingMine || savingOrg}
              className="flex-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium py-2 px-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingOrg ? "Publishing…" : "Publish to Org"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Block Card ───────────────────────────────────────────────────────────────

interface BlockCardProps {
  record: OrgBlockRecord;
  tab: Tab;
  onUse: (record: OrgBlockRecord) => void;
  onDelete?: (id: string) => void;
}

function BlockCard({ record, tab, onUse, onDelete }: BlockCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    onDelete(record.id);
  }

  const visibleTags = (record.tags ?? []).slice(0, 2);

  return (
    <div className="flex flex-col rounded-xl bg-[#11161D] border border-[#1E293B] hover:border-cyan-500/30 transition-colors overflow-hidden group">
      {/* Preview area */}
      <div className="flex items-center justify-center h-24 bg-[#0B0E14] relative">
        {record.block_def?.elements?.length > 0 ? (
          <BlockPreview def={record.block_def} size={56} isDark={true} />
        ) : record.thumbnail_url ? (
          <img
            src={record.thumbnail_url}
            alt={record.name}
            className="w-14 h-14 object-contain"
          />
        ) : (
          <span className="text-xs text-gray-600 italic">No preview</span>
        )}
        {/* Delete button (my imports only) */}
        {tab === "mine" && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-[#1E293B] text-gray-500 hover:bg-rose-500/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all text-xs leading-none disabled:opacity-40"
            aria-label="Delete block"
          >
            ×
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <p className="text-sm font-medium text-gray-200 truncate leading-tight" title={record.name}>
          {record.name}
        </p>

        {tab === "org" && (
          <p className="text-xs text-gray-500">
            {record.download_count ?? 0}{" "}
            <span className="text-gray-600">↓</span>
          </p>
        )}

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] leading-none px-1.5 py-0.5 rounded bg-[#1E293B] text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Use button */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onUse(record)}
          className="w-full rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium py-1.5 transition-colors"
        >
          Use
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BlockStorePage({ onNavigate, orgId }: BlockStorePageProps) {
  const { token } = useAuthStore();
  const { toast, show: showToast } = useToast();

  const hasOrg = Boolean(orgId);
  const [activeTab, setActiveTab] = useState<Tab>(hasOrg ? "org" : "mine");

  // Data
  const [orgBlocks, setOrgBlocks] = useState<OrgBlockRecord[]>([]);
  const [myBlocks, setMyBlocks] = useState<OrgBlockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Fetch data
  const fetchData = useCallback(
    async (tab: Tab, q?: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        if (tab === "org" && orgId) {
          const data = await listOrgBlocks(token, orgId, q || undefined);
          setOrgBlocks(data ?? []);
        } else {
          const data = await listMyBlocks(token);
          setMyBlocks(data ?? []);
        }
      } catch (err: any) {
        setError(err.message ?? "Failed to load blocks");
      } finally {
        setLoading(false);
      }
    },
    [token, orgId],
  );

  // Initial load + tab changes
  useEffect(() => {
    fetchData(activeTab, activeTab === "org" ? debouncedQ : undefined);
  }, [activeTab, debouncedQ, fetchData]);

  // Derived list for display
  const rawList = activeTab === "org" ? orgBlocks : myBlocks;
  const displayList =
    categoryFilter === "all"
      ? rawList
      : rawList.filter((r) => r.category === categoryFilter);

  // Inject into drawing store and show toast
  function injectAndInsert(record: OrgBlockRecord) {
    const store = useDrawingStore.getState();
    if (!store.blockDefs[record.id]) {
      useDrawingStore.setState((s: any) => ({
        blockDefs: {
          ...s.blockDefs,
          [record.id]: {
            id: record.id,
            name: record.name,
            elements: record.block_def.elements,
            insertionPoint: record.block_def.insertionPoint ?? { x: 0, y: 0 },
          },
        },
      }));
    }
    const cx = window.innerWidth / 2;
    store.insertBlock(record.id, cx, 400);
    showToast("Block added to canvas");
  }

  async function handleDeleteMine(id: string) {
    if (!token) return;
    try {
      await deleteMyBlock(token, id);
      setMyBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      setError(err.message ?? "Delete failed");
    }
  }

  function handleUploadSaved(tab: Tab) {
    setShowUpload(false);
    setActiveTab(tab);
    fetchData(tab, tab === "org" ? debouncedQ : undefined);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0D1117] text-gray-300">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1E293B] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <span className="text-gray-700">|</span>
          <h1 className="text-base font-semibold text-gray-100">Block Store</h1>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium px-3 py-1.5 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Upload Block
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-44 shrink-0 border-r border-[#1E293B] flex flex-col py-4 gap-1 px-2">
          {hasOrg && (
            <button
              onClick={() => setActiveTab("org")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === "org"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#1E293B]"
              }`}
            >
              <span>🏢</span>
              Org Store
            </button>
          )}
          <button
            onClick={() => setActiveTab("mine")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === "mine"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#1E293B]"
            }`}
          >
            <span>👤</span>
            My Imports
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1E293B] shrink-0">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blocks…"
                className="w-full rounded-lg bg-[#0B0E14] border border-[#1E293B] pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg bg-[#0B0E14] border border-[#1E293B] px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/60"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>

            {/* Count */}
            {!loading && !error && (
              <span className="text-xs text-gray-500 ml-auto">
                Showing {displayList.length} block{displayList.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Grid area */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-rose-500/30 bg-rose-500/5 max-w-sm mx-auto mt-10">
                <p className="text-sm text-rose-400 text-center">{error}</p>
                <button
                  onClick={() => fetchData(activeTab, activeTab === "org" ? debouncedQ : undefined)}
                  className="text-xs text-gray-300 bg-[#1E293B] hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && displayList.length === 0 && (
              <div className="flex flex-col items-center gap-4 mt-20 text-center">
                <div className="text-5xl opacity-30">📦</div>
                <p className="text-sm text-gray-500">
                  {activeTab === "mine"
                    ? "No imported blocks yet. Upload your first block!"
                    : "No published blocks in this org yet."}
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                >
                  + Upload a block
                </button>
              </div>
            )}

            {!loading && !error && displayList.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                {displayList.map((record) => (
                  <BlockCard
                    key={record.id}
                    record={record}
                    tab={activeTab}
                    onUse={injectAndInsert}
                    onDelete={activeTab === "mine" ? handleDeleteMine : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Upload dialog ── */}
      {showUpload && token && (
        <UploadDialog
          orgId={orgId}
          token={token}
          onClose={() => setShowUpload(false)}
          onSaved={handleUploadSaved}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#1E293B] border border-[#334155] text-sm text-gray-200 shadow-lg animate-fade-in"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
