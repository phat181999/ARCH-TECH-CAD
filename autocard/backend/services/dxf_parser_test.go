package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseDXFMetadata(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}

	files := []string{
		"blocks_and_tables.dxf",
		"giraffe360_demo_commercial_1.dxf",
	}

	for _, fileName := range files {
		t.Run(fileName, func(t *testing.T) {
			testFilePath := filepath.Join(wd, "..", "..", "..", "rag-doc", "2d", fileName)
			contentBytes, err := os.ReadFile(testFilePath)
			if err != nil {
				t.Skipf("Skipping test: test file not found at %s. Error: %v", testFilePath, err)
				return
			}

			meta, err := ParseDXFMetadata(string(contentBytes), fileName)
			if err != nil {
				t.Fatalf("failed to parse DXF: %v", err)
			}

			if meta.FileName != fileName {
				t.Errorf("expected file name %s, got %s", fileName, meta.FileName)
			}

			t.Logf("Successfully parsed DXF file. Units: %s", meta.Units)
			t.Logf("Number of layers found: %d", len(meta.Layers))
			t.Logf("Number of text entities found: %d", len(meta.TextEntities))
			t.Logf("Number of block inserts found: %d", len(meta.BlockInserts))
			t.Logf("Entity counts: %v", meta.EntityCounts)
			t.Logf("Summary: %s", meta.Summary)
		})
	}
}
