package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"autocard-backend/config"
	"autocard-backend/handlers"
	"autocard-backend/middleware"
	"autocard-backend/repository"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	cfg := config.Load()

	db, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	fmt.Println("Connected to PostgreSQL")

	userRepo := repository.NewUserRepo(db)
	drawingRepo := repository.NewDrawingRepo(db)

	authHandler := handlers.NewAuthHandler(userRepo, cfg)
	drawingHandler := handlers.NewDrawingHandler(drawingRepo)
	aiHandler := handlers.NewAIHandler(cfg)

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("POST /api/auth/register", authHandler.Register)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/auth/verify-email", authHandler.VerifyEmail)

	// Protected routes
	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/auth/me", authHandler.Me)
	protected.HandleFunc("GET /api/drawings", drawingHandler.List)
	protected.HandleFunc("POST /api/drawings", drawingHandler.Create)
	protected.HandleFunc("GET /api/drawings/{id}", drawingHandler.Get)
	protected.HandleFunc("PUT /api/drawings/{id}", drawingHandler.Update)
	protected.HandleFunc("DELETE /api/drawings/{id}", drawingHandler.Delete)

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

	authMiddleware := middleware.Auth(cfg.JWTSecret)
	mux.Handle("/api/auth/me", authMiddleware(protected))
	mux.Handle("/api/drawings", authMiddleware(protected))
	mux.Handle("/api/drawings/", authMiddleware(protected))
	mux.Handle("/api/ai/", authMiddleware(protected))

	// WebSocket route
	mux.HandleFunc("GET /ws/collaborate", handlers.HandleWebSocket)

	// Apply CORS
	handler := middleware.CORS(mux)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	fmt.Printf("Server starting on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}
