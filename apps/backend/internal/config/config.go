package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	Env         string
	FrontendURL string
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

	cfg := &Config{
		Port:        getEnv("PORT", "8080"),
		Env:         getEnv("ENV", "development"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
	}

	slog.Info("Coonfiguration loaded", "env", cfg.Env, "port", cfg.Port)
	return cfg, nil

}
