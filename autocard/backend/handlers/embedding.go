package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GetEmbedding calls OpenAI text-embedding-3-large and returns []float32.
func GetEmbedding(apiKey, text string) ([]float32, error) {
	body := map[string]interface{}{
		"model":      "text-embedding-3-large",
		"input":      text,
		"dimensions": 1536,
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/embeddings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embedding request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embedding API returned %d: %s", resp.StatusCode, string(respBytes))
	}

	var result struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse embedding response: %w", err)
	}
	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no embedding data in response")
	}
	return result.Data[0].Embedding, nil
}

// LinearizeLayout converts CAD elements to a DSL string for embedding.
func LinearizeLayout(elements []map[string]interface{}) string {
	var rooms []string
	var portals []string
	var totalWidth, totalHeight float64

	for _, el := range elements {
		elType, _ := el["type"].(string)
		archType, _ := el["archType"].(string)
		roomName, _ := el["roomName"].(string)
		roomType, _ := el["roomType"].(string)

		switch {
		case archType == "room" && elType == "text" && roomName != "":
			rooms = append(rooms, roomName)
		case archType == "door" || elType == "door":
			openingWidth := floatValue(el["openingWidth"])
			portals = append(portals, fmt.Sprintf("door(w=%.2fm)", openingWidth/100))
		case archType == "window" || elType == "window":
			portals = append(portals, "window")
		case roomType != "" && elType == "text":
			rooms = append(rooms, roomType)
		}

		if elType == "rectangle" {
			w := floatValue(el["width"])
			h := floatValue(el["height"])
			if w > totalWidth {
				totalWidth = w
			}
			if h > totalHeight {
				totalHeight = h
			}
		}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Layout: Width=%.0fpx, Length=%.0fpx.\n", totalWidth, totalHeight))
	if len(rooms) > 0 {
		sb.WriteString("Rooms: [" + strings.Join(rooms, ", ") + "].\n")
	}
	if len(portals) > 0 {
		sb.WriteString("Portals: [" + strings.Join(portals, ", ") + "].")
	}
	return sb.String()
}
