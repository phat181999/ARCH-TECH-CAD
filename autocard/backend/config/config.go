package config

import "os"

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	ServerPort string
	JWTSecret  string
	SMTPHost   string
	SMTPPort   string
	SMTPUser   string
	SMTPPass   string
	FromEmail  string
	AppURL     string
}

func Load() *Config {
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "autocard"),
		DBPassword: getEnv("DB_PASSWORD", "autocard123"),
		DBName:     getEnv("DB_NAME", "autocard"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		JWTSecret:  getEnv("JWT_SECRET", "autocard-dev-secret-change-in-production"),
		SMTPHost:   getEnv("SMTP_HOST", "sandbox.smtp.mailtrap.io"),
		SMTPPort:   getEnv("SMTP_PORT", "2525"),
		SMTPUser:   getEnv("SMTP_USER", ""),
		SMTPPass:   getEnv("SMTP_PASS", ""),
		FromEmail:  getEnv("FROM_EMAIL", "noreply@autocard.app"),
		AppURL:     getEnv("APP_URL", "http://localhost:5173"),
	}
}

func (c *Config) DSN() string {
	return "host=" + c.DBHost +
		" port=" + c.DBPort +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" sslmode=" + c.DBSSLMode
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}