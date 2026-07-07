package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDownsampleIndices_ReturnsAllWhenUnderCap(t *testing.T) {
	idx := downsampleIndices(5, 5000)
	assert.Equal(t, []int{0, 1, 2, 3, 4}, idx)
}

func TestDownsampleIndices_CapsAndKeepsEndpoints(t *testing.T) {
	idx := downsampleIndices(10000, 5000)
	assert.Len(t, idx, 5000)
	assert.Equal(t, 0, idx[0])
	assert.Equal(t, 9999, idx[len(idx)-1])

	// Индексы строго не убывают и остаются в границах.
	for i := 1; i < len(idx); i++ {
		assert.GreaterOrEqual(t, idx[i], idx[i-1])
		assert.Less(t, idx[i], 10000)
	}
}

func TestDownsampleIndices_EmptyAndZeroCap(t *testing.T) {
	assert.Nil(t, downsampleIndices(0, 5000))

	// maxPoints <= 0 → все индексы.
	assert.Equal(t, []int{0, 1, 2}, downsampleIndices(3, 0))
}

func TestPickFloat_SelectsByIndex(t *testing.T) {
	src := []float64{10, 20, 30, 40}
	assert.Equal(t, []float64{10, 30}, pickFloat(src, []int{0, 2}))
	// Индексы вне границ пропускаются.
	assert.Equal(t, []float64{40}, pickFloat(src, []int{3, 99}))
}
