package main

import (
	"fmt"
	"log"
	"os"

	"autocard-backend/config"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to db:", err)
	}

	sqlBytes, err := os.ReadFile("migrations/005_rag_mvp.sql")
	if err != nil {
		log.Fatal("Failed to read migration file:", err)
	}

	fmt.Println("Executing RAG migration 005...")
	if err := db.Exec(string(sqlBytes)).Error; err != nil {
		log.Fatal("Migration failed:", err)
	}

	fmt.Println("RAG migration 005 executed successfully.")
}
