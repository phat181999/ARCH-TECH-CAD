package handlers

import "testing"

func TestParsePlanRequestExtractsHouseDimensionsAndDoorWidth(t *testing.T) {
	req := parsePlanRequest("Draw a 10x12m house with a bedroom and a 1m door")

	if !req.IsRectangularHouse {
		t.Fatalf("expected house prompt to be recognized")
	}
	if req.WidthMeters != 10 || req.HeightMeters != 12 {
		t.Fatalf("expected 10x12m footprint, got %.2fx%.2f", req.WidthMeters, req.HeightMeters)
	}
	if req.DoorWidthMeters != 1 {
		t.Fatalf("expected 1m door, got %.2f", req.DoorWidthMeters)
	}
	if req.BedroomCount != 1 {
		t.Fatalf("expected one bedroom requirement to be recognized, got %d", req.BedroomCount)
	}
}

func TestParsePlanRequestExtractsMultipleRooms(t *testing.T) {
	req := parsePlanRequest("Draw a 12x16m rectangular house floor plan with two bedrooms, a living room, and a 1.2m front door")

	if req.BedroomCount != 2 {
		t.Fatalf("expected two bedrooms, got %d", req.BedroomCount)
	}
	if !req.HasLivingRoom {
		t.Fatalf("expected living room requirement to be recognized")
	}
	if req.DoorWidthMeters != 1.2 {
		t.Fatalf("expected 1.2m door, got %.2f", req.DoorWidthMeters)
	}
}

func TestGenerateHousePlanKeepsDoorProportionalToFootprint(t *testing.T) {
	req := planRequest{
		IsRectangularHouse: true,
		WidthMeters:        10,
		HeightMeters:       12,
		DoorWidthMeters:    1,
		BedroomCount:       1,
	}

	elements, err := generateHousePlan(req)
	if err != nil {
		t.Fatalf("generateHousePlan returned error: %v", err)
	}

	outer, ok := findElementByLabel(elements, "House 10.0m x 12.0m")
	if !ok {
		t.Fatalf("expected outer footprint label")
	}

	door, ok := findElementByLabel(elements, "Door 1.0m")
	if !ok {
		t.Fatalf("expected door label")
	}

	outerWidth, ok := outer["width"].(float64)
	if !ok {
		t.Fatalf("outer rectangle missing width")
	}
	doorRadius, ok := door["radius"].(float64)
	if !ok {
		t.Fatalf("door arc missing radius")
	}

	ratio := doorRadius / outerWidth
	expected := 0.1
	if ratio < expected-0.02 || ratio > expected+0.02 {
		t.Fatalf("expected door/house width ratio around %.2f, got %.4f", expected, ratio)
	}

	if _, ok := findElementByText(elements, "Bedroom 1"); !ok {
		t.Fatalf("expected bedroom label")
	}
}

func findElementByLabel(elements []map[string]interface{}, label string) (map[string]interface{}, bool) {
	for _, el := range elements {
		if el["label"] == label {
			return el, true
		}
	}
	return nil, false
}

func findElementByText(elements []map[string]interface{}, text string) (map[string]interface{}, bool) {
	for _, el := range elements {
		if el["text"] == text {
			return el, true
		}
	}
	return nil, false
}
