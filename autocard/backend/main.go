package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"autocard-backend/config"
	"autocard-backend/dbutil"
	"autocard-backend/handlers"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
	"autocard-backend/services"

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

	if err := godotenv.Overload(); err != nil {
		slog.Warn("No .env file found, relying on system environment variables")
	}

	cfg := config.Load()
	slog.Info("Loaded DB config",
		"host", cfg.DBHost,
		"port", cfg.DBPort,
		"name", cfg.DBName,
		"hasDatabaseURL", cfg.DatabaseURL != "",
	)
	db, err := gorm.Open(postgres.Open(cfg.DSN()), dbutil.NewGormConfig(os.Stdout))
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}

	slog.Info("Connected to PostgreSQL via GORM")

	// Idempotent column addition for user preferences and system_role
	db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT NOT NULL DEFAULT '{}'")
	db.Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) NOT NULL DEFAULT 'user'")
	db.Exec("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS image_org TEXT NOT NULL DEFAULT ''")
	db.Exec("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''")
	db.Exec("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS bim_data TEXT NOT NULL DEFAULT ''")
	if err := db.AutoMigrate(&models.AnalysisJob{}); err != nil {
		slog.Warn("AutoMigrate AnalysisJob failed", "error", err)
	}
	if err := db.AutoMigrate(&models.ChatSession{}, &models.ChatMessage{}); err != nil {
		slog.Warn("AutoMigrate Chat models failed", "error", err)
	}
	// Index the reaper's lookup so its periodic UPDATE isn't a slow full scan.
	db.Exec("CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_updated ON analysis_jobs (status, updated_at)")
	// Indexes for queries seen as SLOW SQL in production (200-800ms on Render free-tier).
	db.Exec("CREATE INDEX IF NOT EXISTS idx_drawings_user_id ON drawings (user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_drawings_updated_at ON drawings (updated_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_permissions_drawing_id ON permissions (drawing_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions (user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_comments_drawing_id ON comments (drawing_id, created_at)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_version_history_drawing_id ON version_history (drawing_id, version DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id, updated_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id, created_at)")
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

	chatRepo := repository.NewChatRepo(db)
	ragRepo := repository.NewRAGRepo(db)
	authHandler := handlers.NewAuthHandler(userRepo, memberRepo, orgRepo, cfg)
	memberHandler := handlers.NewMemberHandler(memberRepo, orgRepo, cfg)
	drawingHandler := handlers.NewDrawingHandler(drawingRepo)
	aiHandler := handlers.NewAIHandler(cfg, chatRepo, ragRepo)
	orgHandler := handlers.NewOrganizationHandler(orgRepo)
	adminHandler := handlers.NewAdminHandler(orgRepo, cfg)

	ragHandler := handlers.NewRAGHandler(ragRepo, userRepo, orgRepo, cfg, rdb)

	blockRepo := repository.NewBlockRepo(db)
	blockHandler := handlers.NewBlockHandler(blockRepo)

	materialRepo := repository.NewMaterialRepo(db)
	materialHandler := handlers.NewMaterialHandler(materialRepo)

	chatHandler := handlers.NewChatHandler(chatRepo, cfg)
	cadHandler := handlers.NewCADHandler()

	drawingTaskRepo := repository.NewDrawingTaskRepo(db)
	taskSuggester := services.NewTaskSuggester(cfg.AnthropicAPIKey)
	drawingTaskHandler := handlers.NewDrawingTaskHandler(drawingTaskRepo, taskSuggester, drawingRepo)

	analysisJobRepo := repository.NewAnalysisJobRepo(db)
	analyzer := services.NewDrawingAnalyzer(cfg.AnthropicAPIKey)
	worker := services.NewJobWorker(rdb, analysisJobRepo, drawingRepo, analyzer)
	worker.Start(context.Background(), 2)
	analysisHandler := handlers.NewAnalysisHandler(analysisJobRepo, drawingRepo, rdb)
	collaborationHandler := handlers.NewCollaborationHandler(drawingRepo, userRepo, memberRepo, cfg.JWTSecret)

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

	// Block Store routes (My Files + Org Store)
	protected.HandleFunc("GET /api/my-blocks", blockHandler.ListMyBlocks)
	protected.HandleFunc("POST /api/my-blocks", blockHandler.CreateMyBlock)
	protected.HandleFunc("DELETE /api/my-blocks/{id}", blockHandler.DeleteMyBlock)
	protected.HandleFunc("GET /api/organizations/{id}/blocks", blockHandler.ListOrgBlocks)
	protected.HandleFunc("POST /api/organizations/{id}/blocks", blockHandler.CreateOrgBlock)
	protected.HandleFunc("PUT /api/organizations/{id}/blocks/{blockId}/publish", blockHandler.PublishOrgBlock)
	protected.HandleFunc("DELETE /api/organizations/{id}/blocks/{blockId}", blockHandler.DeleteOrgBlock)

	// Material routes
	protected.HandleFunc("GET /api/materials", materialHandler.List)
	protected.HandleFunc("POST /api/materials", materialHandler.Create)
	protected.HandleFunc("PUT /api/materials/{id}", materialHandler.Update)
	protected.HandleFunc("DELETE /api/materials/{id}", materialHandler.Delete)
	protected.HandleFunc("GET /api/material-presets", materialHandler.GetPresets)

	// Drawing task routes
	protected.HandleFunc("GET /api/drawings/{id}/tasks", drawingTaskHandler.List)
	protected.HandleFunc("POST /api/drawings/{id}/tasks", drawingTaskHandler.Create)
	protected.HandleFunc("PUT /api/drawings/{id}/tasks/{taskId}", drawingTaskHandler.Update)
	protected.HandleFunc("DELETE /api/drawings/{id}/tasks/{taskId}", drawingTaskHandler.Delete)
	protected.HandleFunc("POST /api/drawings/{id}/tasks/bulk", drawingTaskHandler.BulkCreate)
	protected.HandleFunc("POST /api/drawings/{id}/tasks/ai-suggest", drawingTaskHandler.SuggestTasks)

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

	// Analysis routes (2D → BIM JSON)
	protected.HandleFunc("POST /api/drawings/{id}/analyze", analysisHandler.Submit)
	protected.HandleFunc("GET /api/drawings/{id}/analysis/status", analysisHandler.Status)
	protected.HandleFunc("GET /api/drawings/{id}/analysis", analysisHandler.GetResult)

	// AI routes (key lives only in server env)
	protected.HandleFunc("POST /api/ai/generate", aiHandler.Generate)
	protected.HandleFunc("POST /api/ai/interact", aiHandler.Interact)
	protected.HandleFunc("POST /api/ai/smart-dimensions", aiHandler.SmartDimensions)

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
	protected.HandleFunc("POST /api/rag/compliance", ragHandler.CheckCompliance)
	protected.HandleFunc("POST /api/rag/upload-cad", ragHandler.UploadCADFile)

	// CAD file conversion (DWG/DWF → DXF)
	protected.HandleFunc("POST /api/convert/cad", cadHandler.Convert)

	// Chat session routes (SSE streaming)
	protected.HandleFunc("GET /api/chat/sessions", chatHandler.ListSessions)
	protected.HandleFunc("POST /api/chat/sessions", chatHandler.CreateSession)
	protected.HandleFunc("GET /api/chat/sessions/{id}/messages", chatHandler.GetMessages)
	protected.HandleFunc("POST /api/chat/sessions/{id}/messages", chatHandler.SendMessage)
	protected.HandleFunc("DELETE /api/chat/sessions/{id}", chatHandler.DeleteSession)

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
	mux.Handle("/api/chat/", authMiddleware(protected))
	mux.Handle("/api/my-blocks", authMiddleware(protected))
	mux.Handle("/api/my-blocks/", authMiddleware(protected))
	mux.Handle("/api/material-presets", authMiddleware(protected))
	mux.Handle("/api/convert/", authMiddleware(protected))

	// WebSocket route
	mux.HandleFunc("GET /ws/collaborate", collaborationHandler.HandleWebSocket)

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
