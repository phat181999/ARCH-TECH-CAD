import { useState, useEffect, useRef } from "react";
import { useCommandStore } from "../stores/commandStore";

export default function CommandLine({ onExport }) {
  const {
    input,
    history,
    historyIndex,
    suggestions,
    showSuggestions,
    output,
    isFocused,
    setInput,
    execute,
    historyUp,
    historyDown,
    setFocused,
    clearOutput,
  } = useCommandStore();

  const inputRef = useRef(null);
  const [outputHistory, setOutputHistory] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ":" && !isFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setFocused(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape" && isFocused) {
        setFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, setFocused]);

  useEffect(() => {
    if (output) {
      setOutputHistory((prev) => [...prev.slice(-99), output]);
      clearOutput();
    }
  }, [output, clearOutput]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      execute({ onExport });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      historyUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      historyDown();
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[0].toLowerCase());
    }
  };

  const handleFocus = () => setFocused(true);
  const handleBlur = () => setFocused(false);

  return (
    <div className="bg-gray-950 border-t border-gray-700 flex-shrink-0">
      {/* Output history */}
      {outputHistory.length > 0 && (
        <div className="max-h-24 overflow-y-auto px-3 py-1 space-y-0.5 bg-gray-900">
          {outputHistory.map((line, i) => (
            <div key={i} className="text-xs font-mono text-gray-400 whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center px-3 py-1.5 gap-2 relative">
        <span className="text-gray-500 font-mono text-sm select-none">:</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Type a command... (: to focus)"
          className="flex-1 bg-transparent text-gray-200 font-mono text-sm outline-none placeholder-gray-600"
        />

        {/* Autocomplete dropdown */}
        {showSuggestions && isFocused && (
          <div className="absolute bottom-full left-0 right-0 bg-gray-900 border border-gray-700 rounded-t-lg shadow-lg max-h-40 overflow-y-auto z-50">
            {suggestions.map((cmd) => (
              <button
                key={cmd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInput(cmd.toLowerCase());
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-1.5 text-sm font-mono text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}