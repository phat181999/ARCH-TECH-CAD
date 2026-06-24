package config

import (
	"net/url"
	"os"
)

type Config struct {
	DatabaseURL    string
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	DBSSLMode      string
	ServerPort     string
	JWTSecret      string
	SMTPHost       string
	SMTPPort       string
	SMTPUser       string
	SMTPPass       string
	FromEmail      string
	AppURL         string
	GeminiAPIKey   string
	OpenAIAPIKey   string
	RedisHost      string
	RedisPort      string
	RedisURL       string
	GoogleClientID  string
	AnthropicAPIKey string
	QdrantURL        string
	QdrantCollection string
	QdrantAPIKey     string
}

func Load() *Config {
	return &Config{
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		DBHost:          getEnv("DB_HOST", "localhost"),
		DBPort:          getEnv("DB_PORT", "5432"),
		DBUser:          getEnv("DB_USER", "postgres"),
		DBPassword:      getEnv("DB_PASSWORD", "postgres"),
		DBName:          getEnv("DB_NAME", "arch-cad"),
		DBSSLMode:       getEnv("DB_SSLMODE", "disable"),
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		JWTSecret:       getEnv("JWT_SECRET", "autocard-dev-secret-change-in-production"),
		SMTPHost:        getEnv("SMTP_HOST", "sandbox.smtp.mailtrap.io"),
		SMTPPort:        getEnv("SMTP_PORT", "2525"),
		SMTPUser:        getEnv("SMTP_USER", ""),
		SMTPPass:        getEnv("SMTP_PASS", ""),
		FromEmail:       getEnv("FROM_EMAIL", "noreply@autocard.app"),
		AppURL:          getEnv("APP_URL", "http://localhost:5173"),
		GeminiAPIKey:    getEnv("GEMINI_API_KEY", ""),
		OpenAIAPIKey:    getEnv("OPENAI_API_KEY", ""),
		RedisURL:        getEnv("REDIS_URL", ""),
		RedisHost:       getEnv("REDIS_HOST", "localhost"),
		RedisPort:       getEnv("REDIS_PORT", "6379"),
		GoogleClientID:  getEnv("GOOGLE_CLIENT_ID", ""),
		AnthropicAPIKey: getEnv("ANTHROPIC_API_KEY", ""),
		QdrantURL:        getEnv("QDRANT_URL", "http://localhost:6333"),
		QdrantCollection: getEnv("QDRANT_COLLECTION", "cad_drawings"),
		QdrantAPIKey:     getEnv("QDRANT_API_KEY", ""),
	}
}

func (c *Config) DSN() string {
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	return "host=" + c.DBHost +
		" port=" + c.DBPort +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" sslmode=" + c.DBSSLMode
}

// RedisAddr returns host:port. If REDIS_URL is set (e.g. from Upstash/Render),
// it parses the host and port from the URL so callers get a consistent addr.
func (c *Config) RedisAddr() string {
	if c.RedisURL != "" {
		if u, err := url.Parse(c.RedisURL); err == nil && u.Host != "" {
			return u.Host // already "host:port"
		}
	}
	return c.RedisHost + ":" + c.RedisPort
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
