package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

func ComputeGroupKey(deviceSerial, measurementObject string, intervalMs int, sensorPositions []int, description string) string {
	sorted := make([]int, len(sensorPositions))
	copy(sorted, sensorPositions)
	sort.Ints(sorted)

	signature := map[string]any{
		"device_serial":      deviceSerial,
		"measurement_object": measurementObject,
		"interval_ms":        intervalMs,
		"sensor_positions":   sorted,
		"description":        description,
	}

	payload, _ := json.Marshal(signature)
	hash := sha256.Sum256(payload)
	return hex.EncodeToString(hash[:])
}
