// ── Chat Session API Service ──────────────────────────────────────────────────

export interface ChatSessionInfo {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageInfo {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  commands?: string;
  created_at: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function listSessions(): Promise<ChatSessionInfo[]> {
  const res = await fetch("/api/chat/sessions", { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function createSession(title?: string): Promise<ChatSessionInfo> {
  const res = await fetch("/api/chat/sessions", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title: title || "New Chat" }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(sessionId: string): Promise<ChatMessageInfo[]> {
  const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

// ── SSE Streaming Message ─────────────────────────────────────────────────────

export interface SSECallbacks {
  onClassification?: (category: string) => void;
  onChunk?: (chunk: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export async function sendMessageSSE(
  sessionId: string,
  content: string,
  elements: unknown[],
  callbacks: SSECallbacks
): Promise<void> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, elements }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    callbacks.onError?.(err.error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError?.("Streaming not supported");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;

      try {
        const event = JSON.parse(data);

        if (event.type === "classification") {
          callbacks.onClassification?.(event.category);
        } else if (event.type === "content_chunk") {
          if (event.is_done) {
            callbacks.onDone?.();
          } else if (event.content_chunk) {
            callbacks.onChunk?.(event.content_chunk);
          }
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith("data: ")) {
    const data = buffer.slice(6).trim();
    if (data) {
      try {
        const event = JSON.parse(data);
        if (event.type === "content_chunk" && event.is_done) {
          callbacks.onDone?.();
        }
      } catch {
        // skip
      }
    }
  }
}
