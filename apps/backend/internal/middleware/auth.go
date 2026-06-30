package middleware

import (
	"net/http"
	"strings"

	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates JWT from httpOnly cookie, falling back to Authorization header.
func AuthMiddleware(authSvc services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr, err := c.Cookie("jwt")
		if err != nil {
			// fallback: Authorization: Bearer <token>  (удобно для curl/Swagger)
			header := c.GetHeader("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":   "unauthorized",
					"message": "missing or malformed credentials",
				})
				return
			}
			tokenStr = strings.TrimPrefix(header, "Bearer ")
		}

		claims, err := authSvc.ValidateToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "invalid or expired token",
			})
			return
		}

		c.Set("claims", claims)
		c.Next()
	}
}

// RoleMiddleware allows access only to users with one of the specified roles.
// Must be used after AuthMiddleware.
func RoleMiddleware(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c *gin.Context) {
		claims, ok := c.Get("claims")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "missing auth claims",
			})
			return
		}

		userClaims := claims.(*services.Claims)
		if _, ok := allowed[userClaims.Role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "insufficient permissions",
			})
			return
		}

		c.Next()
	}
}
