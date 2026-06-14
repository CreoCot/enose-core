package handlers

import (
	"net/http"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/tools"
	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
	Uptime    string `json:"uptime,omitempty"`
}

type TableResponse struct {
	Table  [][]float64 `json:"table"`
	Length int         `json:"length"`
}

var startTime = time.Now()

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:    "OK",
		Timestamp: time.Now().UTC().Format(time.RFC1123),
		Version:   "1.0.0-mvp",
		Uptime:    time.Since(startTime).String(),
	})
}

func Table(c *gin.Context) {
	var table [][]float64 = tools.MakeData()
	c.JSON(http.StatusOK, TableResponse{
		table, 8,
	})
}
