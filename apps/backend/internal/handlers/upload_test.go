package handlers

import "testing"

func TestExtractSID(t *testing.T) {
	tests := []struct {
		name  string
		label string
		want  string // "" means nil expected
	}{
		{"xml bare sid", "SID0001", "SID0001"},
		{"csv name with bracketed sid", "Датчик 1 [SID0001]", "SID0001"},
		{"csv ascii name with bracketed sid", "Sensor 1 [SID0008]", "SID0008"},
		{"no sid at all", "Sensor 1", ""},
		{"empty label", "", ""},
		{"lowercase sid not matched", "sensor [sid0001]", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractSID(tt.label)
			if tt.want == "" {
				if got != nil {
					t.Fatalf("extractSID(%q) = %q, want nil", tt.label, *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("extractSID(%q) = nil, want %q", tt.label, tt.want)
			}
			if *got != tt.want {
				t.Fatalf("extractSID(%q) = %q, want %q", tt.label, *got, tt.want)
			}
		})
	}
}
