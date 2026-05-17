import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DrawingDashboard from "./pages/DrawingDashboard";
import CanvasEditor from "./pages/CanvasEditor";

const queryClient = new QueryClient();

function AppContent() {
  const [page, setPage] = useState("login");
  const [drawingId, setDrawingId] = useState(null);
  const { user, token, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      fetchMe();
    }
  }, [token, user, fetchMe]);

  const handleNavigate = (target, id) => {
    if (target === "editor") {
      setDrawingId(id);
      setPage("editor");
    } else {
      setDrawingId(null);
      setPage(target);
    }
  };

  if (page === "verify-email") {
    return <VerifyEmailPage />;
  }

  if (page === "editor" && user) {
    return <CanvasEditor drawingId={drawingId} onNavigate={handleNavigate} />;
  }

  if (user) {
    if (page === "dashboard" || page === "login") {
      return <DrawingDashboard onNavigate={handleNavigate} />;
    }
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
