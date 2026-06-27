const API_BASE: string = (import.meta as Record<string, any>).env?.VITE_API_URL || "http://localhost:56396";

// Safely decode a JWT payload. JWT uses Base64URL (no padding, uses - and _).
// atob() requires standard Base64, so we normalise before decoding.
export function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export async function apiRequest(endpoint: string, options: Record<string, any> = {}): Promise<any> {
  const token: string | null = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res: Response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data: any = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || "Request failed") as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return data;
}

// BIM types — mirror backend/models/analysis_job.go
export interface BIMPoint { x: number; y: number }
export interface BIMLevel { id: string; name: string; elevation: number; height: number }
export interface BIMWall { id: string; level_id: string; role: string; x1: number; y1: number; x2: number; y2: number; thickness: number; height: number; material?: string }
export interface BIMOpening { id: string; type: "door" | "window"; host_wall_id: string; x: number; y: number; width: number; height: number; sill?: number }
export interface BIMRoom { id: string; level_id: string; name: string; room_type: string; boundary: BIMPoint[]; area: number }
export interface BIMColumn { id: string; level_id: string; x: number; y: number; width: number; depth: number; height: number; material?: string }
export interface BIMResult {
  job_id: string; analyzed: string; units: string;
  levels: BIMLevel[]; walls: BIMWall[]; openings: BIMOpening[];
  rooms: BIMRoom[]; columns: BIMColumn[];
  meta?: Record<string, unknown>;
}

interface AuthBody { email?: string; password?: string; token?: string; name?: string; }

export const auth: Record<string, (body?: any) => Promise<any>> = {
  register: (body) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body) => apiRequest("/api/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiRequest("/api/auth/me"),
  updatePreferences: (body) => apiRequest("/api/auth/preferences", { method: "PATCH", body: JSON.stringify(body) }),
  googleLogin: (body) => apiRequest("/api/auth/google", { method: "POST", body: JSON.stringify(body) }),
};

interface DrawingBody { name?: string; data?: string; version?: number; }
interface CommentBody { x?: number; y?: number; message?: string; parent_id?: string | null; }
interface ShareBody { email?: string; role?: string; }

export const drawings: Record<string, (...args: any[]) => Promise<any>> = {
  list: () => apiRequest("/api/drawings"),
  get: (id) => apiRequest(`/api/drawings/${id}`),
  create: (body) => apiRequest("/api/drawings", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => apiRequest(`/api/drawings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id) => apiRequest(`/api/drawings/${id}`, { method: "DELETE" }),
  getVersions: (id) => apiRequest(`/api/drawings/${id}/versions`),
  getVersion: (id, version) => apiRequest(`/api/drawings/${id}/versions/${version}`),
  getComments: (id) => apiRequest(`/api/drawings/${id}/comments`),
  createComment: (id, body) => apiRequest(`/api/drawings/${id}/comments`, { method: "POST", body: JSON.stringify(body) }),
  share: (id, body) => apiRequest(`/api/drawings/${id}/share`, { method: "POST", body: JSON.stringify(body) }),
  getPermissions: (id) => apiRequest(`/api/drawings/${id}/permissions`),
  removePermission: (id, userId) => apiRequest(`/api/drawings/${id}/permissions/${userId}`, { method: "DELETE" }),
  rename: (id, name) => apiRequest(`/api/drawings/${id}/rename`, { method: "PUT", body: JSON.stringify({ name }) }),
  analyzeDrawing: (id: string): Promise<{ id: string; status: string }> =>
    apiRequest(`/api/drawings/${id}/analyze`, { method: "POST" }),
  getAnalysisStatus: (id: string): Promise<{ id: string; status: string; error?: string }> =>
    apiRequest(`/api/drawings/${id}/analysis/status`),
  getAnalysisResult: (id: string): Promise<BIMResult> =>
    apiRequest(`/api/drawings/${id}/analysis`),
  uploadAvatar: (id, file: File) => {
    const token: string | null = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("avatar", file);
    return fetch(`${API_BASE}/api/drawings/${id}/avatar`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Avatar upload failed");
      return data;
    });
  },
};

export const organizations: Record<string, (...args: any[]) => Promise<any>> = {
  create: (body) => apiRequest("/api/organizations", { method: "POST", body: JSON.stringify(body) }),
  list: () => apiRequest("/api/organizations"),
  getMembers: (id) => apiRequest(`/api/organizations/${id}/members`),
  invite: (id, body) => apiRequest(`/api/organizations/${id}/invitations`, { method: "POST", body: JSON.stringify(body) }),
  removeMember: (id, userId) => apiRequest(`/api/organizations/${id}/members/${userId}`, { method: "DELETE" }),
  removeInvitation: (id, email) => apiRequest(`/api/organizations/${id}/invitations?email=${encodeURIComponent(email)}`, { method: "DELETE" }),
  updateMemberRole: (id, userId, body) => apiRequest(`/api/organizations/${id}/members/${userId}`, { method: "PUT", body: JSON.stringify(body) }),
  update: (id, body) => apiRequest(`/api/organizations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  uploadLogo: (id, file: File) => {
    const token: string | null = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("logo", file);
    return fetch(`${API_BASE}/api/organizations/${id}/logo`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Logo upload failed");
      return data;
    });
  },
};

export const admin: Record<string, (...args: any[]) => Promise<any>> = {
  getOrganizations: () => apiRequest("/api/admin/organizations"),
  updateSubscription: (id, body) => apiRequest(`/api/admin/organizations/${id}/subscription`, { method: "PUT", body: JSON.stringify(body) }),
  deleteOrganization: (id) => apiRequest(`/api/admin/organizations/${id}`, { method: "DELETE" }),
  getUsers: () => apiRequest("/api/admin/users"),
  updateSystemRole: (id, body) => apiRequest(`/api/admin/users/${id}/system-role`, { method: "PUT", body: JSON.stringify(body) }),
};

export const members: Record<string, (...args: any[]) => Promise<any>> = {
  login: (body) => apiRequest("/api/members/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body) => apiRequest("/api/members/register", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiRequest("/api/members/me"),
  updateProfile: (body) => apiRequest("/api/members/me", { method: "PUT", body: JSON.stringify(body) }),
};

export interface Material {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  category: string;
  description: string;
}

export const materials = {
  list: (): Promise<Material[]> => apiRequest("/api/materials"),
  create: (body: Partial<Material>): Promise<Material> => apiRequest("/api/materials", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Material>): Promise<{ status: string }> => apiRequest(`/api/materials/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string): Promise<{ status: string }> => apiRequest(`/api/materials/${id}`, { method: "DELETE" }),
};

export interface MaterialPreset {
  category: string;
  name: string;
  unit: string;
  base_price: number;
  reg_price: number;
  region: string;
  factor: number;
}

export const materialPresets = {
  list: (region: "HN" | "HCM" | "DN" = "HCM"): Promise<{ region: string; factor: number; presets: MaterialPreset[] }> =>
    apiRequest(`/api/material-presets?region=${region}`),
};

export interface DrawingTask {
  id: string;
  drawing_id: string;
  name: string;
  phase: string;
  description: string;
  assignee_id?: string;
  assignee_name?: string;
  status: "todo" | "in_progress" | "done";
  duration_days: number;
  labor_price: number;
  total_labor_cost: number;
}

export const drawingTasks = {
  list: (drawingId: string): Promise<DrawingTask[]> => apiRequest(`/api/drawings/${drawingId}/tasks`),
  create: (drawingId: string, body: Partial<DrawingTask>): Promise<DrawingTask> => apiRequest(`/api/drawings/${drawingId}/tasks`, { method: "POST", body: JSON.stringify(body) }),
  update: (drawingId: string, taskId: string, body: Partial<DrawingTask>): Promise<{ status: string }> => apiRequest(`/api/drawings/${drawingId}/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (drawingId: string, taskId: string): Promise<{ status: string }> => apiRequest(`/api/drawings/${drawingId}/tasks/${taskId}`, { method: "DELETE" }),
  bulkCreate: (drawingId: string, tasks: Partial<DrawingTask>[]): Promise<{ status: string; count: number }> => apiRequest(`/api/drawings/${drawingId}/tasks/bulk`, { method: "POST", body: JSON.stringify(tasks) }),
  suggest: (drawingId: string, payload: { elements?: string; members?: string }): Promise<DrawingTask[]> => apiRequest(`/api/drawings/${drawingId}/tasks/ai-suggest`, { method: "POST", body: JSON.stringify(payload) }),
};

