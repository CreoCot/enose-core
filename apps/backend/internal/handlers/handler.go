package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/tools"
	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
	Uptime    string `json:"uptime,omitempty"`
	Database  string `json:"database"`
}

type TableResponse struct {
	Table  [][]float64 `json:"table"`
	Length int         `json:"length"`
}

var startTime = time.Now()

func Health(c *gin.Context) {
	databaseStatus := "ok"
	if err := database.Ping(context.Background()); err != nil {
		databaseStatus = "unavailable"
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:    "OK",
		Timestamp: time.Now().UTC().Format(time.RFC1123),
		Version:   "1.0.0-mvp",
		Uptime:    time.Since(startTime).String(),
		Database:  databaseStatus,
	})
}

func Table(c *gin.Context) {
	var table [][]float64 = tools.MakeData()
	c.JSON(http.StatusOK, TableResponse{
		table, 8,
	})
}
