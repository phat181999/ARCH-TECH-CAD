import { useState, useRef, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { generateDrawingFromPrompt, centerElementsOnViewport } from "../services/aiDrawingService";
import { useAiPreviewStore } from "../cad/store/useAiPreviewStore";
import type { PreviewNode } from "../cad/contracts/events";

const AI_SUGGESTIONS = [
  "Draw a 10x20 house",
  "Add dimensions to all lines",
  "Color all walls blue",
  "Create a grid of 4 circles",
  "Draw a floor plan 30x40",
  "Add a title block",
];

interface Message {
  role: string;
  text: string;
  commands?: string[];
}

export default function AIAssistantPanel(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hello! I'm your AI CAD assistant. Describe what you'd like to draw, and I'll help you create it." },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const elements = useDrawingStore((s) => s.elements);
  const addElement = useDrawingStore((s) => s.addElement);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const setCurrentArchitecturalPlan = useDrawingStore((s) => s.setCurrentArchitecturalPlan);

  const previewStore = useAiPreviewStore();
  const previewStatus = useAiPreviewStore((s) => s.status);
  const previewNodeCount = useAiPreviewStore((s) => s.previewNodes.length);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const processPrompt = async (prompt: string) => {
    const lower = prompt.toLowerCase();
    const newMessages = [...messages, { role: "user", text: prompt }];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);

    try {
      if (isDrawingPrompt(lower)) {
        const token = localStorage.getItem("token") || undefined;
        const sessionId = previewStore.startSession();

        const result = await generateDrawingFromPrompt(prompt, token, (partialElements, done) => {
          // Route streamed elements into the preview store — NOT into canonical drawingStore.
          // This is the compatibility bridge: preview nodes are transient and non-persistent
          // until the user explicitly accepts the draft.
          if (partialElements.length > 0) {
            const { panOffset, zoom } = useDrawingStore.getState();
            centerElementsOnViewport(partialElements, panOffset, zoom);
            partialElements.forEach((el: any, i: number) => {
              const node: PreviewNode = {
                previewId: el.id || `preview-${sessionId}-${i}`,
                sessionId,
                nodeType: el.type || 'line',
                geometry: el,
                layerId: el.layerId,
                label: el.text,
              };
              previewStore.streamPreviewNode(node);
            });
          }
          if (done) {
            previewStore.completePreview(sessionId);
            setIsProcessing(false);
          }
        });

        if (result.error) {
          const errMsg = result.error ?? 'Unknown error';
          previewStore.failPreview(errMsg);
          setMessages((prev) => [...prev, { role: "assistant", text: errMsg }]);
        } else {
          if (result.plan) setCurrentArchitecturalPlan(result.plan);

          // If nothing was streamed (e.g. non-streaming fallback), add to preview store now
          if (previewStore.previewNodes.length === 0 && result.elements.length > 0) {
            const { panOffset, zoom } = useDrawingStore.getState();
            centerElementsOnViewport(result.elements, panOffset, zoom);
            result.elements.forEach((el, i) => {
              previewStore.streamPreviewNode({
                previewId: el.id || `preview-${sessionId}-${i}`,
                sessionId,
                nodeType: el.type || 'line',
                geometry: el,
                layerId: el.layerId,
              });
            });
            previewStore.completePreview(sessionId);
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Preview ready: ${result.elements.length} element(s). Accept or discard below.` },
          ]);
        }
      } else {
        const result = await localProcessPrompt(prompt, lower);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: result },
        ]);
      }
    } catch (err: unknown) {
      // Fallback to local processing
      const result = await localProcessPrompt(prompt, lower);
      setMessages((prev) => [...prev, { role: "assistant", text: result }]);
    }

    setIsProcessing(false);
  };

  const localProcessPrompt = async (prompt: string, lower: string) => {
    // Simple local command parsing
    if (lower.includes("dimension") || lower.includes("measure")) {
      const lineEls = elements.filter((e) => e.type === "line");
      if (lineEls.length > 0) {
        lineEls.slice(0, 5).forEach((el) => {
          addElement({
            id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "dimension", x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
            offset: 30, strokeColor: "#3b82f6", strokeWidth: 1.5,
            layerId: el.layerId,
          });
        });
        return `📏 Added dimensions to ${Math.min(lineEls.length, 5)} line(s).`;
      }
      return "No lines found to dimension. Draw some lines first.";
    }

    if (lower.includes("color") || lower.includes("blue") || lower.includes("red") || lower.includes("wall")) {
      const colorMap = { red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308", wall: "#94a3b8" };
      let color = "#3b82f6";
      for (const [key, val] of Object.entries(colorMap)) {
        if (lower.includes(key)) { color = val; break; }
      }
      const selected = useDrawingStore.getState().selectedElementIds;
      if (selected.length > 0) {
        selected.forEach((id) => updateElement(id, { strokeColor: color }));
        return `🎨 Changed ${selected.length} element(s) to ${color}`;
      }
      return "Select elements first, then ask me to change their color.";
    }

    if (lower.includes("grid") && lower.includes("circle")) {
      const { activeLayerId, currentStyle } = useDrawingStore.getState();
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          addElement({
            id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "circle", cx: 200 + col * 150, cy: 200 + row * 150, radius: 40,
            strokeColor: currentStyle.strokeColor, strokeWidth: 2, fillColor: "transparent",
            layerId: activeLayerId,
          });
        }
      }
      return "🔵 Created a 2x2 grid of circles.";
    }

    if (lower.includes("floor") || lower.includes("plan")) {
      const { activeLayerId, currentStyle } = useDrawingStore.getState();
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "rectangle", x: 50, y: 50, width: 600, height: 400,
        strokeColor: currentStyle.strokeColor, strokeWidth: 2, fillColor: "transparent",
        layerId: activeLayerId,
      });
      // Interior walls
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "line", x1: 350, y1: 50, x2: 350, y2: 250,
        strokeColor: currentStyle.strokeColor, strokeWidth: 2, layerId: activeLayerId,
      });
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "line", x1: 50, y1: 250, x2: 350, y2: 250,
        strokeColor: currentStyle.strokeColor, strokeWidth: 2, layerId: activeLayerId,
      });
      return "🏗️ Created a 30x20 floor plan with interior walls.";
    }

    if (lower.includes("title") || lower.includes("block")) {
      const { activeLayerId } = useDrawingStore.getState();
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "rectangle", x: 500, y: 500, width: 200, height: 80,
        strokeColor: "#1f2937", strokeWidth: 2, fillColor: "#f8fafc",
        layerId: activeLayerId,
      });
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "text", text: "TITLE BLOCK", x: 520, y: 540,
        fontSize: 14, fontFamily: "Arial", strokeColor: "#1f2937",
        layerId: activeLayerId,
      });
      return "📋 Added a title block at the bottom-right.";
    }

    return `I understand you want to: "${prompt}"

I can help you with:
• Drawing shapes (house, floor plan, circles)
• Adding dimensions to existing elements
• Changing colors of selected elements
• Creating title blocks

Try one of the suggestions below, or describe what you'd like to draw in detail.`;
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
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
          <span className="text-purple-400">✦</span> AI Assistant
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? "text-blue-300 text-right"
                : "text-slate-700 dark:text-slate-700 dark:text-gray-300 transition-colors duration-300"
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded-lg max-w-[90%] ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30"
                  : "bg-gray-700/50 border border-gray-600/30"
              }`}
            >
              {msg.text}
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

        {isProcessing && (
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
              className="text-xs px-2 py-1 bg-gray-700 text-slate-500 dark:text-gray-400 transition-colors duration-300 rounded-full hover:bg-gray-600 hover:text-slate-800 dark:text-gray-200 transition-colors"
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
              // Compatibility bridge: acceptDraft() returns commands for the new pipeline.
              // For now, we also write directly to the legacy drawing store so the canvas renders.
              const commands = previewStore.acceptDraft();
              const { activeLayerId } = useDrawingStore.getState();
              commands.forEach((cmd: any) => {
                if (cmd.type === 'create-node' && cmd.node) {
                  useDrawingStore.getState().addElement({ ...cmd.node.geometry ?? cmd.node, layerId: cmd.node.layerId || activeLayerId });
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
            placeholder="Describe what to draw..."
            disabled={isProcessing}
            className="flex-1 bg-gray-700 text-slate-900 dark:text-slate-900 dark:text-white transition-colors duration-300 px-3 py-2 rounded-lg text-sm border border-gray-600 focus:outline-none focus:border-purple-500 placeholder-gray-500 disabled:opacity-50"
          />
          <button
            onClick={() => input.trim() && processPrompt(input.trim())}
            disabled={isProcessing || !input.trim()}
            className="px-3 py-2 bg-purple-600 text-slate-900 dark:text-slate-900 dark:text-white transition-colors duration-300 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
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
