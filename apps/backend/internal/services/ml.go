package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Data types for the ML service contract (apps/ml AnalyzeRequest/AnalyzeResponse schema).

type MLPoint struct {
	T     float64 `json:"t"`
	Value float64 `json:"value"`
}

type MLSensorSeries struct {
	SensorID int       `json:"sensor_id"`
	Position *int      `json:"position,omitempty"`
	Label    *string   `json:"label,omitempty"`
	Points   []MLPoint `json:"points"`
}

type MLMeasurementMeta struct {
	ID         *int    `json:"id,omitempty"`
	Name       *string `json:"name,omitempty"`
	IntervalMS *int    `json:"interval_ms,omitempty"`
}

type MLAnalyzeRequest struct {
	Measurement MLMeasurementMeta `json:"measurement"`
	Series      []MLSensorSeries  `json:"series"`
	Metadata    map[string]any    `json:"metadata"`
}

type MLFeatureItem struct {
	SensorID int     `json:"sensor_id"`
	Name     string  `json:"name"`
	Value    float64 `json:"value"`
}

type MLAnalyzeResponse struct {
	Features   []MLFeatureItem `json:"features"`
	ComputedAt time.Time       `json:"computed_at"`
}

// MLClient вызывает stateless ML-сервис для расчёта признаков по временным рядам.
type MLClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewMLClient(baseURL, apiKey string) *MLClient {
	return &MLClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Analyze отправляет серии сенсоров в ML-сервис и возвращает рассчитанные признаки.
func (c *MLClient) Analyze(ctx context.Context, req MLAnalyzeRequest) (*MLAnalyzeResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal analyze request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/analyze", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request to ml service: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read ml response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Сервис возвращает ошибки как JSON {"detail": "..."} — переиспользуем ParserError.
		var perr ParserError
		if json.Unmarshal(data, &perr) == nil && perr.Detail != "" {
			return nil, fmt.Errorf("ml service error (status %d): %s", resp.StatusCode, perr.Detail)
		}
		return nil, fmt.Errorf("ml service error (status %d)", resp.StatusCode)
	}

	var result MLAnalyzeResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("decode ml response: %w", err)
	}

	return &result, nil
}

func (c *MLClient) Health(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("create health request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ml service unhealthy: status %d", resp.StatusCode)
	}
	return nil
}
