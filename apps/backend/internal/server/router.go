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
		swaggerConfig := ginSwagger.Config{
			URL:          "/swagger/doc.json",
			DeepLinking:  true,
			DocExpansion: "list",
		}
		r.GET("/swagger/*any", ginSwagger.CustomWrapHandler(&swaggerConfig, swaggerFiles.Handler))
	}

	authSvc := services.NewAuthService(reg.Users, cfg.JWTSecret)

	uploadHandler := handlers.NewUploadHandler(parser, reg)
	measurementsHandler := handlers.NewMeasurementsHandler(reg)
	authHandler := handlers.NewAuthHandler(authSvc)

	v1 := r.Group("api/v1")
	{
		// Public
		v1.GET("/health", handlers.Health)

		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Requires valid JWT
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware(authSvc))
		{
			protected.GET("/auth/me", authHandler.Me)
			protected.GET("/table", handlers.Table)
			protected.GET("/plots", handlers.Plots)
			protected.GET("/entries", measurementsHandler.GetAll)

			// Admin only
			admin := protected.Group("/")
			admin.Use(middleware.RoleMiddleware(services.RoleAdmin))
			{
				admin.POST("/upload", uploadHandler.Upload)
			}
		}
	}

	return r
}
