package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// FlexibleTime — кастомный тип времени, который парсит разные ISO-8601 форматы
type FlexibleTime struct {
	time.Time
}

// Поддерживаемые форматы (от наиболее строгого к наиболее свободному)
var timeFormats = []string{
	time.RFC3339Nano,                // 2006-01-02T15:04:05.999999999Z07:00
	time.RFC3339,                    // 2006-01-02T15:04:05Z07:00
	"2006-01-02T15:04:05.999999999", // ISO с наносекундами, без TZ
	"2006-01-02T15:04:05.999999",    // ISO с микросекундами, без TZ
	"2006-01-02T15:04:05",           // ISO без TZ (самый частый от Python)
	"2006-01-02 15:04:05",           // SQL-формат
	"02.01.2006 15:04:05",           // Формат из XML-парсера
}

// UnmarshalJSON реализует интерфейс json.Unmarshaler
func (t *FlexibleTime) UnmarshalJSON(data []byte) error {
	// Убираем кавычки
	s := strings.Trim(string(data), `"`)
	if s == "null" || s == "" {
		return nil
	}

	// Пытаемся распарсить каждый формат по очереди
	for _, format := range timeFormats {
		if parsed, err := time.Parse(format, s); err == nil {
			t.Time = parsed
			return nil
		}
	}

	return fmt.Errorf("cannot parse time: %q (tried %d formats)", s, len(timeFormats))
}

// MarshalJSON реализует интерфейс json.Marshaler
func (t FlexibleTime) MarshalJSON() ([]byte, error) {
	if t.Time.IsZero() {
		return []byte("null"), nil
	}
	return []byte(`"` + t.Time.Format(time.RFC3339) + `"`), nil
}

// Value для GORM (сохранение в БД)
func (t FlexibleTime) Value() interface{} {
	return t.Time
}

// Scan для GORM (чтение из БД)
func (t *FlexibleTime) Scan(value interface{}) error {
	if value == nil {
		t.Time = time.Time{}
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		t.Time = v
	case string:
		return t.UnmarshalJSON([]byte(`"` + v + `"`))
	case []byte:
		return t.UnmarshalJSON(v)
	default:
		return fmt.Errorf("cannot scan %T into FlexibleTime", value)
	}
	return nil
}

// Data types for measurements

type ParsedSensor struct {
	Position int    `json:"position"`
	Label    string `json:"label"`
	Unit     string `json:"unit"`
}

type ParsedDataPoint struct {
	TimeOffsetS    float64 `json:"time_offset_s"`
	SensorPosition int     `json:"sensor_position"`
	Value          float64 `json:"value"`
}

type ParsedMeasurement struct {
	DeviceSerial      string            `json:"device_serial"`
	DeviceTypeCode    string            `json:"device_type_code"`
	MeasurementName   string            `json:"measurement_name"`
	MeasurementObject *string           `json:"measurement_object"`
	StartTime         FlexibleTime      `json:"start_time"`
	IntervalMs        int               `json:"interval_ms"`
	Description       *string           `json:"description"`
	Sensors           []ParsedSensor    `json:"sensors"`
	DataPoints        []ParsedDataPoint `json:"data_points"`
}

type ParserError struct {
	Detail string `json:"detail"`
}

// Data types for Parser Client

type ParserClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewParserClient(baseURL, apiKey string) *ParserClient {
	return &ParserClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *ParserClient) ParseFile(ctx context.Context, filename string, content []byte) (*ParsedMeasurement, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("Create form file: %w", err)
	}

	if _, err := part.Write(content); err != nil {
		return nil, fmt.Errorf("Write form file: %w", err)
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("Close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/measurements/parse", &buf)
	if err != nil {
		return nil, fmt.Errorf("Create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Send request to parser: %w", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)

		var perr ParserError
		if json.Unmarshal(body, &perr) == nil && perr.Detail != "" {
			return nil, fmt.Errorf("parser service error (status code: %d): %s", resp.StatusCode, perr.Detail)
		}
	}

	var result ParsedMeasurement
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode parsed response: %w", err)
	}

	return &result, nil
}

func (c *ParserClient) Health(ctx context.Context) error {
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
		return fmt.Errorf("parser service unhealthy: status %d", resp.StatusCode)
	}

	return nil

}
