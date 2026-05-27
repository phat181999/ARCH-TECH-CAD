import React, { useState, useEffect } from "react";
import { useThemeStore } from "../../../stores/themeStore";

export interface AnnotationConfirmPayload {
  type: "room-label" | "text" | "leader";
  roomLabel?: string;
  roomType?: string;
  roomArea?: string;
  textContent?: string;
  textSize?: number;
  textColor?: string;
}

interface AnnotationDialogProps {
  activeDialog: {
    type: "room-label" | "text" | "leader";
    point: { x: number; y: number };
  };
  onClose: () => void;
  onConfirm: (payload: AnnotationConfirmPayload) => void;
}

export const AnnotationDialog: React.FC<AnnotationDialogProps> = ({
  activeDialog,
  onClose,
  onConfirm,
}) => {
  const isDark = useThemeStore((state) => state.isDark);

  const [roomLabelInput, setRoomLabelInput] = useState("");
  const [roomTypeSelect, setRoomTypeSelect] = useState("bedroom");
  const [roomAreaInput, setRoomAreaInput] = useState("");
  const [customTextContent, setCustomTextContent] = useState("");
  const [customTextSize, setCustomTextSize] = useState(16);
  const [customTextColor, setCustomTextColor] = useState("");

  // Initialize color based on theme
  useEffect(() => {
    setCustomTextColor(isDark ? "#ffffff" : "#1f2937");
  }, [isDark]);

  const handleConfirm = () => {
    if (activeDialog.type === "room-label") {
      onConfirm({
        type: "room-label",
        roomLabel: roomLabelInput,
        roomType: roomTypeSelect,
        roomArea: roomAreaInput,
      });
    } else if (activeDialog.type === "text") {
      onConfirm({
        type: "text",
        textContent: customTextContent,
        textSize: customTextSize,
        textColor: customTextColor,
      });
    } else if (activeDialog.type === "leader") {
      onConfirm({
        type: "leader",
        textContent: customTextContent,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-50/80 dark:bg-[#0B0E14]/80 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#1E293B]">
          <div className="flex items-center text-slate-800 dark:text-gray-200 font-bold text-sm">
            <svg className="w-4 h-4 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            {activeDialog.type === "room-label"
              ? "Add Room Label"
              : activeDialog.type === "text"
              ? "Add Text Entity"
              : "Add Leader Annotation"}
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {activeDialog.type === "room-label" && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomLabelInput}
                  onChange={(e) => setRoomLabelInput(e.target.value)}
                  placeholder="e.g. Bedroom, Living Room..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />
              </div>

              {/* Preset Chips */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Bedroom", "Living Room", "Kitchen", "Bathroom", "Office", "Dining Room", "Hallway"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setRoomLabelInput(preset);
                        setRoomTypeSelect(preset.toLowerCase().replace(" ", "-"));
                      }}
                      className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full font-medium transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    Type Category
                  </label>
                  <select
                    value={roomTypeSelect}
                    onChange={(e) => setRoomTypeSelect(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-2.5 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="bedroom">Bedroom</option>
                    <option value="living-room">Living Room</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="bathroom">Bathroom</option>
                    <option value="office">Office</option>
                    <option value="corridor">Corridor</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    Area (m² - Optional)
                  </label>
                  <input
                    type="text"
                    value={roomAreaInput}
                    onChange={(e) => setRoomAreaInput(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirm();
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {activeDialog.type === "text" && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Text Content
                </label>
                <textarea
                  value={customTextContent}
                  onChange={(e) => setCustomTextContent(e.target.value)}
                  placeholder="Type text here..."
                  autoFocus
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg p-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    Font Size (px)
                  </label>
                  <input
                    type="number"
                    value={customTextSize}
                    onChange={(e) => setCustomTextSize(parseInt(e.target.value) || 12)}
                    min={6}
                    max={72}
                    className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={customTextColor}
                      onChange={(e) => setCustomTextColor(e.target.value)}
                      className="h-9 w-9 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg p-1 cursor-pointer focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      value={customTextColor}
                      onChange={(e) => setCustomTextColor(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-2 text-xs font-mono text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeDialog.type === "leader" && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Leader Annotation Text
                </label>
                <input
                  type="text"
                  value={customTextContent}
                  onChange={(e) => setCustomTextContent(e.target.value)}
                  placeholder="e.g. Wall connection details..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm();
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1E293B] flex justify-end space-x-3 bg-white dark:bg-[#151B23]">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-[#38BDF8] text-[#0B0E14] text-xs font-bold rounded-lg hover:bg-cyan-300 transition-colors shadow-lg"
          >
            {activeDialog.type === "leader" ? "Start Drawing Line" : "Place Entity"}
          </button>
        </div>
      </div>
    </div>
  );
};
