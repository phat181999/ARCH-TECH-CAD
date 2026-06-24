package services

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"autocard-backend/models"
)

// ──────────────────────────────────────────────────────────────────────────────
// Structs
// ──────────────────────────────────────────────────────────────────────────────

// DXFMetadata holds all metadata extracted from a DXF file for RAG indexing.
type DXFMetadata struct {
	FileName     string            `json:"file_name"`
	Units        string            `json:"units"`
	Layers       []LayerInfo       `json:"layers"`
	TextEntities []TextEntity      `json:"text_entities"`
	BlockInserts []BlockInsert     `json:"block_inserts"`
	Attributes   []BlockAttribute  `json:"block_attributes"`
	EntityCounts map[string]int    `json:"entity_counts"`
	Summary      string            `json:"summary"`
}

// LayerInfo describes a single DXF layer with entity count and arch classification.
type LayerInfo struct {
	Name     string `json:"name"`
	Count    int    `json:"count"`
	ArchType string `json:"arch_type"` // wall, door, window, slab, other
}

// TextEntity is a TEXT or MTEXT entity with cleaned content.
type TextEntity struct {
	Text  string  `json:"text"`
	Layer string  `json:"layer"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
}

// BlockInsert is an INSERT entity referencing a named block.
type BlockInsert struct {
	BlockName string  `json:"block_name"`
	Layer     string  `json:"layer"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
}

// BlockAttribute is an ATTRIB or ATTDEF entity with tag/value.
type BlockAttribute struct {
	Tag   string `json:"tag"`
	Value string `json:"value"`
	Layer string `json:"layer"`
}

// ──────────────────────────────────────────────────────────────────────────────
// Token-pair DXF reader (mirrors the frontend approach)
// ──────────────────────────────────────────────────────────────────────────────

type dxfReader struct {
	tokens []string
	pos    int
}

type dxfPair struct {
	code  int
	value string
}

func newDXFReader(content string) *dxfReader {
	return &dxfReader{
		tokens: strings.Split(content, "\n"),
		pos:    0,
	}
}

func (r *dxfReader) readPair() *dxfPair {
	if r.pos+1 >= len(r.tokens) {
		return nil
	}
	codeStr := strings.TrimSpace(strings.Replace(r.tokens[r.pos], "\r", "", -1))
	valStr := strings.TrimSpace(strings.Replace(r.tokens[r.pos+1], "\r", "", -1))
	r.pos += 2

	code, err := strconv.Atoi(codeStr)
	if err != nil {
		return nil
	}
	return &dxfPair{code: code, value: valStr}
}

func (r *dxfReader) pushBack() {
	if r.pos >= 2 {
		r.pos -= 2
	}
}

func (r *dxfReader) eof() bool {
	return r.pos+1 >= len(r.tokens)
}

// ──────────────────────────────────────────────────────────────────────────────
// Units mapping ($INSUNITS code → string)
// ──────────────────────────────────────────────────────────────────────────────

var insUnitsMap = map[int]string{
	0: "Unitless",
	1: "Inches",
	2: "Feet",
	3: "Miles",
	4: "mm",
	5: "cm",
	6: "m",
	7: "km",
}

func insUnitsToString(code int) string {
	if s, ok := insUnitsMap[code]; ok {
		return s
	}
	return "Unitless"
}

// ──────────────────────────────────────────────────────────────────────────────
// Layer arch-type classification (matches frontend inferArchTypeFromLayer)
// ──────────────────────────────────────────────────────────────────────────────

var (
	reWall   = regexp.MustCompile(`(?i)(WALL|TUONG|A[-_]WALL)`)
	reDoor   = regexp.MustCompile(`(?i)(DOOR|CUA|A[-_]DOOR|\bDR\b)`)
	reWindow = regexp.MustCompile(`(?i)(WIN(?:DOW)?|CUA[-_]SO|A[-_]GLAZ)`)
	reSlab   = regexp.MustCompile(`(?i)(FLOOR|SLAB|SAN|A[-_]FLOOR)`)
)

func inferArchType(layerName string) string {
	upper := strings.ToUpper(layerName)
	switch {
	case reWall.MatchString(upper):
		return "wall"
	case reWindow.MatchString(upper):
		return "window"
	case reDoor.MatchString(upper):
		return "door"
	case reSlab.MatchString(upper):
		return "slab"
	default:
		return "other"
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// MTEXT format-code cleaner
// ──────────────────────────────────────────────────────────────────────────────

var (
	reMtextFont  = regexp.MustCompile(`\\f[^;\\]*`)            // \fFont|b0|i0|c163|p34
	reMtextCodes = regexp.MustCompile(`\\[A-Za-z][^;\\]*;`)    // \A1; \H0.5x; etc.
	reMtextBreak = regexp.MustCompile(`\\[PpNn~]`)             // paragraph break / nbsp
	reMtextPipe  = regexp.MustCompile(`\|[a-z0-9]+`)           // leftover |b0|i0|c163
	reMtextMulti = regexp.MustCompile(`\s{2,}`)                // collapse spaces
)

func cleanMtext(raw string) string {
	s := reMtextFont.ReplaceAllString(raw, "")
	s = reMtextCodes.ReplaceAllString(s, " ")
	s = reMtextBreak.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, `\\`, `\`) // escaped backslash
	s = strings.ReplaceAll(s, "{", "")
	s = strings.ReplaceAll(s, "}", "")
	s = reMtextPipe.ReplaceAllString(s, "")
	s = reMtextMulti.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

// ──────────────────────────────────────────────────────────────────────────────
// Main parser
// ──────────────────────────────────────────────────────────────────────────────

// ParseDXFMetadata parses a DXF file's text content and extracts metadata
// suitable for RAG indexing. It does NOT render geometry — only extracts
// structural metadata (layers, text, blocks, counts).
//
// The parser is intentionally robust: malformed input returns partial results
// rather than errors.
func ParseDXFMetadata(dxfContent string, fileName string) (*DXFMetadata, error) {
	if strings.TrimSpace(dxfContent) == "" {
		return nil, fmt.Errorf("dxf content is empty")
	}

	r := newDXFReader(dxfContent)
	meta := &DXFMetadata{
		FileName:     fileName,
		Units:        "Unitless",
		Layers:       []LayerInfo{},
		TextEntities: []TextEntity{},
		BlockInserts: []BlockInsert{},
		Attributes:   []BlockAttribute{},
		EntityCounts: make(map[string]int),
	}

	// Layer entity counts accumulated during entity parsing.
	layerCounts := make(map[string]int)
	// Set of layer names from the TABLES section.
	declaredLayers := make(map[string]bool)

	for !r.eof() {
		p := r.readPair()
		if p == nil {
			break
		}
		// Look for section start: code 0, value "SECTION"
		if p.code != 0 || p.value != "SECTION" {
			continue
		}
		nameP := r.readPair()
		if nameP == nil {
			break
		}

		switch nameP.value {
		case "HEADER":
			parseHeader(r, meta)
		case "TABLES":
			parseTables(r, declaredLayers)
		case "BLOCKS":
			parseBlocks(r, meta, layerCounts)
		case "ENTITIES":
			parseEntitySection(r, meta, layerCounts)
		default:
			// Skip unknown sections
			skipToEndSec(r)
		}
	}

	// Build Layers slice: merge declared layers with counted layers.
	allLayers := make(map[string]bool)
	for l := range declaredLayers {
		allLayers[l] = true
	}
	for l := range layerCounts {
		allLayers[l] = true
	}
	for name := range allLayers {
		meta.Layers = append(meta.Layers, LayerInfo{
			Name:     name,
			Count:    layerCounts[name],
			ArchType: inferArchType(name),
		})
	}

	meta.GenerateSummary()
	return meta, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Section parsers
// ──────────────────────────────────────────────────────────────────────────────

// parseHeader scans the HEADER section for $INSUNITS and $DWGCODEPAGE.
func parseHeader(r *dxfReader, meta *DXFMetadata) {
	for !r.eof() {
		p := r.readPair()
		if p == nil {
			break
		}
		if p.code == 0 && p.value == "ENDSEC" {
			return
		}
		// $INSUNITS: variable header code 9, followed by 70/<value>
		if p.code == 9 && p.value == "$INSUNITS" {
			vp := r.readPair()
			if vp != nil && vp.code == 70 {
				code, err := strconv.Atoi(vp.value)
				if err == nil {
					meta.Units = insUnitsToString(code)
				}
			}
		}
		// $DWGCODEPAGE is informational; we store it but don't transform text.
		// Could be extended for VNI detection in the future.
	}
}

// parseTables scans the TABLES section for LAYER table entries.
func parseTables(r *dxfReader, declaredLayers map[string]bool) {
	for !r.eof() {
		p := r.readPair()
		if p == nil {
			break
		}
		if p.code == 0 && p.value == "ENDSEC" {
			return
		}
		// Layer entries appear as: 0/LAYER ... 2/<name>
		if p.code == 0 && p.value == "LAYER" {
			layerName := ""
			for !r.eof() {
				lp := r.readPair()
				if lp == nil {
					break
				}
				if lp.code == 0 {
					r.pushBack()
					break
				}
				if lp.code == 2 {
					layerName = lp.value
				}
			}
			if layerName != "" {
				declaredLayers[layerName] = true
			}
		}
	}
}

// parseBlocks scans the BLOCKS section; only parses *Model_Space entities.
func parseBlocks(r *dxfReader, meta *DXFMetadata, layerCounts map[string]int) {
	for !r.eof() {
		p := r.readPair()
		if p == nil {
			break
		}
		if p.code == 0 && p.value == "ENDSEC" {
			return
		}
		if p.code != 0 || p.value != "BLOCK" {
			continue
		}
		// Read block header to get block name (code 2).
		blockName := ""
		for !r.eof() {
			hp := r.readPair()
			if hp == nil {
				break
			}
			if hp.code == 0 {
				r.pushBack()
				break
			}
			if hp.code == 2 {
				blockName = hp.value
			}
		}

		isModelSpace := strings.EqualFold(blockName, "*Model_Space") ||
			strings.EqualFold(blockName, "*MODELSPACE") ||
			strings.EqualFold(blockName, "*MODEL_SPACE")

		if isModelSpace {
			parseEntitiesRun(r, meta, layerCounts)
		} else {
			// Skip to ENDBLK
			for !r.eof() {
				sp := r.readPair()
				if sp == nil {
					break
				}
				if sp.code == 0 && sp.value == "ENDBLK" {
					break
				}
			}
		}
	}
}

// parseEntitySection parses the top-level ENTITIES section.
func parseEntitySection(r *dxfReader, meta *DXFMetadata, layerCounts map[string]int) {
	parseEntitiesRun(r, meta, layerCounts)
}

// skipToEndSec advances the reader past the next ENDSEC marker.
func skipToEndSec(r *dxfReader) {
	for !r.eof() {
		p := r.readPair()
		if p == nil {
			return
		}
		if p.code == 0 && p.value == "ENDSEC" {
			return
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Entity-run parser (shared between ENTITIES and *Model_Space BLOCK)
// ──────────────────────────────────────────────────────────────────────────────

// parseEntitiesRun reads entities until ENDSEC or ENDBLK.
// It populates meta.TextEntities, meta.BlockInserts, meta.Attributes,
// meta.EntityCounts and layerCounts.
func parseEntitiesRun(r *dxfReader, meta *DXFMetadata, layerCounts map[string]int) {
	for !r.eof() {
		p := r.readPair()
		if p == nil {
			break
		}
		if p.code == 0 && (p.value == "ENDSEC" || p.value == "ENDBLK") {
			return
		}
		if p.code != 0 {
			continue
		}

		entityType := p.value
		// Collect all group codes for this entity until the next code-0.
		props := make(map[int]string)
		layer := "0"

		for !r.eof() {
			ep := r.readPair()
			if ep == nil {
				break
			}
			if ep.code == 0 {
				r.pushBack()
				break
			}
			if ep.code == 8 {
				layer = ep.value
			}
			props[ep.code] = ep.value
		}

		// Count the entity.
		meta.EntityCounts[entityType]++
		layerCounts[layer]++

		// Extract metadata depending on entity type.
		switch entityType {
		case "LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "ELLIPSE", "SPLINE":
			// Already counted above — no extra metadata to extract.

		case "TEXT":
			text := props[1]
			if text != "" {
				meta.TextEntities = append(meta.TextEntities, TextEntity{
					Text:  text,
					Layer: layer,
					X:     parseFloatSafe(props[10]),
					Y:     parseFloatSafe(props[20]),
				})
			}

		case "MTEXT":
			raw := props[1]
			text := cleanMtext(raw)
			if text != "" {
				meta.TextEntities = append(meta.TextEntities, TextEntity{
					Text:  text,
					Layer: layer,
					X:     parseFloatSafe(props[10]),
					Y:     parseFloatSafe(props[20]),
				})
			}

		case "INSERT":
			blockName := props[2]
			// Skip paper-space markers (*Paper_Space, *Viewport...)
			if blockName != "" && !strings.HasPrefix(blockName, "*") {
				meta.BlockInserts = append(meta.BlockInserts, BlockInsert{
					BlockName: blockName,
					Layer:     layer,
					X:         parseFloatSafe(props[10]),
					Y:         parseFloatSafe(props[20]),
				})
			}

		case "ATTRIB", "ATTDEF":
			tag := props[2]
			value := props[1]
			if tag != "" || value != "" {
				meta.Attributes = append(meta.Attributes, BlockAttribute{
					Tag:   tag,
					Value: value,
					Layer: layer,
				})
			}

		case "DIMENSION":
			dimText := props[1]
			if dimText != "" {
				meta.TextEntities = append(meta.TextEntities, TextEntity{
					Text:  dimText,
					Layer: layer,
					X:     parseFloatSafe(props[10]),
					Y:     parseFloatSafe(props[20]),
				})
			}
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Summary generation
// ──────────────────────────────────────────────────────────────────────────────

// GenerateSummary creates a natural-language summary of the DXF metadata,
// suitable for embedding as a RAG knowledge chunk.
func (m *DXFMetadata) GenerateSummary() {
	var b strings.Builder

	// Opening line
	b.WriteString(fmt.Sprintf("Architectural drawing '%s' (units: %s).", m.FileName, m.Units))

	// Layer breakdown by arch type
	wallCount, doorCount, windowCount, slabCount := 0, 0, 0, 0
	wallLayers, doorLayers, windowLayers := []string{}, []string{}, []string{}
	for _, l := range m.Layers {
		switch l.ArchType {
		case "wall":
			wallCount += l.Count
			if l.Count > 0 {
				wallLayers = append(wallLayers, l.Name)
			}
		case "door":
			doorCount += l.Count
			if l.Count > 0 {
				doorLayers = append(doorLayers, l.Name)
			}
		case "window":
			windowCount += l.Count
			if l.Count > 0 {
				windowLayers = append(windowLayers, l.Name)
			}
		case "slab":
			slabCount += l.Count
		}
	}

	if wallCount > 0 || doorCount > 0 || windowCount > 0 || slabCount > 0 {
		b.WriteString(" Contains")
		parts := []string{}
		if wallCount > 0 {
			detail := fmt.Sprintf(" %d wall entities", wallCount)
			if len(wallLayers) > 0 {
				detail += fmt.Sprintf(" on %s", strings.Join(wallLayers, ", "))
			}
			parts = append(parts, detail)
		}
		if doorCount > 0 {
			parts = append(parts, fmt.Sprintf(" %d doors", doorCount))
		}
		if windowCount > 0 {
			parts = append(parts, fmt.Sprintf(" %d windows", windowCount))
		}
		if slabCount > 0 {
			parts = append(parts, fmt.Sprintf(" %d slab/floor entities", slabCount))
		}
		b.WriteString(strings.Join(parts, ","))
		b.WriteString(".")
	}

	// Text labels
	if len(m.TextEntities) > 0 {
		b.WriteString(" Text labels:")
		maxLabels := 15
		if len(m.TextEntities) < maxLabels {
			maxLabels = len(m.TextEntities)
		}
		labels := make([]string, 0, maxLabels)
		for i := 0; i < maxLabels; i++ {
			labels = append(labels, m.TextEntities[i].Text)
		}
		b.WriteString(" " + strings.Join(labels, ", "))
		if len(m.TextEntities) > maxLabels {
			b.WriteString(fmt.Sprintf(" (and %d more)", len(m.TextEntities)-maxLabels))
		}
		b.WriteString(".")
	}

	// Block inserts (components)
	if len(m.BlockInserts) > 0 {
		// Count occurrences of each block name
		blockCounts := make(map[string]int)
		for _, bi := range m.BlockInserts {
			blockCounts[bi.BlockName]++
		}
		b.WriteString(" Components:")
		parts := []string{}
		for name, count := range blockCounts {
			parts = append(parts, fmt.Sprintf(" %dx %s", count, name))
		}
		maxParts := 10
		if len(parts) < maxParts {
			maxParts = len(parts)
		}
		b.WriteString(strings.Join(parts[:maxParts], ","))
		if len(parts) > maxParts {
			b.WriteString(fmt.Sprintf(" (and %d more block types)", len(parts)-maxParts))
		}
		b.WriteString(".")
	}

	// Total entity summary
	totalEntities := 0
	for _, c := range m.EntityCounts {
		totalEntities += c
	}
	b.WriteString(fmt.Sprintf(" Total entities: %d across %d layers.", totalEntities, len(m.Layers)))

	m.Summary = b.String()
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge chunk generation for RAG
// ──────────────────────────────────────────────────────────────────────────────

// ToKnowledgeChunks creates multiple KnowledgeChunk records from the parsed
// DXF metadata. These are ready for embedding (the caller sets Embedding).
func (m *DXFMetadata) ToKnowledgeChunks(tenantID string) []models.KnowledgeChunk {
	metaJSON := mustMarshal(map[string]string{
		"source_type": "dxf_upload",
		"file_type":   "dxf",
		"units":       m.Units,
	})

	var chunks []models.KnowledgeChunk

	// 1. Summary chunk
	chunks = append(chunks, models.KnowledgeChunk{
		TenantID:          tenantID,
		DocumentTitle:     m.FileName,
		SectionIdentifier: "summary",
		Content:           m.Summary,
		Metadata:          metaJSON,
	})

	// 2. Layers chunk
	if len(m.Layers) > 0 {
		var lb strings.Builder
		lb.WriteString(fmt.Sprintf("Layers in '%s':\n", m.FileName))
		for _, l := range m.Layers {
			lb.WriteString(fmt.Sprintf("- %s (type: %s, entities: %d)\n", l.Name, l.ArchType, l.Count))
		}
		chunks = append(chunks, models.KnowledgeChunk{
			TenantID:          tenantID,
			DocumentTitle:     m.FileName,
			SectionIdentifier: "layers",
			Content:           lb.String(),
			Metadata:          metaJSON,
		})
	}

	// 3. Text content chunk
	if len(m.TextEntities) > 0 {
		var tb strings.Builder
		tb.WriteString(fmt.Sprintf("Text content in '%s':\n", m.FileName))
		maxText := 100 // cap to avoid huge chunks
		if len(m.TextEntities) < maxText {
			maxText = len(m.TextEntities)
		}
		for i := 0; i < maxText; i++ {
			te := m.TextEntities[i]
			tb.WriteString(fmt.Sprintf("- \"%s\" (layer: %s, pos: %.1f, %.1f)\n", te.Text, te.Layer, te.X, te.Y))
		}
		if len(m.TextEntities) > maxText {
			tb.WriteString(fmt.Sprintf("... and %d more text entities\n", len(m.TextEntities)-maxText))
		}
		chunks = append(chunks, models.KnowledgeChunk{
			TenantID:          tenantID,
			DocumentTitle:     m.FileName,
			SectionIdentifier: "text_content",
			Content:           tb.String(),
			Metadata:          metaJSON,
		})
	}

	// 4. Components chunk (block inserts + attributes)
	if len(m.BlockInserts) > 0 || len(m.Attributes) > 0 {
		var cb strings.Builder
		cb.WriteString(fmt.Sprintf("Components in '%s':\n", m.FileName))

		if len(m.BlockInserts) > 0 {
			// Aggregate by block name
			blockCounts := make(map[string]int)
			blockLayers := make(map[string]string)
			for _, bi := range m.BlockInserts {
				blockCounts[bi.BlockName]++
				blockLayers[bi.BlockName] = bi.Layer
			}
			cb.WriteString("Block inserts:\n")
			for name, count := range blockCounts {
				cb.WriteString(fmt.Sprintf("- %s x%d (layer: %s)\n", name, count, blockLayers[name]))
			}
		}

		if len(m.Attributes) > 0 {
			cb.WriteString("Attributes:\n")
			maxAttrs := 50
			if len(m.Attributes) < maxAttrs {
				maxAttrs = len(m.Attributes)
			}
			for i := 0; i < maxAttrs; i++ {
				a := m.Attributes[i]
				cb.WriteString(fmt.Sprintf("- %s = %s (layer: %s)\n", a.Tag, a.Value, a.Layer))
			}
			if len(m.Attributes) > maxAttrs {
				cb.WriteString(fmt.Sprintf("... and %d more attributes\n", len(m.Attributes)-maxAttrs))
			}
		}

		chunks = append(chunks, models.KnowledgeChunk{
			TenantID:          tenantID,
			DocumentTitle:     m.FileName,
			SectionIdentifier: "components",
			Content:           cb.String(),
			Metadata:          metaJSON,
		})
	}

	return chunks
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

func parseFloatSafe(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func mustMarshal(v interface{}) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(b)
}
