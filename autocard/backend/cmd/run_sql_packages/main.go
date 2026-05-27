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
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to db:", err)
	}

	sqlBytes, err := os.ReadFile("migrations/004_create_packages.sql")
	if err != nil {
		log.Fatal("Failed to read SQL migration file:", err)
	}

	fmt.Println("Executing raw SQL migration 004...")
	err = db.Exec(string(sqlBytes)).Error
	if err != nil {
		log.Fatal("Failed to execute raw SQL migration:", err)
	}

	fmt.Println("Raw SQL migration 004 executed successfully!")
}
