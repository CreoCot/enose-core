package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/CreoCot/enose-core/backend/database/migrations"
	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	// pgx stdlib registers the "pgx" driver used by the dedicated
	// migration connection so database/sql can talk to PostgreSQL.
	_ "github.com/jackc/pgx/v5/stdlib"
)

// MigrationState describes the current migration state of the database.
type MigrationState struct {
	// Version is the active migration version, or 0 when the database
	// has no migrations applied (nil state).
	Version uint
	// Dirty is true when a previous migration failed mid-run and must
	// be repaired before further migrations can be applied.
	Dirty bool
}

// NewMigrator builds a golang-migrate instance that reads its files
// from the embedded migrations.FS and applies them to the database
// described by cfg. It opens a dedicated *sql.DB (separate from the
// GORM pool used by the API server) and closes it via the returned
// closer.
//
// The migrator owns its own connection so migrations never interfere
// with the API server's pool and vice versa.
func NewMigrator(ctx context.Context, cfg config.DatabaseConfig) (*migrate.Migrate, func(), error) {
	d, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return nil, nil, fmt.Errorf("load embedded migrations: %w", err)
	}

	db, err := sql.Open("pgx", dsn(cfg))
	if err != nil {
		return nil, nil, fmt.Errorf("open migration connection: %w", err)
	}

	if err := pingCtx(ctx, db); err != nil {
		_ = db.Close()
		return nil, nil, err
	}

	// Wrap the dedicated *sql.DB so golang-migrate can drive it. The
	// driver name "postgres" identifies the database implementation
	// regardless of the underlying connection driver (pgx stdlib).
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		_ = db.Close()
		return nil, nil, fmt.Errorf("init migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", d, "postgres", driver)
	if err != nil {
		_ = db.Close()
		return nil, nil, fmt.Errorf("create migrator: %w", err)
	}

	closer := func() {
		srcErr, dbErr := m.Close()
		if srcErr != nil {
			slog.Warn("Failed to close migration source", "error", srcErr)
		}
		if dbErr != nil {
			slog.Warn("Failed to close migration database", "error", dbErr)
		}
	}
	return m, closer, nil
}

// MigrateUp applies all pending migrations. When the database is already
// up to date it returns nil without error (golang-migrate's
// migrate.ErrNoChange is treated as success).
func MigrateUp(ctx context.Context, cfg config.DatabaseConfig) error {
	m, closer, err := NewMigrator(ctx, cfg)
	if err != nil {
		return err
	}
	defer closer()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

// MigrateDown reverts all migrations, dropping the schema. This is
// DESTRUCTIVE and intended only for local development resets.
func MigrateDown(ctx context.Context, cfg config.DatabaseConfig) error {
	m, closer, err := NewMigrator(ctx, cfg)
	if err != nil {
		return err
	}
	defer closer()

	// -1 rolls back every applied version.
	if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("rollback migrations: %w", err)
	}
	return nil
}

// MigrationVersion reports the active migration version and dirty flag.
func MigrationVersion(ctx context.Context, cfg config.DatabaseConfig) (MigrationState, error) {
	m, closer, err := NewMigrator(ctx, cfg)
	if err != nil {
		return MigrationState{}, err
	}
	defer closer()

	version, dirty, err := m.Version()
	if err != nil {
		if errors.Is(err, migrate.ErrNilVersion) {
			// No migrations applied yet; not an error.
			return MigrationState{Version: 0, Dirty: false}, nil
		}
		return MigrationState{}, fmt.Errorf("read migration version: %w", err)
	}
	return MigrationState{Version: version, Dirty: dirty}, nil
}

// pingCtx is a small helper that pings the dedicated migration
// connection, bounded by ctx, to surface connectivity failures early
// (golang-migrate's Up would otherwise hang until the dial timeout).
func pingCtx(ctx context.Context, db *sql.DB) error {
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping database for migration: %w", err)
	}
	return nil
}

// Compile-time guarantee that migrations.FS satisfies an fs.FS used by
// iofs.New (already true via embed.FS; the assertion keeps the embed
// contract explicit for future maintainers).
var _ fs.FS = migrations.FS
