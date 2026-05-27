package main

import (
	"fmt"
	"log"
	"os"

	"autocard-backend/config"
	"autocard-backend/dbutil"
	"autocard-backend/models"

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
	db, err := gorm.Open(postgres.Open(cfg.DSN()), dbutil.NewGormConfig(os.Stdout))
	if err != nil {
		log.Fatal("Failed to connect to db:", err)
	}

	fmt.Println("Running AutoMigrate...")
	err = db.AutoMigrate(
		&models.SubscriptionPackage{},
		&models.Organization{},
		&models.OrganizationMember{},
	)

	if err != nil {
		log.Fatal("Failed to auto-migrate:", err)
	}

	fmt.Println("GORM AutoMigrate completed successfully!")
}
