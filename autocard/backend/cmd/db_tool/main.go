package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"autocard-backend/config"
	"autocard-backend/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	_ = godotenv.Load("../../.env") // Try loading from parent if run from dir
	_ = godotenv.Load()             // Try loading from current dir

	cfg := config.Load()
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to db:", err)
	}

	listCmd := flag.NewFlagSet("list", flag.ExitOnError)
	promoteCmd := flag.NewFlagSet("promote", flag.ExitOnError)
	demoteCmd := flag.NewFlagSet("demote", flag.ExitOnError)

	promoteEmail := promoteCmd.String("email", "", "Email of user to promote to system_admin")
	demoteEmail := demoteCmd.String("email", "", "Email of user to demote to user")

	if len(os.Args) < 2 {
		fmt.Println("Usage: db_tool <command> [arguments]")
		fmt.Println("Commands:")
		fmt.Println("  list      - List all users, organizations, and organization members")
		fmt.Println("  promote   - Promote a user to system_admin (requires -email)")
		fmt.Println("  demote    - Demote a user to standard user (requires -email)")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "list":
		listCmd.Parse(os.Args[2:])
		listDB(db)
	case "promote":
		promoteCmd.Parse(os.Args[2:])
		if *promoteEmail == "" {
			promoteCmd.Usage()
			os.Exit(1)
		}
		updateRole(db, *promoteEmail, "system_admin")
	case "demote":
		demoteCmd.Parse(os.Args[2:])
		if *demoteEmail == "" {
			demoteCmd.Usage()
			os.Exit(1)
		}
		updateRole(db, *demoteEmail, "user")
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}

func listDB(db *gorm.DB) {
	fmt.Println("=== USERS ===")
	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		log.Fatal("Failed to fetch users:", err)
	}
	for _, u := range users {
		fmt.Printf("ID: %s | Email: %s | Name: %s | SystemRole: %s\n", u.ID, u.Email, u.Name, u.SystemRole)
	}
	fmt.Println()

	fmt.Println("=== ORGANIZATIONS ===")
	var orgs []models.Organization
	if err := db.Find(&orgs).Error; err != nil {
		log.Fatal("Failed to fetch organizations:", err)
	}
	for _, o := range orgs {
		expStr := "nil"
		if o.SubscriptionExpires != nil {
			expStr = o.SubscriptionExpires.String()
		}
		fmt.Printf("ID: %s | Name: %s | Tier: %s | Expires: %s\n", o.ID, o.Name, o.SubscriptionTier, expStr)
	}
	fmt.Println()

	fmt.Println("=== ORGANIZATION MEMBERS ===")
	var members []models.OrganizationMember
	if err := db.Preload("User").Preload("Organization").Find(&members).Error; err != nil {
		log.Println("Note: Could not fetch members (schema might be missing preloads or fields):", err)
	} else {
		for _, m := range members {
			email := "unknown"
			orgName := "unknown"
			if m.User != nil {
				email = m.User.Email
			}
			if m.Organization != nil {
				orgName = m.Organization.Name
			}
			fmt.Printf("ID: %s | OrgName: %s | UserEmail: %s | Role: %s\n", m.ID, orgName, email, m.Role)
		}
	}
}

func updateRole(db *gorm.DB, email string, role string) {
	var user models.User
	if err := db.Where("email = ?", email).First(&user).Error; err != nil {
		log.Fatalf("User with email %s not found: %v", email, err)
	}

	user.SystemRole = role
	if err := db.Save(&user).Error; err != nil {
		log.Fatalf("Failed to update system_role: %v", err)
	}

	fmt.Printf("Successfully updated user %s system_role to: %s\n", email, role)
}
