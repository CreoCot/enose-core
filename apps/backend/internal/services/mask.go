package services

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"unicode/utf8"
)

const (
	maxMaskNameLen = 128
	maxMaskPoints  = 5000
)

var (
	ErrMaskNameEmpty     = errors.New("mask name must not be empty")
	ErrMaskNameTooLong   = fmt.Errorf("mask name must be at most %d characters", maxMaskNameLen)
	ErrMaskTooFewPoints  = errors.New("mask needs at least 2 distinct points")
	ErrMaskTooManyPoints = fmt.Errorf("mask can have at most %d points", maxMaskPoints)
	ErrMaskBadPoint      = errors.New("mask points must be finite numbers >= 0")
)

// NormalizeMaskName обрезает пробелы и проверяет длину имени.
func NormalizeMaskName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrMaskNameEmpty
	}
	if utf8.RuneCountInString(name) > maxMaskNameLen {
		return "", ErrMaskNameTooLong
	}
	return name, nil
}

// NormalizeMaskPoints приводит точки маски к каноническому виду: конечные
// неотрицательные числа с точностью до 0.001 с, по возрастанию, без дублей.
// Как в MAG-soft, маска должна содержать минимум две точки.
func NormalizeMaskPoints(in []float64) ([]float64, error) {
	if len(in) > maxMaskPoints {
		return nil, ErrMaskTooManyPoints
	}
	out := make([]float64, 0, len(in))
	for _, v := range in {
		if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
			return nil, ErrMaskBadPoint
		}
		out = append(out, math.Round(v*1000)/1000)
	}
	sort.Float64s(out)

	uniq := out[:0]
	for i, v := range out {
		if i == 0 || v != out[i-1] {
			uniq = append(uniq, v)
		}
	}
	if len(uniq) < 2 {
		return nil, ErrMaskTooFewPoints
	}
	return uniq, nil
}
