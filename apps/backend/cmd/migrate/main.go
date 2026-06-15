// Command migrate applies versioned database migrations using
// golang-migrate. It is the explicit counterpart to the API server:
// the server never runs migrations on startup, so the schema must be
// initialized (or updated) with this command.
//
// Usage:
//
//	task backend:db:init     # apply pending migrations (migrate up)
//	task backend:db:down     # rollback all migrations (DESTRUCTIVE)
//	task backend:db:status   # print the active migration version
//
// or directly:
//
//	cd apps/backend
//	go run ./cmd/migrate/main.go up      # default when no arg is given
//	go run ./cmd/migrate/main.go down
//	go run ./cmd/migrate/main.go status
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/CreoCot/enose-core/backend/internal/database"
)

func main() {
	cfg, err := config.NewConfig()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	switch command {
	case "up":
		if err := database.MigrateUp(ctx, cfg.Database); err != nil {
			slog.Error("Migration up failed", "error", err)
			os.Exit(1)
		}
		slog.Info("Migrations applied successfully")

	case "down":
		if err := database.MigrateDown(ctx, cfg.Database); err != nil {
			slog.Error("Migration down failed", "error", err)
			os.Exit(1)
		}
		slog.Info("Migrations rolled back successfully")

	case "status":
		state, err := database.MigrationVersion(ctx, cfg.Database)
		if err != nil {
			slog.Error("Failed to read migration version", "error", err)
			os.Exit(1)
		}
		fmt.Printf("version=%d dirty=%t\n", state.Version, state.Dirty)

	default:
		slog.Error("Unknown command", "command", command, "allowed", []string{"up", "down", "status"})
		os.Exit(1)
	}
}
