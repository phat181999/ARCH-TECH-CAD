const API_BASE: string = (import.meta as Record<string, any>).env?.VITE_API_URL || "http://localhost:56396";

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
    throw new Error(data.error || "Request failed");
  }

  return data;
}

interface AuthBody { email?: string; password?: string; token?: string; name?: string; }

export const auth: Record<string, (body?: any) => Promise<any>> = {
  register: (body) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body) => apiRequest("/api/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiRequest("/api/auth/me"),
  updatePreferences: (body) => apiRequest("/api/auth/preferences", { method: "PATCH", body: JSON.stringify(body) }),
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
