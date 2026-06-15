// Package migrations embeds the versioned SQL migration files so that
// golang-migrate can run them without reading files from disk at
// runtime. These files (000001_init.{up,down}.sql and any future
// versions) are the source of truth for the database structure.
//
// The glob pattern matches only migration files in this directory.
// database/sql/schema.sql lives in a separate package and is NOT
// embedded here — it is kept only as a reference/validation document.
package migrations

import "embed"

// FS holds the embedded migration files, exposed as an io/fs.FS for
// golang-migrate's iofs source driver.
//
//go:embed *.sql
var FS embed.FS
