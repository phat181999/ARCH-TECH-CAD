package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	connStr := "host=localhost port=5432 user=postgres password=tanphat99 dbname=arch-cad sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to db:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping db:", err)
	}

	content, err := ioutil.ReadFile("migrations/002_add_collaboration.sql")
	if err != nil {
		log.Fatal("Failed to read migration:", err)
	}

	_, err = db.Exec(string(content))
	if err != nil {
		log.Fatal("Failed to execute migration:", err)
	}

	fmt.Println("Migration 002 applied successfully!")
}
