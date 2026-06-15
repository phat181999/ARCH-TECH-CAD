import type { BlockDef } from "../types";
import { useDrawingStore } from "../stores/drawingStore";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";
const API = `${API_BASE}/api`;

export interface OrgBlockRecord {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  block_def: BlockDef;
  preview_svg: string;
  thumbnail_url: string;
  is_published: boolean;
  download_count: number;
  created_at: string;
}

export interface CreateBlockPayload {
  name: string;
  description: string;
  category: string;
  tags: string[];
  block_def: BlockDef;
  preview_svg?: string;
}

export interface UpdateBlockPayload {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  preview_svg?: string;
  is_published?: boolean;
}

async function apiFetch<T>(url: string, token: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // If the server returned HTML (e.g. a 404 page), give a cleaner error
    if (text.trim().startsWith("<")) {
      throw new Error(`API not reachable (HTTP ${res.status}). Check your backend is running.`);
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from server. Check your API URL configuration.`);
  }
}

// ── My Blocks (user-private) ─────────────────────────────────────────────────

export function listMyBlocks(token: string): Promise<OrgBlockRecord[]> {
  return apiFetch(`${API}/my-blocks`, token);
}

export function createMyBlock(token: string, payload: CreateBlockPayload): Promise<OrgBlockRecord> {
  return apiFetch(`${API}/my-blocks`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteMyBlock(token: string, id: string): Promise<void> {
  return apiFetch(`${API}/my-blocks/${id}`, token, { method: "DELETE" });
}

// ── Org Block Store ──────────────────────────────────────────────────────────

export function listOrgBlocks(token: string, orgId: string, q?: string): Promise<OrgBlockRecord[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch(`${API}/organizations/${orgId}/blocks${qs}`, token);
}

export function createOrgBlock(token: string, orgId: string, payload: CreateBlockPayload): Promise<OrgBlockRecord> {
  return apiFetch(`${API}/organizations/${orgId}/blocks`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrgBlock(token: string, orgId: string, blockId: string): Promise<OrgBlockRecord> {
  return apiFetch(`${API}/organizations/${orgId}/blocks/${blockId}`, token);
}

export function updateOrgBlock(
  token: string,
  orgId: string,
  blockId: string,
  payload: UpdateBlockPayload,
): Promise<OrgBlockRecord> {
  return apiFetch(`${API}/organizations/${orgId}/blocks/${blockId}`, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function publishOrgBlock(
  token: string,
  orgId: string,
  blockId: string,
  publish: boolean,
): Promise<void> {
  return apiFetch(`${API}/organizations/${orgId}/blocks/${blockId}/publish`, token, {
    method: "PUT",
    body: JSON.stringify({ is_published: publish }),
  });
}

export function deleteOrgBlock(token: string, orgId: string, blockId: string): Promise<void> {
  return apiFetch(`${API}/organizations/${orgId}/blocks/${blockId}`, token, { method: "DELETE" });
}

export async function uploadBlockThumbnail(
  token: string,
  orgId: string,
  blockId: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("thumbnail", file);
  const res = await fetch(`${API}/organizations/${orgId}/blocks/${blockId}/thumbnail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

/** Inject an OrgBlockRecord's BlockDef into the drawing store and insert it at (x, y). */
export function injectAndInsertBlock(
  record: OrgBlockRecord,
  x: number,
  y: number,
  scale = 1,
  rotation = 0,
) {
  const store = useDrawingStore.getState();
  if (!store.blockDefs[record.id]) {
    useDrawingStore.setState((s: any) => ({
      blockDefs: {
        ...s.blockDefs,
        [record.id]: {
          id: record.id,
          name: record.name,
          elements: record.block_def.elements,
          insertionPoint: record.block_def.insertionPoint ?? { x: 0, y: 0 },
        },
      },
    }));
  }
  store.insertBlock(record.id, x, y, scale, rotation);
}
