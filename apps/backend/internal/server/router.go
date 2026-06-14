package server

import (
	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/CreoCot/enose-core/backend/internal/handlers"
	"github.com/CreoCot/enose-core/backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()

	r.Use(middleware.StructuredLogger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORSConfig(cfg.AllowedOrigins))

	v1 := r.Group("api/v1")
	{
		v1.GET("/health", handlers.Health)
		v1.GET("/table", handlers.Table)
	}

	return r

}
