package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	Env            string
	AllowedOrigins []string
	ParserURL      string
	ParserAPI      string
	ReportURL      string
	ReportAPI      string
	MLURL          string
	MLAPI          string
	JWTSecret      string
	// EnableSwagger — независимый от Env флаг: показывать /swagger/*. Раньше
	// был жёстко завязан на "cfg.Env != production", из-за чего на проде
	// Swagger включался/выключался как случайный побочный эффект значения ENV
	// (например, ENV=staging). Теперь это осознанное, явное решение.
	EnableSwagger bool
	Database      DatabaseConfig
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

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		slog.Warn("CONFIG: default value used for", "key", key, "fallback", fallback)
		return fallback
	}

	parsed, err := strconv.ParseBool(val)
	if err != nil {
		slog.Warn("CONFIG: invalid bool value, using fallback", "key", key, "value", val, "fallback", fallback)
		return fallback
	}
	return parsed
}

// loadDotEnv loads the given .env file into the process environment without
// overwriting variables already set (by the OS or a previously loaded file).
// A missing file is not an error — it just means that source is skipped.
func loadDotEnv(path string) error {
	if err := godotenv.Load(path); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("CONFIG ERROR: failed to parse %s", path)
		}
		slog.Debug("CONFIG: env file not found, skipping", "path", path)
	}
	return nil
}

func NewConfig() (*Config, error) {
	// Local apps/backend/.env (for non-Docker local dev) takes precedence,
	// falling back to the root .env (single source of truth for Docker Compose).
	if err := loadDotEnv(".env"); err != nil {
		return nil, err
	}
	if err := loadDotEnv("../../.env"); err != nil {
		return nil, err
	}

	originsStr := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		origins = append(origins, strings.TrimSpace(o))
	}

	env := getEnv("ENV", "development")

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		Env:            env,
		AllowedOrigins: origins,
		ParserURL:      getEnv("PARSER_URL", "http://localhost:8001"),
		ParserAPI:      getEnv("PARSER_API_KEY", "nothing"),
		ReportURL:      getEnv("REPORT_URL", "http://localhost:8002"),
		ReportAPI:      getEnv("REPORT_API_KEY", "example_api_key"),
		MLURL:          getEnv("ML_URL", "http://localhost:8003"),
		MLAPI:          getEnv("ML_API_KEY", "example_api_key"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		// Дефолт сохраняет прежнее поведение (скрыт только в "чистом" production),
		// но ENABLE_SWAGGER всегда может явно переопределить его в любую сторону.
		EnableSwagger: getEnvBool("ENABLE_SWAGGER", env != "production"),
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
