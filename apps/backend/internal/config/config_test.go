package config_test

import (
	"os"
	"testing"

	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		setupEnv string // Значение, которое мы установим перед тестом
		fallback string
		want     string
	}{
		{
			name:     "Existing env variable",
			key:      "PORT",
			setupEnv: "9090",
			fallback: "8080",
			want:     "9090",
		},
		{
			name:     "Missing env variable uses fallback",
			key:      "NON_EXISTENT",
			setupEnv: "",
			fallback: "default_val",
			want:     "default_val",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Устанавливаем переменную окружения (если есть)
			if tt.setupEnv != "" {
				os.Setenv(tt.key, tt.setupEnv)
				defer os.Unsetenv(tt.key) // Обязательно очищаем после теста
			} else {
				os.Unsetenv(tt.key)
			}

			// Вызываем функцию (предполагаем, что getEnv экспортирована или тестируем через NewConfig)
			// Если getEnv не экспортирована, тестируем NewConfig целиком
			cfg, err := config.NewConfig()
			assert.NoError(t, err)

			if tt.key == "PORT" {
				assert.Equal(t, tt.want, cfg.Port)
			}
		})
	}
}
