import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

interface LoginPageProps {
  onNavigate: (target: string, id?: string) => void;
  onLogin: () => void;
}

export default function LoginPage({ onNavigate, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const { login, loginWithGoogle, loading, error, clearError } = useAuthStore();

  // Sandbox modal state
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
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/google/callback`);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20profile%20email&nonce=autocardnonce`;
      
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        authUrl,
        "Google Sign-In",
        `width=${width},height=${height},top=${top},left=${left}`
      );
      
      const handleMessage = async (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type === "GOOGLE_AUTH_SUCCESS") {
          window.removeEventListener("message", handleMessage);
          const idToken = e.data.idToken;
          try {
            await loginWithGoogle({ token: idToken });
            onLogin && onLogin();
          } catch (err: any) {
            console.error("Google Login failed", err);
          }
        } else if (e.data?.type === "GOOGLE_AUTH_FAILURE") {
          window.removeEventListener("message", handleMessage);
        }
      };
      
      window.addEventListener("message", handleMessage);
    } else {
      setShowSandbox(true);
    }
  };

  const handleSandboxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxEmail.trim()) {
      setSandboxError("Email is required");
      return;
    }
    setSandboxLoading(true);
    setSandboxError(null);
    try {
      await loginWithGoogle({
        email: sandboxEmail.trim(),
        name: sandboxName.trim() || "Google Sandbox User",
        is_mock: true
      });
      setShowSandbox(false);
      onLogin && onLogin();
    } catch (err: any) {
      setSandboxError(err.message || "Failed to simulate sign-in");
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0E14] text-gray-100 font-sans selection:bg-[#38BDF8] selection:text-black">
      
      {/* Left Column - Graphic/Info */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 border-r border-slate-200 dark:border-[#1E293B]">
        <div className="flex-1 flex items-center justify-center relative">
          {/* Wireframe Container with glowing border effect */}
          <div className="relative group w-full max-w-2xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-xl blur-lg opacity-50 transition duration-1000 group-hover:opacity-75"></div>
            <img 
              src="/cad-wireframe.png" 
              alt="CAD Wireframe" 
              className="relative rounded-xl border border-slate-200 dark:border-[#1E293B] shadow-2xl shadow-cyan-900/20 object-cover w-full aspect-square bg-slate-50 dark:bg-[#0B0E14]"
            />
          </div>
        </div>

        <div className="mt-8 space-y-4 max-w-xl">
          <h1 className="text-2xl font-bold tracking-wider text-slate-900 dark:text-white uppercase">ARCH-TECH CAD</h1>
          <p className="text-slate-500 dark:text-[#94A3B8] leading-relaxed text-sm">
            Precision engineering for the next generation of industrial design.<br/>
            Access your workspaces, assets, and team collaboration tools.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs font-mono text-cyan-500/80 mt-6 bg-white dark:bg-[#151B23] w-fit p-3 px-4 rounded-lg border border-slate-200 dark:border-[#1E293B]">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-gray-500 mr-2">SYSTEM_STATUS:</span>
              NORMAL
            </div>
            <div>
              <span className="text-gray-500 mr-2">COORDS:</span>
              X:44.2 Y:12.8 Z:0.0
            </div>
            <div>
              <span className="text-gray-500 mr-2">UPTIME:</span>
              99.98%
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 relative bg-slate-50 dark:bg-[#0B0E14]">
        {/* Top Right Badge */}
        <div className="absolute top-8 right-8 flex items-center gap-2 bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] px-3 py-1.5 rounded-full text-[10px] font-mono tracking-wider text-cyan-400/90 shadow-sm">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          AES-256 ENCRYPTED
        </div>

        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Sign In</h2>
            <p className="mt-2 text-slate-500 dark:text-[#94A3B8] text-sm">Enter your credentials to access the workstation.</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm flex items-center justify-between cursor-pointer" onClick={clearError}>
                <span>{error}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            
            <div className="bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl p-6 md:p-8 shadow-xl space-y-5">
              <div>
                <label htmlFor="email" className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-md text-sm text-slate-800 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    placeholder="engineer@arch-tech.io"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">Password</label>
                  <button 
                    type="button"
                    onClick={() => onNavigate && onNavigate("forgot-password")}
                    className="text-[10px] font-bold text-cyan-500 hover:text-cyan-400 uppercase tracking-wider transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-md text-sm text-slate-800 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors tracking-[0.2em]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 rounded-md text-[11px] font-bold tracking-[0.15em] text-[#0B0E14] bg-[#38BDF8] hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-[#151B23] disabled:opacity-50 disabled:cursor-not-allowed uppercase transition-colors"
                >
                  {loading ? "Initializing..." : "Initialize Session"}
                </button>
              </div>
              
              <div className="relative pt-6 pb-2">
                <div className="absolute inset-0 flex items-center pt-4">
                  <div className="w-full border-t border-slate-200 dark:border-[#1E293B]"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.15em]">
                  <span className="px-3 bg-white dark:bg-[#151B23] text-slate-400 dark:text-[#475569]">OAUTH GATEWAYS</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="flex justify-center items-center py-2 px-4 border border-slate-200 dark:border-[#1E293B] rounded-md bg-slate-50 dark:bg-[#0B0E14] hover:bg-slate-200 dark:hover:bg-[#1E293B] dark:bg-[#1E293B]/50 transition-colors group"
                >
                  <svg className="w-4 h-4 mr-2 text-gray-400 group-hover:text-slate-800 dark:text-gray-200 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                  </svg>
                  <span className="text-xs font-medium text-gray-400 group-hover:text-slate-800 dark:text-gray-200 transition-colors">Google</span>
                </button>
                <button type="button" className="flex justify-center items-center py-2 px-4 border border-slate-200 dark:border-[#1E293B] rounded-md bg-slate-50 dark:bg-[#0B0E14] hover:bg-slate-200 dark:hover:bg-slate-200 dark:hover:bg-slate-200 dark:bg-[#1E293B]/50 transition-colors group">
                  <svg className="w-4 h-4 mr-2 text-gray-400 group-hover:text-slate-800 dark:text-gray-200 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-400 group-hover:text-slate-800 dark:text-gray-200 transition-colors">GitHub</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center space-y-6 pt-2">
              <div className="text-[11px]">
                <span className="text-slate-500 dark:text-[#94A3B8]">New operator?</span>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate("register")}
                  className="ml-2 text-cyan-500 hover:text-cyan-400 font-semibold"
                >
                  Create Account
                </button>
              </div>
              
              <div className="text-[9px] font-mono tracking-widest text-slate-400 dark:text-[#475569] flex items-center justify-center w-full">
                REGION: NORTH_AMERICA - SECURE: TLS_1.3
              </div>
            </div>
          </form>
        </div>
      </div>

      {showSandbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-slate-800 dark:text-white uppercase flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-500 rounded-sm animate-pulse" />
                Google Sandbox Mode
              </h3>
              <button 
                onClick={() => { setShowSandbox(false); setSandboxError(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSandboxSubmit} className="p-4 space-y-4">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                [SYSTEM_INFO]: VITE_GOOGLE_CLIENT_ID is not configured in .env. Simulating a mock Google Identity response.
              </p>

              {sandboxError && (
                <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 p-2 rounded font-mono">
                  ERROR: {sandboxError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={sandboxEmail}
                  onChange={(e) => setSandboxEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={sandboxName}
                  onChange={(e) => setSandboxName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-lg text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={sandboxLoading}
                  className="w-full flex justify-center py-2 px-4 rounded-md text-[10px] font-bold tracking-widest text-[#0B0E14] bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 uppercase transition-colors"
                >
                  {sandboxLoading ? "AUTHORIZING..." : "SIMULATE GOOGLE SIGN-IN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
