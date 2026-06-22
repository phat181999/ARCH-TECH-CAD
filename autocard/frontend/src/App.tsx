import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppDialog from "./components/ui/AppDialog";
import { useAuthStore } from "./stores/authStore";
import { useDrawingStore } from "./stores/drawingStore";
import { useThemeStore } from "./stores/themeStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DrawingDashboard from "./pages/DrawingDashboard";
import CanvasEditor from "./pages/CanvasEditor";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";
import StoreOrderPage from "./pages/StoreOrderPage";
import AdminConsolePage from "./pages/AdminConsolePage";
import BlockStorePage from "./pages/BlockStorePage";

const queryClient = new QueryClient();

type Page = "login" | "register" | "dashboard" | "editor" | "verify-email" | "forgot-password" | "settings" | "team" | "store-orders" | "admin" | "block-store";

function GoogleCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1) || window.location.search);
    const idToken = params.get("id_token") || params.get("credential");
    const error = params.get("error");

    if (idToken) {
      window.opener?.postMessage({ type: "GOOGLE_AUTH_SUCCESS", idToken }, window.location.origin);
    } else if (error) {
      window.opener?.postMessage({ type: "GOOGLE_AUTH_FAILURE", error }, window.location.origin);
    } else {
      window.opener?.postMessage({ type: "GOOGLE_AUTH_FAILURE", error: "No token found" }, window.location.origin);
    }
    setTimeout(() => {
      window.close();
    }, 500);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col items-center justify-center font-sans">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500 mb-4" />
      <p className="text-xs font-mono tracking-widest text-cyan-400">AUTHORIZING SESSION...</p>
    </div>
  );
}

function parseHash(): { page: Page; drawingId: string | null } {
  const hash = window.location.hash;
  if (!hash) {
    return { page: "login", drawingId: null };
  }

  let cleanHash = hash.startsWith("#") ? hash.substring(1) : hash;
  if (cleanHash.startsWith("/")) {
    cleanHash = cleanHash.substring(1);
  }

  if (cleanHash.startsWith("editor/")) {
    const parts = cleanHash.split("/");
    const id = parts[1] || null;
    return { page: "editor", drawingId: id };
  }

  const validPages: Page[] = [
    "login",
    "register",
    "dashboard",
    "editor",
    "verify-email",
    "forgot-password",
    "settings",
    "team",
    "store-orders",
    "admin",
    "block-store",
  ];

  if (validPages.includes(cleanHash as Page)) {
    return { page: cleanHash as Page, drawingId: null };
  }

  return { page: "login", drawingId: null };
}

function AppContent() {
  const isDark = useThemeStore((state) => state.isDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  if (window.location.pathname === "/auth/google/callback") {
    return <GoogleCallback />;
  }

  const { user, token, fetchMe } = useAuthStore();
  const { loadPreferences } = useDrawingStore();

  const [page, setPage] = useState<Page>(() => parseHash().page);
  const [drawingId, setDrawingId] = useState<string | null>(() => parseHash().drawingId);
  const [sessionLoading, setSessionLoading] = useState(!!token && !user);

  useEffect(() => {
    if (token && !user) {
      setSessionLoading(true);
      fetchMe()
        .then((u: any) => {
          if (u?.preferences) loadPreferences(u.preferences);
        })
        .finally(() => {
          setSessionLoading(false);
        });
    } else {
      setSessionLoading(false);
    }
  }, [token, user, fetchMe, loadPreferences]);

  const handleNavigate = useCallback((target: string, id?: string) => {
    if (target === "editor") {
      setDrawingId(id || null);
      setPage("editor");
    } else {
      setDrawingId(null);
      setPage(target as Page);
    }
  }, []);

  // Sync state to URL hash
  useEffect(() => {
    let targetHash = "";
    if (page === "editor") {
      targetHash = `#/editor/${drawingId || ""}`;
    } else {
      targetHash = `#/${page}`;
    }

    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [page, drawingId]);

  // Sync hash change back to state (e.g. browser back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const { page: newPage, drawingId: newDrawingId } = parseHash();
      setPage((prevPage) => {
        if (prevPage !== newPage) return newPage;
        return prevPage;
      });
      setDrawingId((prevId) => {
        if (prevId !== newDrawingId) return newDrawingId;
        return prevId;
      });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Redirect logged-in users away from auth pages
  useEffect(() => {
    if (user && !sessionLoading) {
      if (page === "login" || page === "register" || page === "forgot-password") {
        setPage("dashboard");
      }
    }
  }, [user, page, sessionLoading]);

  // Redirect logged-out users away from protected pages
  useEffect(() => {
    if (!user && !sessionLoading) {
      const protectedPages: Page[] = ["dashboard", "editor", "settings", "team", "store-orders", "admin", "block-store"];
      if (protectedPages.includes(page)) {
        setPage("login");
      }
    }
  }, [user, page, sessionLoading]);

  // Redirect non-admins away from admin console
  useEffect(() => {
    if (user && !sessionLoading) {
      if (page === "admin" && user.system_role !== "system_admin") {
        setPage("dashboard");
      }
    }
  }, [user, page, sessionLoading]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500 mb-4" />
        <p className="text-xs font-mono tracking-widest text-cyan-400">LOADING SESSION...</p>
      </div>
    );
  }

  if (page === "verify-email") {
    return <VerifyEmailPage />;
  }

  if (page === "editor" && user) {
    return <CanvasEditor drawingId={drawingId} onNavigate={handleNavigate} />;
  }

  if (page === "settings" && user) {
    return <SettingsPage onNavigate={handleNavigate} />;
  }

  if (page === "team" && user) {
    return <TeamPage onNavigate={handleNavigate} />;
  }

  if (page === "store-orders" && user) {
    return <StoreOrderPage onNavigate={handleNavigate} />;
  }

  if (page === "admin" && user && user.system_role === "system_admin") {
    return <AdminConsolePage onNavigate={handleNavigate} />;
  }

  if (page === "block-store" && user) {
    const orgId = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("org");
    return <BlockStorePage onNavigate={handleNavigate} orgId={orgId} />;
  }

  if (user) {
    return <DrawingDashboard onNavigate={handleNavigate} />;
  }

  if (page === "register") {
    return <RegisterPage onNavigate={handleNavigate} />;
  }

  if (page === "forgot-password") {
    return <ForgotPasswordPage onNavigate={handleNavigate} />;
  }

  return <LoginPage onNavigate={handleNavigate} onLogin={() => fetchMe()} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <AppDialog />
    </QueryClientProvider>
  );
}
