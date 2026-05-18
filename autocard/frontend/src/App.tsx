import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DrawingDashboard from "./pages/DrawingDashboard";
import CanvasEditor from "./pages/CanvasEditor";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";

const queryClient = new QueryClient();

type Page = "login" | "register" | "dashboard" | "editor" | "verify-email" | "forgot-password" | "settings" | "team";

function AppContent() {
  const [page, setPage] = useState<Page>("login");
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const { user, token, fetchMe } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      fetchMe();
    }
  }, [token, user, fetchMe]);

  const handleNavigate = useCallback((target: string, id?: string) => {
    if (target === "editor") {
      setDrawingId(id || null);
      setPage("editor");
    } else {
      setDrawingId(null);
      setPage(target as Page);
    }
  }, []);

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
    </QueryClientProvider>
  );
}
