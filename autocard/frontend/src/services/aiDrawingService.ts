/**
 * AI Drawing Service
 * Calls the Go backend at POST /api/ai/generate
 * The backend holds the Gemini API key — it is NEVER exposed to the browser.
 */

import { DrawingElement } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface AiGenerateResult {
  elements: DrawingElement[];
  error?: string;
}

let idCounter = Date.now();
const genId = () => `ai-${++idCounter}`;

export async function generateDrawingFromPrompt(
  prompt: string,
  authToken?: string
): Promise<AiGenerateResult> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ prompt }),
    });

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

    return { elements };
  } catch (err: any) {
    return { elements: [], error: err?.message || "Network error — is the backend running?" };
  }
}
