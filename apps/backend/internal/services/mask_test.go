package services

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeMaskPoints(t *testing.T) {
	t.Run("sorts and dedupes", func(t *testing.T) {
		got, err := NormalizeMaskPoints([]float64{30, 10, 20, 10, 60})
		assert.NoError(t, err)
		assert.Equal(t, []float64{10, 20, 30, 60}, got)
	})
	t.Run("rounds to milliseconds", func(t *testing.T) {
		got, err := NormalizeMaskPoints([]float64{1.00049, 2})
		assert.NoError(t, err)
		assert.Equal(t, []float64{1, 2}, got)
	})
	t.Run("needs two distinct points", func(t *testing.T) {
		_, err := NormalizeMaskPoints([]float64{5})
		assert.ErrorIs(t, err, ErrMaskTooFewPoints)
		_, err = NormalizeMaskPoints([]float64{5, 5})
		assert.ErrorIs(t, err, ErrMaskTooFewPoints)
		_, err = NormalizeMaskPoints(nil)
		assert.ErrorIs(t, err, ErrMaskTooFewPoints)
	})
	t.Run("rejects negative and non-finite", func(t *testing.T) {
		_, err := NormalizeMaskPoints([]float64{-1, 5})
		assert.ErrorIs(t, err, ErrMaskBadPoint)
		_, err = NormalizeMaskPoints([]float64{math.NaN(), 5})
		assert.ErrorIs(t, err, ErrMaskBadPoint)
		_, err = NormalizeMaskPoints([]float64{math.Inf(1), 5})
		assert.ErrorIs(t, err, ErrMaskBadPoint)
	})
	t.Run("caps the number of points", func(t *testing.T) {
		big := make([]float64, maxMaskPoints+1)
		_, err := NormalizeMaskPoints(big)
		assert.ErrorIs(t, err, ErrMaskTooManyPoints)
	})
}

func TestNormalizeMaskName(t *testing.T) {
	got, err := NormalizeMaskName("  Базовая 60 с  ")
	assert.NoError(t, err)
	assert.Equal(t, "Базовая 60 с", got)

	_, err = NormalizeMaskName("   ")
	assert.ErrorIs(t, err, ErrMaskNameEmpty)

	long := make([]rune, maxMaskNameLen+1)
	for i := range long {
		long[i] = 'я'
	}
	_, err = NormalizeMaskName(string(long))
	assert.ErrorIs(t, err, ErrMaskNameTooLong)
}
