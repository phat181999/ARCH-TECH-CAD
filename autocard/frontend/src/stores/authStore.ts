import { create } from "zustand";
import { auth } from "../api/client";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, name: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  fetchMe: () => Promise<User | null>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set: any) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  loading: false,
  error: null,

  register: async (email: string, password: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const data = await auth.register({ email, password, name });
      localStorage.setItem("token", data.token);
      set({ user: data.user, token: data.token, loading: false });
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
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  fetchMe: async () => {
    try {
      const user = await auth.me();
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
