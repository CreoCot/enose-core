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

// Data types for the Report service contract (apps/report ReportRequest schema).

type ReportHeader struct {
	Name   string    `json:"name"`
	Device string    `json:"device"`
	Object string    `json:"object"`
	Date   time.Time `json:"date"`
}

type ReportSensor struct {
	ID      int       `json:"id"`
	Name    string    `json:"name"`
	Initial float64   `json:"initial"`
	Values  []float64 `json:"values"`
}

type ReportInterpretation struct {
	Text string `json:"text"`
}

type ReportRequest struct {
	Header         ReportHeader          `json:"header"`
	Timestamps     []float64             `json:"timestamps"`
	Sensors        []ReportSensor        `json:"sensors"`
	Interpretation *ReportInterpretation `json:"interpretation"`
}

// ReportClient вызывает stateless report-сервис для генерации PDF.
// Таймаут выше, чем у парсера: рендер графиков matplotlib на больших измерениях дольше.
type ReportClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewReportClient(baseURL, apiKey string) *ReportClient {
	return &ReportClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// GenerateReport отправляет собранный пакет данных в report-сервис и возвращает PDF-байты.
func (c *ReportClient) GenerateReport(ctx context.Context, report ReportRequest) ([]byte, error) {
	body, err := json.Marshal(report)
	if err != nil {
		return nil, fmt.Errorf("marshal report request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/reports", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request to report service: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read report response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Сервис возвращает ошибки как JSON {"detail": "..."} — переиспользуем ParserError.
		var perr ParserError
		if json.Unmarshal(data, &perr) == nil && perr.Detail != "" {
			return nil, fmt.Errorf("report service error (status %d): %s", resp.StatusCode, perr.Detail)
		}
		return nil, fmt.Errorf("report service error (status %d)", resp.StatusCode)
	}

	return data, nil
}

func (c *ReportClient) Health(ctx context.Context) error {
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
		return fmt.Errorf("report service unhealthy: status %d", resp.StatusCode)
	}
	return nil
}
