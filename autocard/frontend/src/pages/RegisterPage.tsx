import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import {
  Compass,
  User,
  Mail,
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Code,
  Globe
} from "lucide-react";

interface RegisterPageProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [org, setOrg] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const { register, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, password, name, org);
      // User is now logged in — parent will re-render due to store state change
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0a0a0a] font-sans selection:bg-[#66C6DF] selection:text-white dark:selection:text-[#0E1015] transition-colors duration-300">
      
      {/* LEFT PANEL - ABSTRACT GRID/LASER BACKGROUND */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-8 lg:p-10 overflow-hidden border-r border-gray-200 dark:border-white/5 transition-colors duration-300">
        {/* CSS Abstract Grid Background */}
        <div className="absolute inset-0 bg-slate-50 dark:bg-[#060D13] transition-colors duration-300">
          <div 
            className="absolute inset-0 opacity-10 dark:opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, #66C6DF 1px, transparent 1px), linear-gradient(to bottom, #66C6DF 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
              transform: 'perspective(1000px) rotateX(60deg) scale(2.5) translateY(-20%)',
              transformOrigin: 'top center'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 dark:from-[#060D13] via-transparent to-slate-50 dark:to-[#060D13] transition-colors duration-300" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-50 dark:from-[#060D13] via-transparent to-slate-50 dark:to-[#060D13] transition-colors duration-300" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-[#66C6DF]/20 dark:bg-[#66C6DF]/30 shadow-[0_0_20px_#66C6DF]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#f8fafc_80%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,#060D13_80%)] transition-colors duration-300" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2 bg-[#66C6DF]/10 rounded-lg">
            <Compass className="w-6 h-6 text-[#66C6DF]" />
          </div>
          <span className="text-xl font-black tracking-widest text-[#66C6DF]">ARCH-TECH CAD</span>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 max-w-lg mt-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#66C6DF] animate-pulse" />
            <span className="text-[#66C6DF] text-xs font-mono uppercase tracking-widest">System Status: Optimal</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight transition-colors duration-300">
            The ultimate workspace for industrial-grade precision.
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400 text-base leading-relaxed transition-colors duration-300">
            Seamlessly bridge the gap between conceptual drafting and high-fidelity 3D modeling with our cloud-native engine.
          </p>
        </div>

        {/* Bottom Status Indicators */}
        <div className="relative z-10 flex flex-wrap gap-8 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            System_Stable
          </span>
          <span>Latency: 14ms</span>
          <span>Data_Encryption: AES-256</span>
        </div>
      </div>

      {/* RIGHT PANEL - FORM */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-10 bg-white dark:bg-[#101216] transition-colors duration-300">
        {/* Giant Watermark */}
        <div className="absolute bottom-10 right-10 text-[140px] font-black text-black/[0.03] dark:text-white/[0.02] pointer-events-none select-none leading-none tracking-tighter transition-colors duration-300">
          CAD
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors duration-300">Join the Workstation</h2>
            <p className="mt-1.5 text-gray-500 dark:text-gray-400 text-sm transition-colors duration-300">Establish your engineering presence.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm flex items-center cursor-pointer hover:bg-red-500/20 transition-colors" onClick={clearError}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mr-3" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest block transition-colors duration-300">
                Full Name
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-[#66C6DF] transition-colors" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#66C6DF] focus:ring-1 focus:ring-[#66C6DF] transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  placeholder="e.g. Elena Rodriguez"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest block transition-colors duration-300">
                Work Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-[#66C6DF] transition-colors" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#66C6DF] focus:ring-1 focus:ring-[#66C6DF] transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  placeholder="name@organization.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="org" className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest block transition-colors duration-300">
                Organization Name
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-[#66C6DF] transition-colors" />
                </div>
                <input
                  id="org"
                  type="text"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="block w-full bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#66C6DF] focus:ring-1 focus:ring-[#66C6DF] transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                  placeholder="Engineering Solutions Ltd."
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase tracking-wider mt-1.5 transition-colors duration-300">
                Required for team workspace allocation.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest block transition-colors duration-300">
                Security Credentials
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-[#66C6DF] transition-colors" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="block w-full bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white text-sm rounded-xl pl-11 pr-11 py-3 focus:outline-none focus:border-[#66C6DF] focus:ring-1 focus:ring-[#66C6DF] transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600 font-mono tracking-widest"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              <div className="mt-3">
                <div className="flex gap-1.5">
                  <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${password.length > 0 ? 'bg-[#66C6DF]' : 'bg-gray-200 dark:bg-gray-800'}`} />
                  <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${password.length >= 8 ? 'bg-[#66C6DF]' : 'bg-gray-200 dark:bg-gray-800'}`} />
                  <div className={`h-1 flex-1 rounded-full transition-colors duration-300 ${password.length >= 12 ? 'bg-[#66C6DF]' : 'bg-gray-200 dark:bg-gray-800'}`} />
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-mono uppercase tracking-wider">
                  <span className={password.length >= 8 ? 'text-[#66C6DF]' : 'text-gray-500'}>
                    Strength: {password.length >= 12 ? 'High' : password.length >= 8 ? 'Moderate' : 'Low'}
                  </span>
                  <span className="text-gray-500">Min 12 Chars</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-white dark:text-[#0E1015] text-sm font-bold bg-slate-900 dark:bg-[#66C6DF] hover:bg-slate-800 dark:hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(15,23,42,0.2)] dark:hover:shadow-[0_0_20px_rgba(102,198,223,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#101216] focus:ring-slate-900 dark:focus:ring-[#66C6DF] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 mt-6"
            >
              {loading ? "INITIALIZING..." : "INITIALIZE ACCOUNT"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800 transition-colors duration-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-white dark:bg-[#101216] text-[10px] font-mono text-gray-500 uppercase tracking-widest transition-colors duration-300">
                  Or Continue With
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
              >
                <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 dark:bg-[#181A20] border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
              >
                <Code className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                GitHub
              </button>
            </div>

            <div className="text-center mt-6">
              <span className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">Already have an account? </span>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("login")}
                className="text-sm font-semibold text-[#66C6DF] hover:text-cyan-300 transition-colors focus:outline-none"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>

        {/* Footer info right panel */}
        <div className="absolute bottom-8 left-8 right-8 hidden sm:flex justify-between text-[9px] font-mono text-gray-400 dark:text-gray-600 uppercase tracking-widest transition-colors duration-300">
          <span>Region: North_America</span>
          <span>Secure: TLS_1.3</span>
          <span>V2.4.0_Stable</span>
        </div>
      </div>
    </div>
  );
}
