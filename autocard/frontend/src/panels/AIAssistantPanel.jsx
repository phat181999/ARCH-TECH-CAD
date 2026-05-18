import { useState, useRef, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { useCommandStore } from "../stores/commandStore";

const AI_SUGGESTIONS = [
  "Draw a 10x20 house",
  "Add dimensions to all lines",
  "Color all walls blue",
  "Create a grid of 4 circles",
  "Draw a floor plan 30x40",
  "Add a title block",
];

export default function AIAssistantPanel() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello! I'm your AI CAD assistant. Describe what you'd like to draw, and I'll help you create it." },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  const elements = useDrawingStore((s) => s.elements);
  const addElement = useDrawingStore((s) => s.addElement);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const setSelectedElementIds = useDrawingStore((s) => s.setSelectedElementIds);
  const execute = useCommandStore((s) => s.execute);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const processPrompt = async (prompt) => {
    const lower = prompt.toLowerCase();
    const newMessages = [...messages, { role: "user", text: prompt }];
    setMessages(newMessages);
    setInput("");
    setIsProcessing(true);

    try {
      // Try backend AI first
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, elements: elements.slice(0, 50) }),
      });

      if (response.ok) {
        const data = await response.json();
        const commands = data.commands || [];
        const reply = data.reply || "Executed commands based on your request.";

        // Execute each command
        for (const cmd of commands) {
          execute({ onExport: () => {} });
          // Simulate typing the command
          useCommandStore.getState().setInput(cmd);
          useCommandStore.getState().execute({ onExport: () => {} });
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply, commands },
        ]);
      } else {
        // Fallback: local processing
        const result = await localProcessPrompt(prompt, lower);
        setMessages((prev) => [...prev, { role: "assistant", text: result }]);
      }
    } catch (err) {
      // Fallback to local processing
      const result = await localProcessPrompt(prompt, lower);
      setMessages((prev) => [...prev, { role: "assistant", text: result }]);
    }

    setIsProcessing(false);
  };

  const localProcessPrompt = async (prompt, lower) => {
    // Simple local command parsing
    if (lower.includes("house") || (lower.includes("rectangle") && (lower.includes("10") || lower.includes("20")))) {
      const { activeLayerId, currentStyle } = useDrawingStore.getState();
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "rectangle", x: 100, y: 100, width: 400, height: 300,
        strokeColor: currentStyle.strokeColor, strokeWidth: 2, fillColor: "transparent",
        layerId: activeLayerId,
      });
      // Add a door
      addElement({
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "line", x1: 250, y1: 400, x2: 250, y2: 350,
        strokeColor: "#8B4513", strokeWidth: 3, layerId: activeLayerId,
      });
      return "🏠 Created a 20x15 house outline with a door. You can add windows and roof details!";
    }

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

  const handleKeyDown = (e) => {
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
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
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
                : "text-gray-300"
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
                  <span className="text-xs text-gray-500">Commands executed:</span>
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
          <div className="text-gray-500 text-sm flex items-center gap-2">
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