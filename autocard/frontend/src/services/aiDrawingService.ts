/**
 * AI Drawing Service
 * Calls the Go backend at POST /api/ai/generate
 * The backend holds the Gemini API key — it is NEVER exposed to the browser.
 */

import { ArchitecturalPlan, DrawingElement } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface AiGenerateResult {
  elements: DrawingElement[];
  plan?: ArchitecturalPlan;
  error?: string;
}

let idCounter = Date.now();
const genId = () => `ai-${++idCounter}`;

export async function generateDrawingFromPrompt(
  prompt: string,
  authToken?: string,
  onProgress?: (elements: DrawingElement[], done: boolean) => void
): Promise<AiGenerateResult> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ prompt, stream: !!onProgress }),
    });

    // If server returned an error status, always fall through to JSON error handling
    if (onProgress && res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullJsonString = "";
      const streamSessionId = Date.now();
      let lastExtractedCount = 0;
      console.log("[AI Stream] Starting SSE stream...");
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Stream finished — do final full parse and signal done
          console.log("[AI Stream] Stream done. Accumulated text length:", fullJsonString.length);
          let cleaned = fullJsonString;
          const jsonStart = cleaned.indexOf('[');
          const jsonEnd = cleaned.lastIndexOf(']');
          if (jsonStart !== -1 && jsonEnd !== -1) cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
          else {
            if (cleaned.includes('```json')) cleaned = cleaned.split('```json')[1];
            if (cleaned.includes('```')) cleaned = cleaned.split('```')[0];
          }
          console.log("[AI Stream] Parsed JSON:", cleaned.substring(0, 200));
          try {
            const parsed = JSON.parse(cleaned.trim());
            const finalElements = Array.isArray(parsed) ? parsed : [];
            console.log("[AI Stream] Final element count:", finalElements.length);
            const safeFinals = finalElements.map((el: any, i: number) => ({
              ...el,
              id: el.id || `ai-stream-${streamSessionId}-${i}`,
              layerId: el.layerId || "A-WALL",
              strokeColor: el.strokeColor || "#38BDF8",
              fillColor: el.fillColor || "transparent",
            }));
            // Fire onProgress with done=true so UI can clear loading
            onProgress(safeFinals, true);
            return { elements: safeFinals };
          } catch (parseErr) {
            console.error("[AI Stream] Final JSON parse failed:", parseErr);
            console.error("[AI Stream] Raw text sample:", fullJsonString.substring(0, 500));
            // Best-effort: fire done with whatever we streamed so far
            onProgress([], true);
            return { elements: [], error: "AI response completed but JSON could not be parsed. Check browser console for details." };
          }
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') continue;
            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.text) {
                fullJsonString += dataObj.text;
                
                // Incremental parser — emit newly-found complete objects only
                const extractedElements = extractCompleteJsonObjects(fullJsonString);
                if (extractedElements.length > lastExtractedCount) {
                  lastExtractedCount = extractedElements.length;
                  const safeElements = extractedElements.map((el: any, i: number) => ({
                    ...el,
                    id: el.id || `ai-stream-${streamSessionId}-${i}`,
                    layerId: el.layerId || "A-WALL",
                    strokeColor: el.strokeColor || "#38BDF8",
                    fillColor: el.fillColor || "transparent",
                  }));
                  // done=false signals a progress update, not the final result
                  onProgress(safeElements, false);
                }
              }
            } catch (e) {
              // Ignore partial JSON parsing errors mid-stream
            }
          }
        }
      }
    }

    const data = await res.json();

    if (!res.ok || data.error) {
      return { elements: [], error: data.error || `Server error ${res.status}` };
    }

    if (!Array.isArray(data.elements) || data.elements.length === 0) {
      return { elements: [], error: "AI returned no elements. Try a clearer prompt." };
    }

    // Ensure each element has a local ID and required defaults
    const elements: DrawingElement[] = data.elements.map((el: any) => ({
      ...el,
      id: el.id || genId(),
      layerId: el.layerId,
      strokeColor: el.strokeColor || "#38BDF8",
      fillColor: el.fillColor || "transparent",
      strokeWidth: el.lineWidth || el.strokeWidth || 2,
    })) as DrawingElement[];

    return { elements, plan: data.plan };
  } catch (err: any) {
    return { elements: [], error: err?.message || "Network error — is the backend running?" };
  }
}

function extractCompleteJsonObjects(str: string): any[] {
  const results: any[] = [];
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let startIdx = -1;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          try {
            const objStr = str.substring(startIdx, i + 1);
            results.push(JSON.parse(objStr));
          } catch (e) {
            // Invalid block
          }
          startIdx = -1;
        }
      }
    }
  }
  return results;
}

export function centerElementsOnViewport(elements: DrawingElement[], panOffset: { x: number, y: number }, zoom: number) {
  if (elements.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    if (el.type === 'rectangle' && typeof el.x === 'number' && typeof el.y === 'number' && typeof el.width === 'number' && typeof el.height === 'number') {
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width); maxY = Math.max(maxY, el.y + el.height);
    } else if (el.type === 'line' && typeof el.x1 === 'number' && typeof el.y1 === 'number' && typeof el.x2 === 'number' && typeof el.y2 === 'number') {
      minX = Math.min(minX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2);
      maxX = Math.max(maxX, el.x1, el.x2); maxY = Math.max(maxY, el.y1, el.y2);
    } else if (el.type === 'circle' && typeof el.cx === 'number' && typeof el.cy === 'number' && typeof el.radius === 'number') {
      minX = Math.min(minX, el.cx - el.radius); minY = Math.min(minY, el.cy - el.radius);
      maxX = Math.max(maxX, el.cx + el.radius); maxY = Math.max(maxY, el.cy + el.radius);
    }
  });

  if (!Number.isFinite(minX)) return;

  const boundsCenterX = (minX + maxX) / 2;
  const boundsCenterY = (minY + maxY) / 2;

  const canvasWidth = window.innerWidth || 1200;
  const canvasHeight = window.innerHeight || 800;
  const targetWorldX = (canvasWidth / 2 - panOffset.x) / zoom;
  const targetWorldY = (canvasHeight / 2 - panOffset.y) / zoom;

  const dx = targetWorldX - boundsCenterX;
  const dy = targetWorldY - boundsCenterY;

  elements.forEach(el => {
    if (typeof el.x === 'number') el.x += dx;
    if (typeof el.y === 'number') el.y += dy;
    if (typeof el.x1 === 'number') el.x1 += dx;
    if (typeof el.y1 === 'number') el.y1 += dy;
    if (typeof el.x2 === 'number') el.x2 += dx;
    if (typeof el.y2 === 'number') el.y2 += dy;
    if (typeof el.cx === 'number') el.cx += dx;
    if (typeof el.cy === 'number') el.cy += dy;
    if (typeof el.labelX === 'number') el.labelX += dx;
    if (typeof el.labelY === 'number') el.labelY += dy;
  });
}

export interface AiInteractResult {
  category: string;
  commands: {
    action: "add" | "update" | "delete";
    elementId?: string;
    elementType?: string;
    properties?: Record<string, any>;
  }[];
  summary: string;
  error?: string;
}

export async function interactDrawingFromPrompt(
  prompt: string,
  elements: DrawingElement[],
  authToken?: string,
  sessionId?: string
): Promise<AiInteractResult> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/interact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ prompt, elements, session_id: sessionId }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { category: "general_knowledge", commands: [], summary: "", error: data.error || `Server error ${res.status}` };
    }

    return {
      category: data.category || "general_knowledge",
      commands: data.commands || [],
      summary: data.summary || "No changes made."
    };
  } catch (err: any) {
    return { category: "general_knowledge", commands: [], error: err?.message || "Network error", summary: "" };
  }
}
