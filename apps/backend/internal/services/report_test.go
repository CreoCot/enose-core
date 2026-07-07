package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReportClient_GenerateReport_ReturnsPDFBytes(t *testing.T) {
	pdfBytes := []byte("%PDF-1.7\n...binary...")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/reports", r.URL.Path)
		assert.Equal(t, "secret-key", r.Header.Get("X-API-Key"))
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		w.Header().Set("Content-Type", "application/pdf")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(pdfBytes)
	}))
	defer srv.Close()

	client := NewReportClient(srv.URL, "secret-key")
	out, err := client.GenerateReport(context.Background(), ReportRequest{
		Header:     ReportHeader{Name: "test", Device: "eNose", Object: "lemon"},
		Timestamps: []float64{0, 1, 2},
		Sensors:    []ReportSensor{{ID: 1, Name: "S1", Initial: 100, Values: []float64{100, 101, 102}}},
	})

	assert.NoError(t, err)
	assert.Equal(t, pdfBytes, out)
}

func TestReportClient_GenerateReport_PropagatesServiceError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"detail":"series must not be empty"}`))
	}))
	defer srv.Close()

	client := NewReportClient(srv.URL, "secret-key")
	_, err := client.GenerateReport(context.Background(), ReportRequest{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "series must not be empty")
	assert.Contains(t, err.Error(), "422")
}

func TestReportClient_GenerateReport_UnreachableService(t *testing.T) {
	// Указываем на закрытый порт — соединение не установится.
	client := NewReportClient("http://127.0.0.1:0", "secret-key")
	_, err := client.GenerateReport(context.Background(), ReportRequest{})
	assert.Error(t, err)
}
