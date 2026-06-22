import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useThemeStore } from "../stores/themeStore";
import { Mail, Lock, CheckCircle2, Sun, Moon } from "lucide-react";

interface LoginPageProps {
  onNavigate: (target: string, id?: string) => void;
  onLogin: () => void;
}

export default function LoginPage({ onNavigate, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const { login, loginWithGoogle, loading, error, clearError } = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);
  const { isDark, toggleTheme } = useThemeStore();

  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxEmail, setSandboxEmail] = useState("");
  const [sandboxName, setSandboxName] = useState("");
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      onLogin && onLogin();
    } catch {
      // error is set in store
    }
  };

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId) {
      setGoogleLoading(true);
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20profile%20email&nonce=autocardnonce`;
      const width = 500, height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(authUrl, "Google Sign-In", `width=${width},height=${height},top=${top},left=${left}`);

      const popupCheckInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(popupCheckInterval);
          setGoogleLoading(false);
        }
      }, 1000);

      const handleMessage = async (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === "GOOGLE_AUTH_SUCCESS") {
          window.removeEventListener("message", handleMessage);
          clearInterval(popupCheckInterval);
          try {
            await loginWithGoogle({ token: e.data.idToken });
            onLogin && onLogin();
          } catch (err: any) {
            console.error("Google Login failed", err);
          } finally {
            setGoogleLoading(false);
          }
        } else if (e.data?.type === "GOOGLE_AUTH_FAILURE") {
          window.removeEventListener("message", handleMessage);
          clearInterval(popupCheckInterval);
          setGoogleLoading(false);
        }
      };
      window.addEventListener("message", handleMessage);
    } else {
      setShowSandbox(true);
    }
  };

  const handleSandboxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxEmail.trim()) { setSandboxError("Email is required"); return; }
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      await loginWithGoogle({ email: sandboxEmail.trim(), name: sandboxName.trim() || "Google Sandbox User", is_mock: true });
      setShowSandbox(false);
      onLogin && onLogin();
    } catch (err: any) {
      setSandboxError(err.message || "Failed to simulate sign-in");
    } finally {
      setSandboxLoading(false);
    }
  };

  const features = [
    "2D & 3D architectural drawings",
    "Real-time team collaboration",
    "AI-assisted floor plan generation",
    "DXF / DWG import & export",
  ];

  return (
    <div className="relative min-h-screen flex bg-white dark:bg-slate-950 font-sans w-full">
      {/* Floating Theme Toggle in Top Right */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm focus:outline-none"
        title="Toggle Theme"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-16 -right-16 w-96 h-96 rounded-full bg-white/20" />
          <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full bg-white/10" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">AutoCard</span>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Design smarter,<br />build faster.
          </h1>
          <p className="text-blue-100 text-sm leading-relaxed mb-8">
            The professional CAD workspace for architects and engineers. Everything you need in one place.
          </p>
          <ul className="space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-blue-100 text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-300 text-xs">
          © 2026 AutoCard. Professional CAD platform.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">AutoCard</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign in</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">Welcome back. Enter your credentials to continue.</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center justify-between mb-6 cursor-pointer" onClick={clearError}>
              <span>{error}</span>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          )}

          {/* OAuth buttons */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(loading || googleLoading) ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-transparent mr-1" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                </svg>
              )}
              {(loading || googleLoading) ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-white dark:bg-slate-950 text-slate-400">or continue with email</span></div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate("forgot-password")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("register")}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 transition-colors"
            >
              Create account
            </button>
          </p>
        </div>
      </div>

      {/* Google sandbox modal */}
      {showSandbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Google Sandbox
              </h3>
              <button
                onClick={() => { setShowSandbox(false); setSandboxError(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSandboxSubmit} className="p-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                VITE_GOOGLE_CLIENT_ID is not configured. Simulating a mock Google sign-in.
              </p>
              {sandboxError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 p-2 rounded-lg">
                  {sandboxError}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={sandboxEmail}
                  onChange={(e) => setSandboxEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={sandboxName}
                  onChange={(e) => setSandboxName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={sandboxLoading}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {sandboxLoading ? "Signing in..." : "Simulate Google Sign-In"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
