package services

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// DWGConverter wraps external CLI tools (LibreDWG's dwg2dxf or ODA File Converter)
// to convert DWG files to DXF format.
type DWGConverter struct {
	toolPath string
	toolType string // "dwg2dxf" or "oda"
}

// NewDWGConverter auto-detects an available DWG-to-DXF converter on the system.
// It checks for dwg2dxf (LibreDWG) first, then ODAFileConverter.
// If neither is found, the converter is marked as unavailable.
func NewDWGConverter() *DWGConverter {
	// Try LibreDWG's dwg2dxf first
	if path, err := exec.LookPath("dwg2dxf"); err == nil {
		slog.Info("DWG converter found", "tool", "dwg2dxf", "path", path)
		return &DWGConverter{toolPath: path, toolType: "dwg2dxf"}
	}

	// Try ODA File Converter
	if path, err := exec.LookPath("ODAFileConverter"); err == nil {
		slog.Info("DWG converter found", "tool", "ODAFileConverter", "path", path)
		return &DWGConverter{toolPath: path, toolType: "oda"}
	}

	slog.Warn("No DWG converter found. DWG-to-DXF conversion will be unavailable.")
	return &DWGConverter{}
}

// IsAvailable returns true if a converter tool was found on the system.
func (c *DWGConverter) IsAvailable() bool {
	return c.toolPath != ""
}

// Convert takes raw DWG file data and a filename, converts it to DXF format,
// and returns the DXF content as a string.
func (c *DWGConverter) Convert(dwgData []byte, fileName string) (string, error) {
	if !c.IsAvailable() {
		return "", fmt.Errorf(
			"DWG conversion is not available. Please install LibreDWG (dwg2dxf) or ODA File Converter, or convert your DWG to DXF manually.",
		)
	}

	// Create a temp directory for the conversion
	tmpDir, err := os.MkdirTemp("", "dwg-convert-*")
	if err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Ensure the file has a .dwg extension
	if !strings.HasSuffix(strings.ToLower(fileName), ".dwg") {
		fileName = fileName + ".dwg"
	}

	// Write the DWG data to a temp file
	inputPath := filepath.Join(tmpDir, fileName)
	if err := os.WriteFile(inputPath, dwgData, 0644); err != nil {
		return "", fmt.Errorf("failed to write temp DWG file: %w", err)
	}

	slog.Info("Converting DWG to DXF", "tool", c.toolType, "file", fileName)

	// Run the converter
	var cmd *exec.Cmd
	var outputDir string

	switch c.toolType {
	case "dwg2dxf":
		cmd = exec.Command(c.toolPath, inputPath)
		outputDir = tmpDir
	case "oda":
		outputDir = filepath.Join(tmpDir, "output")
		if err := os.MkdirAll(outputDir, 0755); err != nil {
			return "", fmt.Errorf("failed to create output directory: %w", err)
		}
		cmd = exec.Command(c.toolPath, tmpDir, outputDir, "ACAD2018", "DXF", "0", "0", "*.dwg")
	default:
		return "", fmt.Errorf("unknown converter type: %s", c.toolType)
	}

	// Capture stderr for error reporting
	var stderr strings.Builder
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		errOutput := stderr.String()
		slog.Error("DWG conversion failed", "tool", c.toolType, "error", err, "stderr", errOutput)
		return "", fmt.Errorf("DWG conversion failed: %s", errOutput)
	}

	// Find the output .dxf file
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	dxfPath := filepath.Join(outputDir, baseName+".dxf")

	dxfFile, err := os.Open(dxfPath)
	if err != nil {
		return "", fmt.Errorf("conversion completed but DXF output file not found: %w", err)
	}
	defer dxfFile.Close()

	dxfBytes, err := io.ReadAll(dxfFile)
	if err != nil {
		return "", fmt.Errorf("failed to read DXF output: %w", err)
	}

	slog.Info("DWG conversion successful", "file", fileName, "dxfSize", len(dxfBytes))
	return string(dxfBytes), nil
}
