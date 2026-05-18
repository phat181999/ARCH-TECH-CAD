const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:56396";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const auth = {
  register: (body) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body) => apiRequest("/api/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),
  me: () => apiRequest("/api/auth/me"),
};

export const drawings = {
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
};
