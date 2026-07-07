package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMLClient_Analyze_ReturnsFeatures(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/analyze", r.URL.Path)
		assert.Equal(t, "secret-key", r.Header.Get("X-API-Key"))

		var req MLAnalyzeRequest
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Len(t, req.Series, 1)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"features":[{"sensor_id":1,"name":"auc","value":12.5}],"computed_at":"2026-07-08T00:00:00Z"}`))
	}))
	defer srv.Close()

	client := NewMLClient(srv.URL, "secret-key")
	out, err := client.Analyze(context.Background(), MLAnalyzeRequest{
		Series: []MLSensorSeries{{SensorID: 1, Points: []MLPoint{{T: 0, Value: 0}, {T: 1, Value: 5}}}},
	})

	assert.NoError(t, err)
	assert.Len(t, out.Features, 1)
	assert.Equal(t, "auc", out.Features[0].Name)
	assert.Equal(t, 12.5, out.Features[0].Value)
}

func TestMLClient_Analyze_PropagatesServiceError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"detail":"series must not be empty"}`))
	}))
	defer srv.Close()

	client := NewMLClient(srv.URL, "secret-key")
	_, err := client.Analyze(context.Background(), MLAnalyzeRequest{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "series must not be empty")
	assert.Contains(t, err.Error(), "422")
}

func TestMLClient_Analyze_UnreachableService(t *testing.T) {
	client := NewMLClient("http://127.0.0.1:0", "secret-key")
	_, err := client.Analyze(context.Background(), MLAnalyzeRequest{})
	assert.Error(t, err)
}
