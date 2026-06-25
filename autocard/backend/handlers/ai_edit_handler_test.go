package handlers

import (
	"strconv"
	"testing"
)

func TestPruneElementsSmallDrawing(t *testing.T) {
	// Under 400 elements should be returned as-is
	elements := make([]map[string]interface{}, 150)
	for i := 0; i < 150; i++ {
		elements[i] = map[string]interface{}{
			"id":   strconv.Itoa(i),
			"type": "line",
		}
	}

	pruned := pruneElements(elements)
	if len(pruned) != 150 {
		t.Fatalf("expected 150 elements, got %d", len(pruned))
	}
}

func TestPruneElementsPruningBehavior(t *testing.T) {
	// Create 1000 elements: 300 walls/doors (architectural) and 700 lines (generic)
	elements := make([]map[string]interface{}, 0, 1000)
	for i := 0; i < 300; i++ {
		elements = append(elements, map[string]interface{}{
			"id":       "arch-" + strconv.Itoa(i),
			"type":     "wall",
			"archType": "wall",
		})
	}
	for i := 0; i < 700; i++ {
		elements = append(elements, map[string]interface{}{
			"id":   "other-" + strconv.Itoa(i),
			"type": "line",
		})
	}

	pruned := pruneElements(elements)
	// Budget is 800. Since we have 300 architectural, we should keep all 300,
	// and fill the remaining 500 budget with generic elements.
	if len(pruned) != 800 {
		t.Fatalf("expected exactly 800 elements, got %d", len(pruned))
	}

	archCount := 0
	otherCount := 0
	for _, el := range pruned {
		if el["type"] == "wall" {
			archCount++
		} else if el["type"] == "line" {
			otherCount++
		}
	}

	if archCount != 300 {
		t.Fatalf("expected 300 architectural elements, got %d", archCount)
	}
	if otherCount != 500 {
		t.Fatalf("expected 500 generic elements, got %d", otherCount)
	}
}

func TestPruneElementsArchOverBudget(t *testing.T) {
	// Create 1000 architectural elements
	elements := make([]map[string]interface{}, 0, 1000)
	for i := 0; i < 1000; i++ {
		elements = append(elements, map[string]interface{}{
			"id":       "arch-" + strconv.Itoa(i),
			"type":     "wall",
			"archType": "wall",
		})
	}

	pruned := pruneElements(elements)
	// Budget is 800. Since arch elements are 1000, we should limit to 800.
	if len(pruned) != 800 {
		t.Fatalf("expected exactly 800 elements, got %d", len(pruned))
	}

	for _, el := range pruned {
		if el["type"] != "wall" {
			t.Fatalf("expected only wall elements, got type %v", el["type"])
		}
	}
}
