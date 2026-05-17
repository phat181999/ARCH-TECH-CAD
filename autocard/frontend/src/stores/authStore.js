import { create } from "zustand";
import { auth } from "../api/client";

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  loading: false,
  error: null,

  register: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const data = await auth.register({ email, password, name });
      localStorage.setItem("token", data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await auth.login({ email, password });
      localStorage.setItem("token", data.token);
      set({ user: data.user, token: data.token, loading: false });
      return data;
    } catch (err) {
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
