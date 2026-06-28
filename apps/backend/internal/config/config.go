package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	Env            string
	AllowedOrigins []string
	ParserURL      string
	ParserAPI      string
	JWTSecret      string
	Database       DatabaseConfig
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}

	slog.Warn("CONFIG: default value used for", "key", key, "fallback", fallback)
	return fallback
}

func NewConfig() (*Config, error) {
	err_dotenv := godotenv.Load()
	if err_dotenv != nil {
		if !errors.Is(err_dotenv, os.ErrNotExist) {
			return nil, fmt.Errorf("CONFIG ERROR: Failed to parse .env")
		}
		slog.Debug("CONFIG WARNING: .env file was not loaded successfully, default values are used")
	}

	originsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		origins = append(origins, strings.TrimSpace(o))
	}

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		Env:            getEnv("ENV", "development"),
		AllowedOrigins: origins,
		ParserURL:      getEnv("PARSER_URL", "http://localhost:8001"),
		ParserAPI:      getEnv("PARSER_API", "nothing"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		Database: DatabaseConfig{
			Host:     getEnv("DATABASE_HOST", "localhost"),
			Port:     getEnv("DATABASE_PORT", "5432"),
			User:     getEnv("DATABASE_USER", "postgres"),
			Password: getEnv("DATABASE_PASSWORD", "postgres"),
			Name:     getEnv("DATABASE_NAME", "enose"),
			SSLMode:  getEnv("DATABASE_SSLMODE", "disable"),
		},
	}

	slog.Info("Coonfiguration loaded", "env", cfg.Env, "port", cfg.Port)
	return cfg, nil

}
