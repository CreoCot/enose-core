package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
	Uptime    string `json:"uptime,omitempty"`
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
