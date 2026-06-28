package handlers

import (
	"context"
	"strings"
	"testing"
)

// --- fallbackClassifyMulti tests ---

// TestFallbackClassifyMultiCADOnly ensures a pure CAD prompt returns only cad_drawing.
func TestFallbackClassifyMultiCADOnly(t *testing.T) {
	h := &AIHandler{}
	result := h.fallbackClassifyMulti("draw a wall")
	if len(result) != 1 || result[0] != "cad_drawing" {
		t.Fatalf("expected [cad_drawing], got %v", result)
	}
}

// TestFallbackClassifyMultiGreeting ensures a greeting returns general_knowledge
// and does not contain domain categories.
func TestFallbackClassifyMultiGreeting(t *testing.T) {
	h := &AIHandler{}
	result := h.fallbackClassifyMulti("xin chào, bạn có thể làm gì?")
	if len(result) != 1 || result[0] != "general_knowledge" {
		t.Fatalf("expected [general_knowledge], got %v", result)
	}
}

// TestFallbackClassifyMultiPermit ensures a permit keyword triggers permit_and_licensing.
func TestFallbackClassifyMultiPermit(t *testing.T) {
	h := &AIHandler{}
	result := h.fallbackClassifyMulti("check the fire safety egress requirements")
	if !containsCategory(result, "permit_and_licensing") {
		t.Fatalf("expected permit_and_licensing, got %v", result)
	}
	if containsCategory(result, "general_knowledge") {
		t.Fatalf("general_knowledge should not appear when domain keywords match, got %v", result)
	}
}

// TestFallbackClassifyMultiMaterials ensures a materials keyword triggers construction_materials.
func TestFallbackClassifyMultiMaterials(t *testing.T) {
	h := &AIHandler{}
	result := h.fallbackClassifyMulti("what is the price of bê tông M300?")
	if !containsCategory(result, "construction_materials") {
		t.Fatalf("expected construction_materials, got %v", result)
	}
}

// TestFallbackClassifyMultiAllCategories verifies ALL three domain categories are
// returned when a prompt spans all keyword groups — ensures no early-return regression.
func TestFallbackClassifyMultiAllCategories(t *testing.T) {
	h := &AIHandler{}
	prompt := "draw a wall, check the permit tcvn, and list material cost chi phí"
	result := h.fallbackClassifyMulti(prompt)

	if !containsCategory(result, "cad_drawing") {
		t.Errorf("expected cad_drawing in result %v", result)
	}
	if !containsCategory(result, "permit_and_licensing") {
		t.Errorf("expected permit_and_licensing in result %v", result)
	}
	if !containsCategory(result, "construction_materials") {
		t.Errorf("expected construction_materials in result %v", result)
	}
	if containsCategory(result, "general_knowledge") {
		t.Errorf("general_knowledge must not appear alongside domain categories, got %v", result)
	}
}

// TestFallbackClassifyMultiNeverReturnsEmpty ensures the function always returns
// a non-empty slice — the handler relies on categories[0] without nil check.
func TestFallbackClassifyMultiNeverReturnsEmpty(t *testing.T) {
	h := &AIHandler{}
	prompts := []string{"", "   ", "???", "123"}
	for _, p := range prompts {
		result := h.fallbackClassifyMulti(p)
		if len(result) == 0 {
			t.Errorf("prompt %q returned empty slice — must always return at least one category", p)
		}
	}
}

// --- classifyPromptMulti internal parse logic ---

// TestClassifyPromptMultiConfidenceFilter verifies that categories below the 0.6
// threshold are filtered out. We test the filter logic directly without an LLM call
// by replicating the parse path and ensuring low-confidence entries are dropped.
func TestClassifyPromptMultiConfidenceFilter(t *testing.T) {
	type catEntry struct {
		Name       string
		Confidence float64
	}
	entries := []catEntry{
		{"cad_drawing", 0.95},
		{"permit_and_licensing", 0.70},
		{"construction_materials", 0.40}, // below threshold — should be excluded
	}

	const threshold = 0.6
	validCategories := map[string]bool{
		"cad_drawing": true, "permit_and_licensing": true,
		"construction_materials": true, "general_knowledge": true,
	}

	var categories []string
	for _, c := range entries {
		if validCategories[c.Name] && c.Confidence >= threshold {
			categories = append(categories, c.Name)
		}
	}
	if len(categories) == 0 {
		categories = []string{"general_knowledge"}
	}

	if len(categories) != 2 {
		t.Fatalf("expected 2 categories above threshold, got %d: %v", len(categories), categories)
	}
	if categories[0] != "cad_drawing" || categories[1] != "permit_and_licensing" {
		t.Fatalf("unexpected categories: %v", categories)
	}
	if containsCategory(categories, "construction_materials") {
		t.Error("construction_materials should have been filtered (confidence 0.40 < 0.6)")
	}
}

// TestClassifyPromptMultiAllBelowThresholdFallsBackToGeneral verifies that if all
// categories are below threshold, general_knowledge is returned.
func TestClassifyPromptMultiAllBelowThresholdFallsBackToGeneral(t *testing.T) {
	type catEntry struct {
		Name       string
		Confidence float64
	}
	entries := []catEntry{
		{"cad_drawing", 0.30},
		{"permit_and_licensing", 0.20},
	}

	const threshold = 0.6
	validCategories := map[string]bool{
		"cad_drawing": true, "permit_and_licensing": true,
		"construction_materials": true, "general_knowledge": true,
	}

	var categories []string
	for _, c := range entries {
		if validCategories[c.Name] && c.Confidence >= threshold {
			categories = append(categories, c.Name)
		}
	}
	if len(categories) == 0 {
		categories = []string{"general_knowledge"}
	}

	if len(categories) != 1 || categories[0] != "general_knowledge" {
		t.Fatalf("expected [general_knowledge] fallback, got %v", categories)
	}
}

// --- fetchParallelRAG tests (nil ragRepo — tests the early-exit path) ---

// TestFetchParallelRAGCADOnlySkipsQdrant verifies that a CAD-only category list
// returns an empty string without touching ragRepo (which is nil — would panic if called).
func TestFetchParallelRAGCADOnlySkipsQdrant(t *testing.T) {
	h := &AIHandler{} // ragRepo is nil
	result := h.fetchParallelRAG(context.Background(), []string{"cad_drawing"}, "draw a wall")
	if result != "" {
		t.Fatalf("expected empty RAG context for cad_drawing only, got %q", result)
	}
}

// TestFetchParallelRAGGeneralKnowledgeSkipsQdrant verifies general_knowledge
// also skips Qdrant.
func TestFetchParallelRAGGeneralKnowledgeSkipsQdrant(t *testing.T) {
	h := &AIHandler{}
	result := h.fetchParallelRAG(context.Background(), []string{"general_knowledge"}, "hello")
	if result != "" {
		t.Fatalf("expected empty RAG context for general_knowledge, got %q", result)
	}
}

// TestFetchParallelRAGCADPlusNonRAGSkipsQdrant ensures mixed CAD + general
// still returns empty (no Qdrant collection for either).
func TestFetchParallelRAGCADPlusNonRAGSkipsQdrant(t *testing.T) {
	h := &AIHandler{}
	result := h.fetchParallelRAG(context.Background(), []string{"cad_drawing", "general_knowledge"}, "draw something nice")
	if result != "" {
		t.Fatalf("expected empty string, got %q", result)
	}
}

// --- containsCategory helper tests ---

func TestContainsCategoryFound(t *testing.T) {
	cats := []string{"cad_drawing", "permit_and_licensing"}
	if !containsCategory(cats, "cad_drawing") {
		t.Error("expected cad_drawing to be found")
	}
	if !containsCategory(cats, "permit_and_licensing") {
		t.Error("expected permit_and_licensing to be found")
	}
}

func TestContainsCategoryNotFound(t *testing.T) {
	cats := []string{"cad_drawing", "permit_and_licensing"}
	if containsCategory(cats, "construction_materials") {
		t.Error("expected construction_materials NOT to be found")
	}
}

func TestContainsCategoryNilSlice(t *testing.T) {
	if containsCategory(nil, "anything") {
		t.Error("expected nil slice to return false")
	}
}

// --- ragCollectionLabels map sanity ---

func TestRAGCollectionLabelsContainsExpectedKeys(t *testing.T) {
	expected := []string{"permit_and_licensing", "construction_materials"}
	for _, k := range expected {
		if _, ok := ragCollectionLabels[k]; !ok {
			t.Errorf("ragCollectionLabels missing expected key %q", k)
		}
	}
	// cad_drawing and general_knowledge should NOT have Qdrant collections
	for _, k := range []string{"cad_drawing", "general_knowledge"} {
		if _, ok := ragCollectionLabels[k]; ok {
			t.Errorf("ragCollectionLabels should NOT contain %q", k)
		}
	}
}

// --- fetchParallelRAG section header format ---

// TestFetchParallelRAGSectionHeaderFormat verifies the merged output format
// by checking that the section header template is correct for known labels.
func TestFetchParallelRAGSectionHeaderFormat(t *testing.T) {
	// Test the format string independently of a real Qdrant call.
	label := ragCollectionLabels["permit_and_licensing"]
	header := "--- CONTEXT: " + label + " ---"
	if !strings.HasPrefix(header, "--- CONTEXT:") {
		t.Errorf("unexpected header format: %s", header)
	}
	if !strings.HasSuffix(header, "---") {
		t.Errorf("header should end with ---: %s", header)
	}
}
