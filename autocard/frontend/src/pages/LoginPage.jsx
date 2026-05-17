import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

export default function LoginPage({ onNavigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      onLogin && onLogin();
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-center text-gray-600">Sign in to AutoCard</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm" onClick={clearError}>
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <div className="text-center text-sm">
            <span className="text-gray-600">Don&apos;t have an account?</span>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("register")}
              className="ml-1 text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
