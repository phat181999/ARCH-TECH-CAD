import { useState } from "react";

interface ForgotPasswordPageProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0E14] text-gray-100 font-sans selection:bg-[#38BDF8] selection:text-black">
      
      {/* Left Column - Graphic/Info */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-12 border-r border-slate-200 dark:border-[#1E293B]">
        {/* Top Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-6 h-6 bg-[#38BDF8] flex items-center justify-center text-black font-bold text-xs rounded-sm">
            A
          </div>
          <span className="font-bold tracking-wider text-slate-900 dark:text-white uppercase text-sm">ARCH-TECH CAD</span>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <img 
            src="/cad-wireframe.png" 
            alt="CAD Wireframe" 
            className="w-full h-full object-cover object-center grayscale contrast-150 mix-blend-screen"
          />
        </div>

        <div className="mt-auto max-w-xl z-10 relative">
          <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-500/90 mb-4 bg-white dark:bg-[#151B23] w-fit p-1.5 px-3 rounded border border-slate-200 dark:border-[#1E293B]">
            <span className="text-gray-500">SYSTEM_STATUS:</span>
            <span className="text-slate-900 dark:text-white">SECURE_RECOVERY_MODE</span>
          </div>
          
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">
            Precision engineering requires uninterrupted access.
          </h2>
          
          <p className="text-slate-500 dark:text-[#94A3B8] leading-relaxed text-sm max-w-md">
            Recover your credentials through our encrypted authentication gateway to resume your industrial modeling workflow.
          </p>
        </div>

        <div className="absolute bottom-6 left-12 text-[9px] font-mono tracking-widest text-slate-400 dark:text-[#475569] uppercase">
          © 2026 ARCH-TECH SYSTEMS. INDUSTRIAL GRADE PRECISION.
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 relative bg-[#12161F]">
        
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Reset Password</h2>
            <p className="mt-3 text-slate-500 dark:text-[#94A3B8] text-sm">
              Enter your email address to receive recovery instructions.
            </p>
          </div>

          {success ? (
            <div className="bg-white dark:bg-[#151B23] border border-cyan-500/30 rounded-xl p-8 shadow-xl text-center space-y-4">
               <svg className="w-12 h-12 text-cyan-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">Recovery Link Sent</h3>
              <p className="text-sm text-slate-500 dark:text-[#94A3B8]">
                Please check your inbox at <span className="text-slate-900 dark:text-white font-medium">{email}</span> for instructions to reset your password.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => onNavigate("login")}
                  className="text-sm font-bold text-cyan-500 hover:text-cyan-400 transition-colors flex items-center justify-center w-full gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Return to Sign In
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-[10px] font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider mb-2">
                  Email Address
                </label>
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
                    className="block w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-[#1E293B] rounded-md text-sm text-slate-800 dark:text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    placeholder="engineer@firm.tech"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-md text-xs font-bold text-[#0B0E14] bg-[#38BDF8] hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-[#12161F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Processing..." : "Send Recovery Link"}
                  {!loading && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => onNavigate("login")}
                  className="w-full flex justify-center items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:text-white transition-colors uppercase tracking-wider"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Right Corner Text */}
        <div className="absolute bottom-8 right-8 text-right space-y-1 text-[8px] font-mono tracking-widest text-slate-400 dark:text-[#475569] uppercase">
          <div>ENCRYPTION: AES_256_GCM</div>
          <div>GATEWAY: PRX_RECOVERY_94</div>
          <div>COORDS: 40.7128° N, -74.0060° W</div>
          <div className="pt-2 space-x-4 flex justify-end text-slate-500 dark:text-[#94A3B8]">
            <a href="#" className="hover:text-slate-900 dark:text-white transition-colors">TERMS</a>
            <a href="#" className="hover:text-slate-900 dark:text-white transition-colors">PRIVACY</a>
            <a href="#" className="hover:text-slate-900 dark:text-white transition-colors">SECURITY</a>
          </div>
        </div>
      </div>
    </div>
  );
}
