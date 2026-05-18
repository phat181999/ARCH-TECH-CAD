import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DrawingDashboard from "./pages/DrawingDashboard";
import CanvasEditor from "./pages/CanvasEditor";

const queryClient = new QueryClient();

type Page = "login" | "register" | "dashboard" | "editor" | "verify-email";

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

  if (user) {
    return <DrawingDashboard onNavigate={handleNavigate} />;
  }

  if (page === "register") {
    return <RegisterPage onNavigate={handleNavigate} />;
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
