import { useState, useRef, useEffect, useCallback } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { generateDrawingFromPrompt, interactDrawingFromPrompt, centerElementsOnViewport } from "../services/aiDrawingService";
import { useAiPreviewStore } from "../cad/store/useAiPreviewStore";
import type { PreviewNode } from "../cad/contracts/events";
import { useAnalysisJob } from "../hooks/useAnalysisJob";
import type { DrawingElement } from "../types";
import {
  listSessions,
  createSession,
  deleteSession,
  getMessages,
  sendMessageSSE,
  type ChatSessionInfo,
  type ChatMessageInfo,
} from "../services/chatService";

interface UploadResult {
  success: boolean;
  file_name: string;
  metadata: {
    units: string;
    layers: Array<{ name: string; count: number; arch_type: string }>;
    text_entities: Array<{ text: string; layer: string }>;
    block_inserts: Array<{ block_name: string; layer: string }>;
    entity_counts: Record<string, number>;
    summary: string;
  };
  chunks_created: number;
}

const AI_SUGGESTIONS = [
  "Draw a 10x20 house",
  "Add dimensions to all lines",
  "Color all walls blue",
  "Create a grid of 4 circles",
  "Draw a floor plan 30x40",
  "Add a title block",
];

const CATEGORY_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  cad_drawing: { icon: "✏️", label: "CAD Drawing", color: "text-blue-400" },
  permit_and_licensing: { icon: "📋", label: "Permits & Codes", color: "text-yellow-400" },
  construction_materials: { icon: "🧱", label: "Materials", color: "text-orange-400" },
  general_knowledge: { icon: "💬", label: "General", color: "text-green-400" },
};

interface Message {
  role: string;
  text: string;
  commands?: string[];
  category?: string;
  is_streaming?: boolean;
}

export default function AIAssistantPanel(): React.ReactElement {
  // ── Session state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ── Chat state ─────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hello! I'm your AI CAD assistant. Describe what you'd like to draw, and I'll help you create it." },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const elements = useDrawingStore((s) => s.elements);
  const addElement = useDrawingStore((s) => s.addElement);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const setCurrentArchitecturalPlan = useDrawingStore((s) => s.setCurrentArchitecturalPlan);

  const previewStore = useAiPreviewStore();
  const previewStatus = useAiPreviewStore((s) => s.status);
  const previewNodeCount = useAiPreviewStore((s) => s.previewNodes.length);

  const currentDrawingId = useDrawingStore((s) => s.currentDrawingId);
  const { result: bimResult } = useAnalysisJob(currentDrawingId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Load sessions on mount ─────────────────────────────────────────────
  useEffect(() => {
    listSessions().then(async (list) => {
      setSessions(list);
      if (list.length > 0) {
        const latest = list[0];
        setActiveSessionId(latest.id);
        try {
          const msgs = await getMessages(latest.id);
          if (msgs && msgs.length > 0) {
            setMessages(
              msgs.map((m: ChatMessageInfo) => {
                let cmds: string[] = [];
                if (m.commands) {
                  try {
                    const parsed = JSON.parse(m.commands);
                    if (Array.isArray(parsed)) {
                      cmds = parsed.map((cmd: any) => {
                        if (cmd.action === "add" && cmd.elementType) return `add ${cmd.elementType}`;
                        if (cmd.action === "update" && cmd.elementId) return `update ${cmd.elementId}`;
                        if (cmd.action === "delete" && cmd.elementId) return `delete ${cmd.elementId}`;
                        return cmd.action || "";
                      }).filter(Boolean);
                    }
                  } catch {}
                }
                return {
                  role: m.role,
                  text: m.content,
                  category: m.category,
                  commands: cmds.length > 0 ? cmds : undefined,
                };
              })
            );
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // ── Session management ─────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    try {
      const session = await createSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([
        { role: "assistant", text: "Hello! I'm your AI CAD assistant. How can I help you today?" },
      ]);
      setShowHistory(false);
    } catch {
      // fallback: just reset messages locally
      setActiveSessionId(null);
      setMessages([
        { role: "assistant", text: "Hello! I'm your AI CAD assistant. How can I help you today?" },
      ]);
    }
  }, []);

  const handleSelectSession = useCallback(async (session: ChatSessionInfo) => {
    setActiveSessionId(session.id);
    setShowHistory(false);
    try {
      const msgs = await getMessages(session.id);
      if (msgs && msgs.length > 0) {
        setMessages(
          msgs.map((m: ChatMessageInfo) => {
            let cmds: string[] = [];
            if (m.commands) {
              try {
                const parsed = JSON.parse(m.commands);
                if (Array.isArray(parsed)) {
                  cmds = parsed.map((cmd: any) => {
                    if (cmd.action === "add" && cmd.elementType) return `add ${cmd.elementType}`;
                    if (cmd.action === "update" && cmd.elementId) return `update ${cmd.elementId}`;
                    if (cmd.action === "delete" && cmd.elementId) return `delete ${cmd.elementId}`;
                    return cmd.action || "";
                  }).filter(Boolean);
                }
              } catch {}
            }
            return {
              role: m.role,
              text: m.content,
              category: m.category,
              commands: cmds.length > 0 ? cmds : undefined,
            };
          })
        );
      } else {
        setMessages([
          { role: "assistant", text: "Hello! I'm your AI CAD assistant. How can I help you today?" },
        ]);
      }
    } catch {
      setMessages([
        { role: "assistant", text: "Failed to load chat history." },
      ]);
    }
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([
          { role: "assistant", text: "Hello! I'm your AI CAD assistant. How can I help you today?" },
        ]);
      }
    } catch {
      // ignore
    }
  }, [activeSessionId]);

  // ── Ensure a session exists before sending ─────────────────────────────
  const ensureSession = useCallback(async (): Promise<string> => {
    if (activeSessionId) return activeSessionId;
    const session = await createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session.id;
  }, [activeSessionId]);

  // ── File upload handler ─────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "dxf" && ext !== "dwg") {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Unsupported file type. Please upload a .dxf or .dwg file." },
      ]);
      return;
    }

    setIsUploading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `📁 Uploading ${file.name} to Knowledge Base...` },
    ]);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/rag/upload-cad", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }

      const result: UploadResult = await res.json();
      const meta = result.metadata;

      const layerSummary = meta.layers
        .slice(0, 8)
        .map((l) => `${l.name} (${l.count} entities, ${l.arch_type})`)
        .join(", ");
      const textSummary = meta.text_entities
        .slice(0, 10)
        .map((t) => t.text)
        .join(", ");
      const blockSummary = meta.block_inserts
        .slice(0, 10)
        .map((b) => b.block_name)
        .join(", ");

      const msg = [
        `✅ **${result.file_name}** uploaded successfully!`,
        `📊 Created ${result.chunks_created} knowledge chunk(s).`,
        ``,
        `**Units:** ${meta.units}`,
        meta.layers.length > 0 ? `**Layers:** ${layerSummary}` : null,
        meta.text_entities.length > 0 ? `**Text:** ${textSummary}` : null,
        meta.block_inserts.length > 0 ? `**Components:** ${blockSummary}` : null,
        ``,
        meta.summary ? `**Summary:** ${meta.summary}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      setMessages((prev) => [...prev, { role: "assistant", text: msg }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Upload failed";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `❌ ${errMsg}` },
      ]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Process prompt with SSE streaming ──────────────────────────────────
  const processPrompt = async (prompt: string) => {
    const lower = prompt.toLowerCase();
    const newMessages = [...messages, { role: "user", text: prompt }];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);

    try {
      // Build BIM context summary
      const bimContext = bimResult
        ? `Current building model: ${bimResult.walls.length} walls, ` +
          `rooms: ${bimResult.rooms.map((r: { name: string }) => r.name).join(", ") || "none"}, ` +
          `${bimResult.openings.filter((o: { type: string }) => o.type === "door").length} doors, ` +
          `${bimResult.openings.filter((o: { type: string }) => o.type === "window").length} windows. ` +
          `Units: ${bimResult.units}.`
        : "";

      // ── Unified AI Interact router ─────────────────────────────────────
      if (elements.length === 0 && isDrawingPrompt(lower)) {
        // Fall through to drawing generation prompts if canvas is empty
      } else {
        const token = localStorage.getItem("token") || undefined;
        try {
          const dbSessionId = await ensureSession();
          const enrichedPrompt = bimContext ? `${bimContext}\n\nQuestion: ${prompt}` : prompt;
          const res = await interactDrawingFromPrompt(enrichedPrompt, elements, token, dbSessionId);

          if (res.error) {
            setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${res.error}` }]);
          } else {
            if (res.category === "cad_drawing") {
              const store = useDrawingStore.getState();
              const activeLayerId = store.activeLayerId;
              let addedCount = 0, updatedCount = 0, deletedCount = 0;
              const executedStrs: string[] = [];

              res.commands.forEach((cmd: { action: string; elementType?: string; elementId?: string; properties?: Record<string, unknown> }) => {
                if (cmd.action === "add" && cmd.elementType) {
                  let newEl: DrawingElement = {
                    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: cmd.elementType,
                    layerId: activeLayerId,
                    ...cmd.properties
                  } as unknown as DrawingElement;

                  if (cmd.elementType === "wall") {
                    const props = cmd.properties || {};
                    const start = (props.start as { x: number; y: number }) || { x: (props.x1 as number) || 0, y: (props.y1 as number) || 0 };
                    const end = (props.end as { x: number; y: number }) || { x: (props.x2 as number) || 0, y: (props.y2 as number) || 0 };
                    const thickness = (props.thickness as number) || (props.wallThickness as number) || 20;
                    const height = (props.height as number) || 300;
                    newEl = {
                      ...newEl,
                      archType: "wall",
                      start, end,
                      x1: start.x, y1: start.y, x2: end.x, y2: end.y,
                      thickness, wallThickness: thickness, height,
                    };
                  } else if (cmd.elementType === "door" || cmd.elementType === "window" || cmd.elementType === "opening") {
                    const props = cmd.properties || {};
                    const type = (props.openingType as string) || (props.archType as string) || cmd.elementType;
                    const hostWallId = (props.hostWallId as string) || "";
                    const pos = (props.position as { x: number; y: number }) || { x: (props.x as number) || 0, y: (props.y as number) || 0 };
                    const width = (props.width as number) || 90;
                    const height = (props.height as number) || 210;
                    const sill = (props.sill as number) || (type === "door" ? 0 : 90);
                    newEl = {
                      ...newEl,
                      type: "opening",
                      archType: type as DrawingElement["archType"],
                      openingType: type,
                      hostWallId,
                      position: pos,
                      x: pos.x, y: pos.y, width, height, sill,
                    };
                  }
                  store.addElement(newEl);
                  addedCount++;
                  executedStrs.push(`add ${cmd.elementType}`);
                } else if (cmd.action === "update" && cmd.elementId && cmd.properties) {
                  store.updateElement(cmd.elementId, cmd.properties);
                  updatedCount++;
                  executedStrs.push(`update ${cmd.elementId}`);
                } else if (cmd.action === "delete" && cmd.elementId) {
                  store.deleteElement(cmd.elementId);
                  deletedCount++;
                  executedStrs.push(`delete ${cmd.elementId}`);
                }
              });

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: `${res.summary}\n\n(Modified drawing: added ${addedCount}, updated ${updatedCount}, deleted ${deletedCount} elements)`,
                  commands: executedStrs,
                  category: res.category,
                },
              ]);
              useDrawingStore.getState().saveDrawing();
            } else {
              // RAG categories & general knowledge answers
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: res.summary,
                  category: res.category,
                },
              ]);
            }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [...prev, { role: "assistant", text: `Interaction failed: ${errMsg}` }]);
        }
        setIsProcessing(false);
        return;
      }

      // ── Drawing generation prompts ─────────────────────────────────────
      if (isDrawingPrompt(lower)) {
        const token = localStorage.getItem("token") || undefined;
        const dbSessionId = await ensureSession();
        const sessionId = previewStore.startSession();

        const result = await generateDrawingFromPrompt(prompt, token, (partialElements, done) => {
          if (partialElements.length > 0) {
            const { panOffset, zoom } = useDrawingStore.getState();
            centerElementsOnViewport(partialElements, panOffset, zoom);
            partialElements.forEach((el: Record<string, unknown>, i: number) => {
              const node: PreviewNode = {
                previewId: (el.id as string) || `preview-${sessionId}-${i}`,
                sessionId,
                nodeType: (el.type as string) || 'line',
                geometry: el,
                layerId: el.layerId as string,
                label: el.text as string,
              };
              previewStore.streamPreviewNode(node);
            });
          }
          if (done) {
            previewStore.completePreview(sessionId);
            setIsProcessing(false);
          }
        }, dbSessionId);

        if (result.error) {
          const errMsg = result.error ?? 'Unknown error';
          previewStore.failPreview(errMsg);
          setMessages((prev) => [...prev, { role: "assistant", text: errMsg }]);
        } else {
          if (result.plan) setCurrentArchitecturalPlan(result.plan);

          if (previewStore.previewNodes.length === 0 && result.elements.length > 0) {
            const { panOffset, zoom } = useDrawingStore.getState();
            centerElementsOnViewport(result.elements, panOffset, zoom);
            result.elements.forEach((el: Record<string, unknown>, i: number) => {
              previewStore.streamPreviewNode({
                previewId: (el.id as string) || `preview-${sessionId}-${i}`,
                sessionId,
                nodeType: (el.type as string) || 'line',
                geometry: el,
                layerId: el.layerId as string,
              });
            });
            previewStore.completePreview(sessionId);
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Preview ready: ${result.elements.length} element(s). Accept or discard below.` },
          ]);
        }
        setIsProcessing(false);
        return;
      }

      // ── Default: SSE streaming chat via session API ─────────────────────
      const sessionId = await ensureSession();

      // Add streaming placeholder message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "", is_streaming: true },
      ]);

      await sendMessageSSE(sessionId, prompt, elements, {
        onClassification: (category) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.is_streaming) {
              last.category = category;
            }
            return [...updated];
          });
        },
        onChunk: (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.is_streaming) {
              last.text += chunk;
            }
            return [...updated];
          });
        },
        onDone: () => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.is_streaming) {
              last.is_streaming = false;
            }
            return [...updated];
          });
          // Refresh sessions list to get updated titles
          listSessions().then(setSessions).catch(() => {});
        },
        onError: (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.is_streaming) {
              last.text = `❌ ${error}`;
              last.is_streaming = false;
            }
            return [...updated];
          });
        },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${errMsg}` }]);
    }

    setIsProcessing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        processPrompt(input.trim());
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
          <span className="text-purple-400">✦</span> AI Assistant
        </h3>
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.dwg"
            onChange={handleFileUpload}
            className="hidden"
            id="rag-file-upload"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600/80 text-white rounded hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            title="Upload DXF/DWG file to AI Knowledge Base"
          >
            {isUploading ? (
              <>
                <span className="animate-spin">⏳</span> Uploading...
              </>
            ) : (
              <>
                <span>📁</span> Upload
              </>
            )}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            title="Chat history"
          >
            🕓 History
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600/80 text-white rounded hover:bg-purple-500 transition-colors"
            title="Start new chat"
          >
            ＋ New
          </button>
        </div>
      </div>

      {/* Session History Panel */}
      {showHistory && (
        <div className="border-b border-gray-700 max-h-48 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 text-center">No chat history yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-gray-700/50 transition-colors ${
                  activeSessionId === session.id ? "bg-purple-600/20 border-l-2 border-purple-500" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 truncate">{session.title}</div>
                  <div className="text-gray-500 text-[10px]">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="ml-2 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? "text-blue-300 text-right"
                : "text-slate-700 dark:text-gray-300 transition-colors duration-300"
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded-lg max-w-[90%] ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30"
                  : "bg-gray-700/50 border border-gray-600/30"
              }`}
            >
              {/* Category badge */}
              {msg.category && CATEGORY_LABELS[msg.category] && (
                <div className={`text-[10px] mb-1 ${CATEGORY_LABELS[msg.category].color}`}>
                  {CATEGORY_LABELS[msg.category].icon} {CATEGORY_LABELS[msg.category].label}
                </div>
              )}

              {/* Message text */}
              <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>

              {/* Streaming cursor */}
              {msg.is_streaming && (
                <span className="inline-block w-1.5 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
              )}

              {/* Commands list */}
              {msg.commands && msg.commands.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-600/50">
                  <span className="text-xs text-slate-400 dark:text-gray-500 transition-colors duration-300">Commands executed:</span>
                  {msg.commands.map((cmd, j) => (
                    <code key={j} className="block text-xs text-green-400 font-mono mt-0.5">
                      : {cmd}
                    </code>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && !messages[messages.length - 1]?.is_streaming && (
          <div className="text-slate-400 dark:text-gray-500 transition-colors duration-300 text-sm flex items-center gap-2">
            <span className="animate-pulse">●</span> Processing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {AI_SUGGESTIONS.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => processPrompt(suggestion)}
              className="text-xs px-2 py-1 bg-gray-700 text-gray-400 rounded-full hover:bg-gray-600 hover:text-gray-200 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* AI Draft Accept / Discard */}
      {(previewStatus === 'complete' || previewStatus === 'streaming') && previewNodeCount > 0 && (
        <div className="px-3 pb-2 flex gap-2 border-t border-gray-700 pt-2">
          <button
            onClick={() => {
              const commands = previewStore.acceptDraft();
              const { activeLayerId } = useDrawingStore.getState();
              commands.forEach((cmd: { type: string; node?: Record<string, unknown> }) => {
                if (cmd.type === 'create-node' && cmd.node) {
                  const node = cmd.node as { geometry?: Record<string, unknown>; layerId?: string; [key: string]: unknown };
                  useDrawingStore.getState().addElement({
                    ...(node.geometry ?? node),
                    layerId: node.layerId || activeLayerId
                  } as DrawingElement);
                }
              });
              setMessages((prev) => [...prev, { role: 'assistant', text: `Accepted ${commands.length} element(s).` }]);
            }}
            className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Accept Draft ({previewNodeCount})
          </button>
          <button
            onClick={() => {
              previewStore.discardDraft();
              setMessages((prev) => [...prev, { role: 'assistant', text: 'Draft discarded.' }]);
            }}
            className="flex-1 px-3 py-1.5 bg-gray-600 text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-500"
          >
            Discard
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or describe what to draw..."
            disabled={isProcessing}
            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:border-purple-500 placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={() => input.trim() && processPrompt(input.trim())}
            disabled={isProcessing || !input.trim()}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function isDrawingPrompt(lower: string): boolean {
  return (
    lower.includes("draw") ||
    lower.includes("house") ||
    lower.includes("floor plan") ||
    lower.includes("floorplan") ||
    lower.includes("room") ||
    lower.includes("bedroom")
  );
}
