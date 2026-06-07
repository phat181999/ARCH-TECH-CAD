package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"autocard-backend/config"
	"autocard-backend/dbutil"
	"autocard-backend/handlers"
	"autocard-backend/middleware"
	"autocard-backend/repository"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Setup structured JSON logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	if err := godotenv.Load(); err != nil {
		slog.Warn("No .env file found, relying on system environment variables")
	}

	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DSN()), dbutil.NewGormConfig(os.Stdout))
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}

	slog.Info("Connected to PostgreSQL via GORM")

	// Idempotent column addition for user preferences and system_role
	db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT NOT NULL DEFAULT '{}'")
	db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) NOT NULL DEFAULT 'user'")
	db.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS image_org TEXT NOT NULL DEFAULT ''")
	db.Exec("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''")
	slog.Info("Schema migration checked")

	// Initialize Redis
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr(),
	})
	// Ping Redis to verify connection
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
	} else {
		slog.Info("Connected to Redis successfully")
	}

	userRepo := repository.NewUserRepo(db)
	memberRepo := repository.NewMemberRepo(db)
	drawingRepo := repository.NewDrawingRepo(db)
	orgRepo := repository.NewOrganizationRepo(db, rdb)

	authHandler := handlers.NewAuthHandler(userRepo, memberRepo, orgRepo, cfg)
	memberHandler := handlers.NewMemberHandler(memberRepo, orgRepo, cfg)
	drawingHandler := handlers.NewDrawingHandler(drawingRepo)
	aiHandler := handlers.NewAIHandler(cfg)
	orgHandler := handlers.NewOrganizationHandler(orgRepo)
	adminHandler := handlers.NewAdminHandler(orgRepo, cfg)

	ragRepo := repository.NewRAGRepo(db)
	ragHandler := handlers.NewRAGHandler(ragRepo, userRepo, orgRepo, cfg, rdb)

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("POST /api/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/auth/verify-email", authHandler.VerifyEmail)
	mux.HandleFunc("POST /api/auth/google", authHandler.GoogleLogin)
	mux.HandleFunc("POST /api/members/register", memberHandler.Register)
	mux.HandleFunc("POST /api/members/login", memberHandler.Login)

	// Protected routes
	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/auth/me", authHandler.Me)
	protected.HandleFunc("GET /api/members/me", memberHandler.Me)
	protected.HandleFunc("PUT /api/members/me", memberHandler.UpdateProfile)
	protected.HandleFunc("PATCH /api/auth/preferences", authHandler.UpdatePreferences)
	protected.HandleFunc("GET /api/drawings", drawingHandler.List)
	protected.HandleFunc("POST /api/drawings", drawingHandler.Create)
	protected.HandleFunc("GET /api/drawings/{id}", drawingHandler.Get)
	protected.HandleFunc("PUT /api/drawings/{id}", drawingHandler.Update)
	protected.HandleFunc("DELETE /api/drawings/{id}", drawingHandler.Delete)
	protected.HandleFunc("PUT /api/drawings/{id}/rename", drawingHandler.Rename)
	protected.HandleFunc("POST /api/drawings/{id}/avatar", drawingHandler.UploadAvatar)

	// Organization routes
	protected.HandleFunc("POST /api/organizations", orgHandler.Create)
	protected.HandleFunc("GET /api/organizations", orgHandler.List)

	// Organization specific role-secured routes
	orgViewerMiddleware := middleware.RequireOrgRole(userRepo, orgRepo, "viewer")
	orgOwnerMiddleware := middleware.RequireOrgRole(userRepo, orgRepo, "owner")

	protected.Handle("GET /api/organizations/{id}/members", orgViewerMiddleware(http.HandlerFunc(orgHandler.GetMembers)))
	protected.Handle("POST /api/organizations/{id}/invitations", orgOwnerMiddleware(http.HandlerFunc(orgHandler.Invite)))
	protected.Handle("DELETE /api/organizations/{id}/members/{userId}", orgOwnerMiddleware(http.HandlerFunc(orgHandler.RemoveMember)))
	protected.Handle("DELETE /api/organizations/{id}/invitations", orgOwnerMiddleware(http.HandlerFunc(orgHandler.RemoveInvitation)))
	protected.Handle("PUT /api/organizations/{id}/members/{userId}", orgOwnerMiddleware(http.HandlerFunc(orgHandler.UpdateMemberRole)))
	protected.Handle("PUT /api/organizations/{id}", orgOwnerMiddleware(http.HandlerFunc(orgHandler.Update)))
	protected.Handle("POST /api/organizations/{id}/logo", orgOwnerMiddleware(http.HandlerFunc(orgHandler.UploadLogo)))

	// System Admin routes
	sysAdminMiddleware := middleware.RequireSystemAdmin(userRepo)
	protected.Handle("GET /api/admin/organizations", sysAdminMiddleware(http.HandlerFunc(adminHandler.ListOrganizations)))
	protected.Handle("PUT /api/admin/organizations/{id}/subscription", sysAdminMiddleware(http.HandlerFunc(adminHandler.UpdateSubscription)))
	protected.Handle("DELETE /api/admin/organizations/{id}", sysAdminMiddleware(http.HandlerFunc(adminHandler.DeleteOrganization)))
	protected.Handle("GET /api/admin/users", sysAdminMiddleware(http.HandlerFunc(adminHandler.ListUsers)))
	protected.Handle("PUT /api/admin/users/{id}/system-role", sysAdminMiddleware(http.HandlerFunc(adminHandler.UpdateSystemRole)))

	// System Admin Packages CRUD and Assign endpoints
	protected.Handle("GET /api/admin/packages", sysAdminMiddleware(http.HandlerFunc(adminHandler.ListPackages)))
	protected.Handle("POST /api/admin/packages", sysAdminMiddleware(http.HandlerFunc(adminHandler.CreatePackage)))
	protected.Handle("PUT /api/admin/packages/{id}", sysAdminMiddleware(http.HandlerFunc(adminHandler.UpdatePackage)))
	protected.Handle("DELETE /api/admin/packages/{id}", sysAdminMiddleware(http.HandlerFunc(adminHandler.DeletePackage)))
	protected.Handle("PUT /api/admin/organizations/{id}/package", sysAdminMiddleware(http.HandlerFunc(adminHandler.AssignPackage)))

	// Version history routes
	protected.HandleFunc("GET /api/drawings/{id}/versions", drawingHandler.GetVersions)
	protected.HandleFunc("GET /api/drawings/{id}/versions/{version}", drawingHandler.GetVersion)

	// Comment routes
	protected.HandleFunc("GET /api/drawings/{id}/comments", drawingHandler.GetComments)
	protected.HandleFunc("POST /api/drawings/{id}/comments", drawingHandler.CreateComment)

	// Permission routes
	protected.HandleFunc("POST /api/drawings/{id}/share", drawingHandler.Share)
	protected.HandleFunc("GET /api/drawings/{id}/permissions", drawingHandler.GetPermissions)
	protected.HandleFunc("DELETE /api/drawings/{id}/permissions/{userId}", drawingHandler.RemovePermission)

	// AI routes (key lives only in server env)
	protected.HandleFunc("POST /api/ai/generate", aiHandler.Generate)

	// RAG routes
	protected.HandleFunc("POST /api/rag/query", ragHandler.RAGQuery)
	protected.HandleFunc("POST /api/rag/knowledge-chunks", ragHandler.UpsertKnowledgeChunk)
	protected.HandleFunc("POST /api/rag/components", ragHandler.UpsertCADComponent)
	protected.HandleFunc("POST /api/rag/building-rules", ragHandler.UpsertBuildingRule)
	protected.HandleFunc("POST /api/rag/projects", ragHandler.SaveProject)
	protected.HandleFunc("POST /api/rag/projects/{id}/edits", ragHandler.RecordEdits)
	protected.HandleFunc("POST /api/rag/projects/{id}/export", ragHandler.MarkExport)
	protected.HandleFunc("POST /api/rag/golden", ragHandler.PromoteToGolden)
	protected.HandleFunc("GET /api/rag/components/search", ragHandler.SearchComponents)
	protected.HandleFunc("GET /api/rag/compliance", ragHandler.CheckCompliance)

	authMiddleware := middleware.Auth(cfg.JWTSecret)
	mux.Handle("/api/auth/me", authMiddleware(protected))
	mux.Handle("/api/auth/preferences", authMiddleware(protected))
	mux.Handle("/api/members/me", authMiddleware(protected))
	mux.Handle("/api/drawings", authMiddleware(protected))
	mux.Handle("/api/drawings/", authMiddleware(protected))
	mux.Handle("/api/organizations", authMiddleware(protected))
	mux.Handle("/api/organizations/", authMiddleware(protected))
	mux.Handle("/api/admin/", authMiddleware(protected))
	mux.Handle("/api/ai/", authMiddleware(protected))
	mux.Handle("/api/rag/", authMiddleware(protected))

	// WebSocket route
	mux.HandleFunc("GET /ws/collaborate", handlers.HandleWebSocket)

	// Serve static uploads
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Apply Middlewares (CORS -> Logger)
	handler := middleware.CORS(mux)
	handler = middleware.Logger(handler)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	slog.Info("Server starting", "address", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("Server failed", "error", err)
		os.Exit(1)
	}
}
