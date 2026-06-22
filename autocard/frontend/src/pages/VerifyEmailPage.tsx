import { useState, useEffect } from "react";
import { auth } from "../api/client";
import { useThemeStore } from "../stores/themeStore";
import { Sun, Moon } from "lucide-react";

export default function VerifyEmailPage(): React.ReactElement {
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState<string>("");
  const { isDark, toggleTheme } = useThemeStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      verify(t);
    }
  }, []);

  const verify = async (t?: string) => {
    setStatus("loading");
    try {
      const data = await auth.verifyEmail({ token: t || token });
      setStatus("success");
      setMessage(data.message || "Email verified successfully!");
    } catch (err: unknown) {
      setStatus("error");
      setMessage((err as { message?: string }).message || "Verification failed");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-4 font-sans w-full">
      {/* Floating Theme Toggle in Top Right */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm focus:outline-none"
        title="Toggle Theme"
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Email Verification</h2>
        {status === "loading" && (
          <div className="text-blue-600 dark:text-blue-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
            <p>Verifying your email...</p>
          </div>
        )}
        {status === "success" && (
          <div className="text-green-600 dark:text-green-400">
            <div className="text-5xl mb-4">&#10003;</div>
            <p className="text-lg font-medium">{message}</p>
            <p className="mt-2 text-gray-600 dark:text-gray-400">You can now close this window and sign in.</p>
          </div>
        )}
        {status === "error" && (
          <div className="text-red-600 dark:text-red-400">
            <div className="text-5xl mb-4">&#10007;</div>
            <p className="text-lg font-medium">{message}</p>
          </div>
        )}
        {status === "idle" && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Enter your verification token:</p>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Paste verification token"
            />
            <button
              onClick={() => verify()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors mt-2"
            >
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
