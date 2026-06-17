package main

import (
	"fmt"
	"log"
	"os"

	"autocard-backend/config"
	"autocard-backend/dbutil"
	"autocard-backend/middleware"
	"autocard-backend/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Throwaway: migrates + seeds the minimal schema needed to smoke-test the
// 2D→3D analysis pipeline against a local Postgres. Safe to delete.
func main() {
	_ = godotenv.Load()
	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.DSN()), dbutil.NewGormConfig(os.Stdout))
	if err != nil {
		log.Fatal("connect:", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Drawing{},
		&models.Permission{},
		&models.VersionHistory{},
		&models.AnalysisJob{},
	); err != nil {
		log.Fatal("migrate:", err)
	}

	uid := "11111111-1111-1111-1111-111111111111"
	did := "22222222-2222-2222-2222-222222222222"

	db.Exec(`INSERT INTO users (id, email, name, email_verified, system_role)
	         VALUES (?, 'tester@autocard.dev', 'Tester', true, 'user')
	         ON CONFLICT (id) DO NOTHING`, uid)

	// Realistic DXF-style elements on AIA layers (walls + a door + a window + a room label).
	data := `{"elements":[` +
		`{"id":"e1","type":"line","x1":0,"y1":0,"x2":5000,"y2":0,"layerId":"A-WALL"},` +
		`{"id":"e2","type":"line","x1":5000,"y1":0,"x2":5000,"y2":4000,"layerId":"A-WALL"},` +
		`{"id":"e3","type":"line","x1":5000,"y1":4000,"x2":0,"y2":4000,"layerId":"A-WALL"},` +
		`{"id":"e4","type":"line","x1":0,"y1":4000,"x2":0,"y2":0,"layerId":"A-WALL"},` +
		`{"id":"e5","type":"arc","cx":1000,"cy":0,"radius":900,"layerId":"A-DOOR"},` +
		`{"id":"e6","type":"line","x1":3000,"y1":4000,"x2":4200,"y2":4000,"layerId":"A-GLAZ"},` +
		`{"id":"e7","type":"text","x":2500,"y":2000,"text":"LIVING ROOM","layerId":"A-ANNO"}` +
		`],"layers":[{"id":"A-WALL","name":"A-WALL"},{"id":"A-DOOR","name":"A-DOOR"},{"id":"A-GLAZ","name":"A-GLAZ"}]}`

	db.Exec(`INSERT INTO drawings (id, user_id, name, data, version)
	         VALUES (?, ?, 'Seed Test Plan', ?, 1)
	         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, did, uid, data)

	tok, _ := middleware.GenerateToken(uid, "", cfg.JWTSecret)
	fmt.Printf("seeded user=%s drawing=%s\n", uid, did)
	fmt.Printf("TOKEN=%s\n", tok)
}
