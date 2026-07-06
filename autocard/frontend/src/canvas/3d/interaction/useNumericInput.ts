// AutoCAD-style numeric entry while a 3D tool is active: type digits, Enter
// commits the exact value (meters), Escape clears. Consumers watch `committed`
// (or call consume()) to finalize the in-progress gesture with the exact length.
import { useCallback, useEffect, useState } from "react";
import { parseNumericInput } from "./numericInput";

export function useNumericInput(active: boolean): {
  buffer: string;
  committed: number | null;
  consume: () => number | null;
} {
  const [buffer, setBuffer] = useState("");
  const [committed, setCommitted] = useState<number | null>(null);

  useEffect(() => {
    if (!active) { setBuffer(""); setCommitted(null); return; }
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9.]$/.test(e.key)) {
        setBuffer((b) => b + e.key);
      } else if (e.key === "Backspace") {
        setBuffer((b) => b.slice(0, -1));
      } else if (e.key === "Enter") {
        setBuffer((b) => {
          const v = parseNumericInput(b);
          if (v != null) setCommitted(v);
          return "";
        });
      } else if (e.key === "Escape") {
        setBuffer("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const consume = useCallback(() => {
    const v = committed;
    if (v != null) setCommitted(null);
    return v;
  }, [committed]);

  return { buffer, committed, consume };
}
