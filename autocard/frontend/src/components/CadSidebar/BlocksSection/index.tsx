import { useState } from "react";
import { BLOCK_CATALOG, CATEGORY_META, type BlockCategory } from "../../../data/blockLibrary";
import { useDrawingStore } from "../../../stores/drawingStore";
import { BlockPreview } from "../../ui/BlockPreview";
import { ToolBtn } from "../../ui/ToolBtn";
import type { BlockSource } from "../types";
import { useBlockLibrary } from "./useBlockLibrary";

interface BlocksSectionProps {
  tool: string;
  setTool: (t: string) => void;
  zoom: number;
  panOffset: { x: number; y: number };
  insertBlock: (id: string, x: number, y: number) => void;
  authToken?: string;
  orgId?: string | null;
  onOpenBlockStore?: () => void;
}

export function BlocksSection({
  tool,
  setTool,
  zoom,
  panOffset,
  insertBlock,
  authToken,
  orgId,
  onOpenBlockStore,
}: BlocksSectionProps) {
  const [blockCategory, setBlockCategory] = useState<BlockCategory>("structural");
  const [blockSource, setBlockSource] = useState<BlockSource>("default");
  const [blockSearch, setBlockSearch] = useState("");

  const { myBlocks, orgBlocks, loading: remoteBlocksLoading, error: remoteBlocksError } = useBlockLibrary(blockSource, authToken, orgId);

  return (
    <div className="px-2 py-2 space-y-2">

      {/* ── Source tabs ── */}
      <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-[#1E293B] text-[9px] font-bold">
        {(["default", "mine", ...(orgId ? ["org"] : [])] as BlockSource[]).map((src) => (
          <button
            key={src}
            onClick={() => { setBlockSource(src); setBlockSearch(""); }}
            className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 transition-all ${
              blockSource === src
                ? "bg-purple-500 text-white shadow-inner"
                : "text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 bg-transparent hover:bg-slate-100 dark:hover:bg-[#1E293B]"
            }`}
            title={src === "default" ? "Built-in furniture library" : src === "mine" ? "Your custom imports" : "Organisation shared store"}
          >
            <span className="text-base leading-none">
              {src === "default" ? "🏠" : src === "mine" ? "👤" : "🏢"}
            </span>
            <span>{src === "default" ? "Library" : src === "mine" ? "My Files" : "Org Store"}</span>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
        <input
          type="text"
          value={blockSearch}
          onChange={(e) => setBlockSearch(e.target.value)}
          placeholder={blockSource === "default" ? "Search furniture..." : "Search blocks..."}
          className="w-full pl-6 pr-2 py-1.5 text-[10px] rounded-md border border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0B0E14] text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 outline-none focus:border-purple-500/50 transition-colors"
        />
        {blockSearch && (
          <button
            onClick={() => setBlockSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
          >✕</button>
        )}
      </div>

      {/* ── Default Library ── */}
      {blockSource === "default" && (() => {
        const q = blockSearch.toLowerCase();
        // When searching, show all categories flattened; otherwise show category picker
        const filteredAll = q
          ? BLOCK_CATALOG.filter(b => b.label.toLowerCase().includes(q) || b.category.toLowerCase().includes(q))
          : null;

        return (
          <>
            {/* Category pills — only show when not searching */}
            {!q && (
              <div className="flex flex-wrap gap-1">
                {(Object.keys(CATEGORY_META) as BlockCategory[]).map((cat) => {
                  const m = CATEGORY_META[cat];
                  const count = BLOCK_CATALOG.filter(b => b.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setBlockCategory(cat)}
                      className={`flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-[8px] font-bold border transition-all ${
                        blockCategory === cat
                          ? "bg-purple-500/15 border-purple-500/50 text-purple-600 dark:text-purple-300"
                          : "bg-transparent border-slate-200 dark:border-[#1E293B] text-slate-500 dark:text-gray-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-gray-200"
                      }`}
                      title={m.label}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      <span className="opacity-50 ml-0.5">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* How-to-use tip card */}
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 rounded-lg px-2.5 py-2 space-y-1.5">
              <p className="text-[8px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">How to use</p>
              <div className="flex items-center gap-2">
                <span className="text-sm">👆</span>
                <div>
                  <p className="text-[9px] font-semibold text-slate-700 dark:text-gray-200">Click a tile</p>
                  <p className="text-[8px] text-slate-500 dark:text-gray-500">Places it at the center of your canvas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">✋</span>
                <div>
                  <p className="text-[9px] font-semibold text-slate-700 dark:text-gray-200">Drag onto canvas</p>
                  <p className="text-[8px] text-slate-500 dark:text-gray-500">Drop it exactly where you want</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">🔍</span>
                <div>
                  <p className="text-[9px] font-semibold text-slate-700 dark:text-gray-200">Search by name</p>
                  <p className="text-[8px] text-slate-500 dark:text-gray-500">e.g. "chair", "door", "stair"</p>
                </div>
              </div>
            </div>

            {/* Current category label */}
            {q && (
              <p className="text-[8px] text-slate-400 px-0.5">
                {filteredAll!.length} result{filteredAll!.length !== 1 ? "s" : ""} for "{blockSearch}"
              </p>
            )}

            {/* Tile grid */}
            <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-0.5 pb-1">
              {(filteredAll ?? BLOCK_CATALOG.filter(b => b.category === blockCategory)).map((b) => (
                <button
                  key={b.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("blockId", b.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => {
                    const cx = (window.innerWidth / 2 - panOffset.x) / zoom;
                    const cy = (window.innerHeight / 2 - panOffset.y) / zoom;
                    insertBlock(b.id, cx, cy);
                  }}
                  className="group flex flex-col items-center justify-center bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-sm rounded-lg p-1.5 transition-all cursor-grab active:cursor-grabbing active:scale-95"
                  title={`${b.label} · click to insert, drag to place`}
                >
                  <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-150">
                    <BlockPreview def={b.def as any} size={44} isDark={true} />
                  </div>
                  <span className="text-[8px] text-slate-500 dark:text-gray-400 mt-1 font-medium text-center leading-tight line-clamp-2 group-hover:text-purple-500 dark:group-hover:text-purple-300 transition-colors">{b.label}</span>
                </button>
              ))}
              {(filteredAll ?? BLOCK_CATALOG.filter(b => b.category === blockCategory)).length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center py-6 gap-1 text-slate-400">
                  <span className="text-2xl">🔍</span>
                  <span className="text-[9px]">No blocks match "{blockSearch}"</span>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ── My Imports ── */}
      {blockSource === "mine" && (
        <>
          {remoteBlocksLoading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
              <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
              <span className="text-[9px]">Loading your imports…</span>
            </div>
          )}
          {remoteBlocksError && (
            <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 rounded-lg px-2.5 py-2 text-[9px] text-rose-600 dark:text-rose-400">
              <span className="text-sm mt-0.5">⚠️</span>
              <span>{remoteBlocksError}</span>
            </div>
          )}
          {!remoteBlocksLoading && !remoteBlocksError && (() => {
            const q = blockSearch.toLowerCase();
            const list = myBlocks.filter(r => !q || r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
            return list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-gray-500">
                <span className="text-3xl">{blockSearch ? "🔍" : "📦"}</span>
                <span className="text-[9px] text-center">
                  {blockSearch ? `No imports match "${blockSearch}"` : "You haven't imported any blocks yet."}
                </span>
                {!blockSearch && onOpenBlockStore && (
                  <button
                    onClick={onOpenBlockStore}
                    className="text-[9px] font-bold text-purple-500 hover:text-purple-400 underline underline-offset-2 mt-1"
                  >
                    Open the Full Store →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-0.5 pb-1">
                {list.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => {
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
                      const px = (window.innerWidth / 2 - panOffset.x) / zoom;
                      const py = (window.innerHeight / 2 - panOffset.y) / zoom;
                      store.insertBlock(record.id, px, py);
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("blockId", record.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="group flex flex-col items-center justify-center bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-sm rounded-lg p-1.5 transition-all cursor-grab active:cursor-grabbing active:scale-95"
                    title={`${record.name} · click to insert`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-150">
                      {record.thumbnail_url ? (
                        <img src={record.thumbnail_url} alt={record.name} className="w-11 h-11 object-contain rounded" />
                      ) : (
                        <BlockPreview def={record.block_def} size={44} isDark={true} />
                      )}
                    </div>
                    <span className="text-[8px] text-slate-500 dark:text-gray-400 mt-1 font-medium text-center leading-tight line-clamp-2 group-hover:text-purple-500 dark:group-hover:text-purple-300 transition-colors">{record.name}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* ── Org Store ── */}
      {blockSource === "org" && (
        <>
          {remoteBlocksLoading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
              <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
              <span className="text-[9px]">Loading org store…</span>
            </div>
          )}
          {remoteBlocksError && (
            <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 rounded-lg px-2.5 py-2 text-[9px] text-rose-600 dark:text-rose-400">
              <span className="text-sm mt-0.5">⚠️</span>
              <span>{remoteBlocksError}</span>
            </div>
          )}
          {!remoteBlocksLoading && !remoteBlocksError && (() => {
            const q = blockSearch.toLowerCase();
            const list = orgBlocks.filter(r => !q || r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
            return list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-gray-500">
                <span className="text-3xl">{blockSearch ? "🔍" : "🏢"}</span>
                <span className="text-[9px] text-center">
                  {blockSearch ? `No org blocks match "${blockSearch}"` : "No blocks published to your org store yet."}
                </span>
                {!blockSearch && onOpenBlockStore && (
                  <button
                    onClick={onOpenBlockStore}
                    className="text-[9px] font-bold text-purple-500 hover:text-purple-400 underline underline-offset-2 mt-1"
                  >
                    Upload a block →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-0.5 pb-1">
                {list.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => {
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
                      const px = (window.innerWidth / 2 - panOffset.x) / zoom;
                      const py = (window.innerHeight / 2 - panOffset.y) / zoom;
                      store.insertBlock(record.id, px, py);
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("blockId", record.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="group flex flex-col items-center justify-center bg-slate-100 dark:bg-[#11161D] border border-slate-200 dark:border-[#1E293B] hover:border-purple-500/60 hover:bg-purple-500/5 hover:shadow-sm rounded-lg p-1.5 transition-all cursor-grab active:cursor-grabbing active:scale-95"
                    title={`${record.name}${record.download_count ? ` · ${record.download_count} uses` : ""} · click to insert`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform duration-150">
                      {record.thumbnail_url ? (
                        <img src={record.thumbnail_url} alt={record.name} className="w-11 h-11 object-contain rounded" />
                      ) : (
                        <BlockPreview def={record.block_def} size={44} isDark={true} />
                      )}
                    </div>
                    <span className="text-[8px] text-slate-500 dark:text-gray-400 mt-1 font-medium text-center leading-tight line-clamp-2 group-hover:text-purple-500 dark:group-hover:text-purple-300 transition-colors">{record.name}</span>
                    {record.download_count > 0 && (
                      <span className="text-[7px] text-slate-400 dark:text-gray-600">{record.download_count}×</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* ── Insert / Explode tools ── */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200 dark:border-[#1E293B]">
        <ToolBtn label="Insert Block" icon="⊞" active={tool === "insert"} onClick={() => setTool("insert")} shortcut="I" compact />
        <ToolBtn label="Explode" icon="⊠" active={false} onClick={() => {
          const { elements, selectedElementIds, addElement, deleteSelectedElements } = useDrawingStore.getState();
          if (selectedElementIds.length === 0) return;
          const genId = () => Math.random().toString(36).substr(2, 9);
          let addedAny = false;
          selectedElementIds.forEach(id => {
            const el = elements.find(e => e.id === id);
            if (!el) return;
            if (el.type === 'rectangle') {
              const x = el.x!, y = el.y!, w = el.width!, h = el.height!;
              [[x,y,x+w,y],[x+w,y,x+w,y+h],[x+w,y+h,x,y+h],[x,y+h,x,y]].forEach(([x1,y1,x2,y2]) =>
                addElement({ id: genId(), type: 'line', x1, y1, x2, y2, strokeColor: el.strokeColor||'#1f2937', strokeWidth: el.strokeWidth||2, layerId: el.layerId })
              );
              addedAny = true;
            } else if ((el.type === 'polyline' || el.type === 'spline') && el.points && el.points.length >= 2) {
              for (let i = 0; i < el.points.length - 1; i++) {
                addElement({ id: genId(), type: 'line', x1: el.points[i].x, y1: el.points[i].y, x2: el.points[i+1].x, y2: el.points[i+1].y, strokeColor: el.strokeColor||'#1f2937', strokeWidth: el.strokeWidth||2, layerId: el.layerId });
              }
              if ((el as any).closed) {
                const last = el.points[el.points.length-1], first = el.points[0];
                addElement({ id: genId(), type: 'line', x1: last.x, y1: last.y, x2: first.x, y2: first.y, strokeColor: el.strokeColor||'#1f2937', strokeWidth: el.strokeWidth||2, layerId: el.layerId });
              }
              addedAny = true;
            }
          });
          if (addedAny) deleteSelectedElements();
        }} compact />
      </div>

      {/* Open Full Store */}
      {onOpenBlockStore && (
        <button
          onClick={onOpenBlockStore}
          className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold text-purple-500 dark:text-purple-400 border border-purple-500/25 rounded-lg py-1.5 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all"
        >
          <span>🏪</span> Open Full Store
        </button>
      )}
    </div>
  );
}
