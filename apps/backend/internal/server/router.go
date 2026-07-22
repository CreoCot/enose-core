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

func SetupRouter(cfg *config.Config, reg *repository.Registry, parser *services.ParserClient, report *services.ReportClient, ml *services.MLClient) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	r := gin.New()

	r.Use(middleware.StructuredLogger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORSConfig(cfg.AllowedOrigins))

	if cfg.EnableSwagger {
		swaggerConfig := ginSwagger.Config{
			URL:          "/swagger/doc.json",
			DeepLinking:  true,
			DocExpansion: "list",
		}
		r.GET("/swagger/*any", ginSwagger.CustomWrapHandler(&swaggerConfig, swaggerFiles.Handler))
	}

	authSvc := services.NewAuthService(reg.Users, reg.RefreshTokens, cfg.JWTSecret)

	uploadHandler := handlers.NewUploadHandler(parser, reg)
	measurementsHandler := handlers.NewMeasurementsHandler(reg, report, ml)
	authHandler := handlers.NewAuthHandler(authSvc, reg.Measurements, cfg.Env == "production")

	v1 := r.Group("api/v1")
	{
		// Public
		v1.GET("/health", handlers.Health)

		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/logout", authHandler.Logout)
			// Публичный: должен работать даже когда access-токен уже истёк —
			// это и есть его смысл. Валидируется отдельным refresh_token cookie.
			auth.POST("/refresh", authHandler.Refresh)
		}

		// Requires valid JWT
		protected := v1.Group("/")
		protected.Use(middleware.AuthMiddleware(authSvc))
		{
			protected.GET("/auth/me", authHandler.Me)
			protected.GET("/table", handlers.Table)
			protected.GET("/table/:id", measurementsHandler.GetTable)
			protected.GET("/plots", handlers.Plots)
			protected.GET("/plots/:id", measurementsHandler.GetPlots)
			protected.GET("/entries", measurementsHandler.GetAll)
			protected.GET("/report/:id", measurementsHandler.GetReport)
			protected.GET("/features/:id", measurementsHandler.GetFeatures)
			protected.DELETE("/delete/:id", measurementsHandler.Delete)
			// Измерение привязывается к загрузившему (user_id из клеймов),
			// оператор видит только свои — поэтому загрузка доступна всем ролям.
			protected.POST("/upload", uploadHandler.Upload)
		}
	}

	return r
}
