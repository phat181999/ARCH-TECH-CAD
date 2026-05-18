import { useState, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";

const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Georgia",
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export default function TextFormatBar({ elementId, onClose }: { elementId: string; onClose: () => void }) {
  const elements = useDrawingStore((s) => s.elements);
  const updateElement = useDrawingStore((s) => s.updateElement);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState("normal");
  const [fontStyle, setFontStyle] = useState("normal");
  const [textAlign, setTextAlign] = useState("left");
  const [textColor, setTextColor] = useState("#ffffff");

  useEffect(() => {
    const el = elements.find((e) => e.id === elementId);
    if (el) {
      setFontFamily(el.fontFamily || "Arial");
      setFontSize(el.fontSize || 16);
      setFontWeight(el.fontWeight || "normal");
      setFontStyle(el.fontStyle || "normal");
      setTextAlign(el.textAlign || "left");
      setTextColor(el.strokeColor || "#ffffff");
    }
  }, [elementId, elements]);

  const applyStyle = (key: string, value: string | number) => {
    updateElement(elementId, { [key]: value });
  };

  return (
    <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5 text-sm">
      <select
        value={fontFamily}
        onChange={(e) => {
          setFontFamily(e.target.value);
          applyStyle("fontFamily", e.target.value);
        }}
        className="bg-gray-600 text-slate-900 dark:text-white rounded px-1 py-0.5 text-xs border border-gray-500"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        value={fontSize}
        onChange={(e) => {
          setFontSize(Number(e.target.value));
          applyStyle("fontSize", Number(e.target.value));
        }}
        className="bg-gray-600 text-slate-900 dark:text-white rounded px-1 py-0.5 text-xs border border-gray-500 w-14"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <button
        onClick={() => {
          const next = fontWeight === "bold" ? "normal" : "bold";
          setFontWeight(next);
          applyStyle("fontWeight", next);
        }}
        className={`px-2 py-0.5 rounded text-xs font-bold ${
          fontWeight === "bold"
            ? "bg-blue-600 text-slate-900 dark:text-white"
            : "text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-600"
        }`}
        title="Bold"
      >
        B
      </button>

      <button
        onClick={() => {
          const next = fontStyle === "italic" ? "normal" : "italic";
          setFontStyle(next);
          applyStyle("fontStyle", next);
        }}
        className={`px-2 py-0.5 rounded text-xs italic ${
          fontStyle === "italic"
            ? "bg-blue-600 text-slate-900 dark:text-white"
            : "text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-600"
        }`}
        title="Italic"
      >
        I
      </button>

      <span className="text-gray-600 mx-0.5">|</span>

      {["left", "center", "right"].map((align) => (
        <button
          key={align}
          onClick={() => {
            setTextAlign(align);
            applyStyle("textAlign", align);
          }}
          className={`px-1.5 py-0.5 rounded text-xs ${
            textAlign === align
              ? "bg-blue-600 text-slate-900 dark:text-white"
              : "text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:text-white hover:bg-gray-600"
          }`}
          title={align.charAt(0).toUpperCase() + align.slice(1)}
        >
          {align === "left" ? "≡" : align === "center" ? "≡" : "≡"}
        </button>
      ))}

      <span className="text-gray-600 mx-0.5">|</span>

      <input
        type="color"
        value={textColor}
        onChange={(e) => {
          setTextColor(e.target.value);
          applyStyle("strokeColor", e.target.value);
        }}
        className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
        title="Text Color"
      />

      <button
        onClick={onClose}
        className="text-gray-400 hover:text-slate-900 dark:text-white ml-1 text-xs"
        title="Close"
      >
        ✕
      </button>
    </div>
  );
}