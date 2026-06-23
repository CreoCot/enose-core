package tools

import (
	"context"
	"encoding/xml"
	"fmt"
	"math"
	"math/rand/v2"
	"strconv"
	"strings"
	"time"

	par "github.com/CreoCot/enose-core/backend/internal/services"

	conf "github.com/CreoCot/enose-core/backend/internal/config"
)

type CommaFloat float64

type Measure struct {
	XMLName     xml.Name `xml:"measure"`
	Name        string   `xml:"name"`
	Description string   `xml:"description"`
	Length      int      `xml:"length"`
	Ismeasured  string   `xml:"ismeasured"`
	Mask        int      `xml:"mask"`
	Start       string   `xml:"start"`
	Sensors     []struct {
		SID     string     `xml:"sid,attr"`
		Initial CommaFloat `xml:"initial,attr"`
		Point   []struct {
			Time  CommaFloat `xml:"time,attr"`
			Value CommaFloat `xml:"value,attr"`
		} `xml:"point"`
	} `xml:"sensor"`
}

func (f *CommaFloat) UnmarshalXMLAttr(attr xml.Attr) error {
	val := strings.TrimSpace(strings.Replace(attr.Value, ",", ".", 1))
	if val == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return fmt.Errorf("Failed to parse number: %s, error: %w", attr.Value, err)
	}

	*f = CommaFloat(parsed)
	return nil
}

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

func ProvideParsedMeasurement(cfg *conf.Config) (*par.ParsedMeasurement, error) {
	c := par.NewParserClient(cfg.ParserURL, cfg.ParserAPI)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	err := c.Health(ctx)
	if err != nil {
		return nil, err
	}

	xmlData := sampleXMLData

	if len(xmlData) == 0 {
		return nil, fmt.Errorf("embedded XML file is empty")
	}

	// if err != nil {
	// 	return nil, fmt.Errorf("get absolute path (tried to get: %s ): %w", path, err)
	// }

	result, err := c.ParseFile(ctx, "sample_lemon.XML", xmlData)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func ProvideMeasurements() (Measure, error) {
	xmlData := sampleXMLData
	if len(xmlData) == 0 {
		return Measure{}, fmt.Errorf("embedded XML file is empty")
	}
	// if err != nil {
	// 	return Measure{}, fmt.Errorf("File not found, err: %w", err)
	// }

	var m Measure
	err := xml.Unmarshal(xmlData, &m)
	if err != nil {
		return Measure{}, fmt.Errorf("Failed to unmarchal xml data, error: %w", err)
	}

	return m, nil
}

func GetDataForTable() ([][]float64, int, error) {
	data, timestamp, length, err := GetDataForPlots()
	if err != nil {
		return nil, 0, err
	}

	new_data := make([][]float64, len(data[0]))

	for ind := range new_data {
		new_data[ind] = append(new_data[ind], timestamp[ind])
	}

	for ind := range data {
		for ind2 := range data[0] {
			new_data[ind2] = append(new_data[ind2], data[ind][ind2])
		}
	}

	return new_data, length, nil
}

func GetDataForPlots() ([][]float64, []float64, int, error) {

	meas, err := ProvideMeasurements()
	if err != nil || meas.Sensors == nil || meas.Sensors[0].Point == nil {
		return nil, nil, 0, err

	}

	length := len(meas.Sensors)
	var timestamp []float64
	data := make([][]float64, length)

	for ind, val := range meas.Sensors {

		for _, el := range val.Point {
			if ind == 0 {
				timestamp = append(timestamp, float64(el.Time))
			}
			data[ind] = append(data[ind], float64(el.Value))
		}
	}

	return data, timestamp, length, nil

}

// func main() {
// 	cfg, err := conf.NewConfig()
// 	if err != nil {
// 		slog.Error("Failed to load configuration", "error", err)
// 		os.Exit(1)
// 	}

// 	meas, err := ProvideParsedMeasurement(cfg)
// 	if err != nil {
// 		slog.Error("Failed to provide parsed measurement", "error", err)
// 		os.Exit(1)
// 	}

// 	fmt.Println(meas)

// }
