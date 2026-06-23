package server

import (
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/CreoCot/enose-core/backend/docs/swagger"
	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/CreoCot/enose-core/backend/internal/handlers"
	"github.com/CreoCot/enose-core/backend/internal/middleware"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
)

func SetupRouter(cfg *config.Config, reg *repository.Registry, parser *services.ParserClient) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()

	r.Use(middleware.StructuredLogger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORSConfig(cfg.AllowedOrigins))

	if cfg.Env != "production" {
		// Обязательно! Иначе swag не найдёт документацию
		swaggerConfig := ginSwagger.Config{
			URL:          "/swagger/doc.json",
			DeepLinking:  true,
			DocExpansion: "list",
		}
		r.GET("/swagger/*any", ginSwagger.CustomWrapHandler(&swaggerConfig, swaggerFiles.Handler))
	}

	uploadHandler := handlers.NewUploadHandler(parser, reg)
	measurementsHandler := handlers.NewMeasurementsHandler(reg)

	v1 := r.Group("api/v1")
	{
		v1.GET("/health", handlers.Health)
		v1.GET("/table", handlers.Table)
		v1.GET("/plots", handlers.Plots)
		v1.POST("/upload", uploadHandler.Upload)
		v1.GET("/entries", measurementsHandler.GetAll)
	}

	return r

}
