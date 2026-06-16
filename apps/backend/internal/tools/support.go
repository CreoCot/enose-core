package tools

import (
	"math"
	"math/rand/v2"
)

func MakeData() [][]float64 {
	result := make([][]float64, 10)
	var rand_time float64 = 0.0
	var init float64 = 0.0

	for i := 0; i < 10; i++ {

		result[i] = append(result[i], init)
		rand_time = rand.Float64() * 100
		init += math.Round(rand_time) / math.Pow(10, float64(2))

		for range 8 {
			var rand float64 = math.Round(1000000*rand.Float64()) / math.Pow(10, float64(4))
			result[i] = append(result[i], rand)
		}

	}

	return result
}
