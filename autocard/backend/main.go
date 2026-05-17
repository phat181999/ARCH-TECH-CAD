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

	_ "github.com/lib/pq"
)

func main() {
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

	authMiddleware := middleware.Auth(cfg.JWTSecret)
	mux.Handle("/api/auth/me", authMiddleware(protected))
	mux.Handle("/api/drawings", authMiddleware(protected))
	mux.Handle("/api/drawings/", authMiddleware(protected))

	// WebSocket route (public for collaboration)
	mux.HandleFunc("GET /ws/collaborate", handlers.HandleWebSocket)

	// Apply CORS
	handler := middleware.CORS(mux)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	fmt.Printf("Server starting on %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}
