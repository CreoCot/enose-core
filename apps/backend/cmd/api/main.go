// @title Enose Core API
// @version 1.0.0
// @description API for e-nose system
// @termsOfService http://swagger.io/terms/

// @contact.name Enose Core Team
// @contact.email dev@enose-core.local

// @license.name Proprietary
// @license.url http://swagger.io/licenses/

// @host localhost:8080
// @BasePath /api/v1
// @schemes http

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description JWT-token (TBA)
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/server"
	"github.com/CreoCot/enose-core/backend/internal/services"
)

func main() {
	cfg, err := config.NewConfig()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	if err := database.Connect(cfg.Database); err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer func() {
		if err := database.Close(); err != nil {
			slog.Error("Failed to close database connection", "error", err)
		}
	}()

	reg := repository.NewRegistry(database.DB())
	parser := services.NewParserClient(cfg.ParserURL, cfg.ParserAPI)
	router := server.SetupRouter(cfg, reg, parser)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Starting API server", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server stopped gracefully")

}
