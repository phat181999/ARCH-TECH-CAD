import { create } from "zustand";
import { auth, members, parseJwtPayload } from "../api/client";

interface User {
  id: string;
  email: string;
  name: string;
  system_role?: string;
  avatar_url?: string;
  job_title?: string;
  phone?: string;
  provider?: string;
  role_type?: "user" | "member";
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, name: string, org?: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  loginWithGoogle: (body: { token?: string; email?: string; name?: string; is_mock?: boolean }) => Promise<any>;
  fetchMe: () => Promise<User | null>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set: any, get: any) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  loading: false,
  error: null,

  register: async (email: string, password: string, name: string, org?: string) => {
    set({ loading: true, error: null });
    try {
      const data = await members.register({ email, password, name, org });
      localStorage.setItem("token", data.token);
      set({ user: { ...data.member, role_type: data.role_type ?? "member" }, token: data.token, loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const data = await auth.login({ email, password });
      localStorage.setItem("token", data.token);
      set({ user: { ...data.user, role_type: data.role_type ?? "user" }, token: data.token, loading: false });
      return data;
    } catch (err: any) {
      // Only fall through to member login for credential errors (401/404).
      // Network failures and server errors (5xx) are surfaced immediately.
      if (err.status !== 401 && err.status !== 404) {
        set({ error: err.message, loading: false });
        throw err;
      }
      try {
        const data = await members.login({ email, password });
        localStorage.setItem("token", data.token);
        set({ user: { ...data.member, role_type: data.role_type ?? "member" }, token: data.token, loading: false });
        return data;
      } catch (memberErr: any) {
        set({ error: memberErr.message || "Invalid email or password", loading: false });
        throw memberErr;
      }
    }
  },

  loginWithGoogle: async (body: { token?: string; email?: string; name?: string; is_mock?: boolean }) => {
    set({ loading: true, error: null });
    try {
      const data = await auth.googleLogin(body);
      localStorage.setItem("token", data.token);
      // Prefer role_type from response body; fall back to safe JWT payload parse
      const roleType = data.role_type ?? parseJwtPayload(data.token)?.role_type ?? "user";
      set({ user: { ...data.user, role_type: roleType }, token: data.token, loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;

      // Prefer role_type already in Zustand state; fall back to safe JWT payload parse
      const roleType = get().user?.role_type ?? parseJwtPayload(token)?.role_type;

      let user;
      if (roleType === "member") {
        user = await members.me();
        user = { ...user, role_type: "member" };
      } else {
        user = await auth.me();
        user = { ...user, role_type: "user" };
      }

      set({ user });
      return user;
    } catch {
      localStorage.removeItem("token");
      set({ user: null, token: null });
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));
