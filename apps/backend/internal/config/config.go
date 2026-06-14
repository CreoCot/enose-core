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
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}

	fmt.Printf("CONFIG WARNING: default value used for %s", key)
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
	}

	slog.Info("Coonfiguration loaded", "env", cfg.Env, "port", cfg.Port)
	return cfg, nil

}
