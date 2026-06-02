package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"autocard-backend/models"
)

// ComplianceResult holds the outcome of a single rule evaluation.
type ComplianceResult struct {
	RuleID      string `json:"rule_id"`
	Passed      bool   `json:"passed"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Details     string `json:"details"`
}

// EvaluateRules checks all supplied building rules against the elements.
func EvaluateRules(elements []map[string]interface{}, rules []models.BuildingRule) []ComplianceResult {
	results := make([]ComplianceResult, 0, len(rules))
	for _, rule := range rules {
		result := evaluateRule(elements, rule)
		results = append(results, result)
	}
	return results
}

func evaluateRule(elements []map[string]interface{}, rule models.BuildingRule) ComplianceResult {
	base := ComplianceResult{
		RuleID:      rule.ID,
		Severity:    rule.Severity,
		Description: rule.Description,
		Passed:      true,
	}

	var params map[string]interface{}
	if err := json.Unmarshal(rule.Parameters, &params); err != nil {
		base.Passed = false
		base.Details = "invalid rule parameters"
		return base
	}

	switch rule.RuleType {
	case "min_area":
		base = evalMinArea(base, elements, rule.TargetElement, params)
	case "min_width":
		base = evalMinWidth(base, elements, rule.TargetElement, params)
	case "max_occupancy":
		base = evalMaxOccupancy(base, elements, rule.TargetElement, params)
	case "egress_count":
		base = evalEgressCount(base, elements, params)
	case "door_swing_clearance":
		base = evalDoorSwingClearance(base, elements, params)
	default:
		base.Details = fmt.Sprintf("unknown rule_type: %s", rule.RuleType)
	}

	return base
}

// evalMinArea: find rooms of target type, compute area, compare to parameters.value_m2.
func evalMinArea(base ComplianceResult, elements []map[string]interface{}, target string, params map[string]interface{}) ComplianceResult {
	minAreaM2 := floatValue(params["value_m2"])
	if minAreaM2 <= 0 {
		base.Details = "value_m2 not specified"
		return base
	}

	// Pixel-to-meter scale: assume 100px = 1m (consistent with canvas units)
	const pxPerMeter = 100.0
	const pxPerM2 = pxPerMeter * pxPerMeter

	targetLower := strings.ToLower(target)
	found := false
	for _, el := range elements {
		if !matchesTarget(el, targetLower) {
			continue
		}
		if el["type"] != "rectangle" {
			continue
		}
		found = true
		w := floatValue(el["width"])
		h := floatValue(el["height"])
		areaM2 := (w * h) / pxPerM2
		if areaM2 < minAreaM2 {
			base.Passed = false
			base.Details = fmt.Sprintf("%.1f m² < required %.1f m²", areaM2, minAreaM2)
			return base
		}
	}

	if !found {
		base.Details = fmt.Sprintf("no %s elements found", target)
		return base
	}
	base.Details = fmt.Sprintf("all %s elements meet minimum area of %.1f m²", target, minAreaM2)
	return base
}

// evalMinWidth: check wall/corridor width >= parameters.value_mm / 1000.
func evalMinWidth(base ComplianceResult, elements []map[string]interface{}, target string, params map[string]interface{}) ComplianceResult {
	minWidthMM := floatValue(params["value_mm"])
	if minWidthMM <= 0 {
		base.Details = "value_mm not specified"
		return base
	}
	minWidthM := minWidthMM / 1000.0
	const pxPerMeter = 100.0

	targetLower := strings.ToLower(target)
	found := false
	for _, el := range elements {
		if !matchesTarget(el, targetLower) {
			continue
		}
		found = true
		var widthPx float64
		if el["type"] == "line" {
			x1 := floatValue(el["x1"])
			y1 := floatValue(el["y1"])
			x2 := floatValue(el["x2"])
			y2 := floatValue(el["y2"])
			dx := x2 - x1
			dy := y2 - y1
			// Wall thickness stored directly, or infer from geometry
			if wt, ok := el["wallThickness"]; ok {
				widthPx = floatValue(wt)
			} else {
				widthPx = math.Sqrt(dx*dx+dy*dy) * 0.1 // fallback heuristic
			}
		} else if el["type"] == "rectangle" {
			widthPx = math.Min(floatValue(el["width"]), floatValue(el["height"]))
		}
		widthM := widthPx / pxPerMeter
		if widthM < minWidthM {
			base.Passed = false
			base.Details = fmt.Sprintf("%.3f m < required %.3f m", widthM, minWidthM)
			return base
		}
	}

	if !found {
		base.Details = fmt.Sprintf("no %s elements found", target)
		return base
	}
	base.Details = fmt.Sprintf("all %s elements meet minimum width of %.0f mm", target, minWidthMM)
	return base
}

// evalMaxOccupancy: check room count does not exceed parameters.max_rooms.
func evalMaxOccupancy(base ComplianceResult, elements []map[string]interface{}, target string, params map[string]interface{}) ComplianceResult {
	maxRooms := int(floatValue(params["max_rooms"]))
	if maxRooms <= 0 {
		base.Details = "max_rooms not specified"
		return base
	}
	targetLower := strings.ToLower(target)
	count := 0
	for _, el := range elements {
		if matchesTarget(el, targetLower) {
			count++
		}
	}
	if count > maxRooms {
		base.Passed = false
		base.Details = fmt.Sprintf("%d rooms exceeds maximum of %d", count, maxRooms)
		return base
	}
	base.Details = fmt.Sprintf("%d rooms within limit of %d", count, maxRooms)
	return base
}

// evalEgressCount: count exit doors >= parameters.min_exits.
func evalEgressCount(base ComplianceResult, elements []map[string]interface{}, params map[string]interface{}) ComplianceResult {
	minExits := int(floatValue(params["min_exits"]))
	if minExits <= 0 {
		base.Details = "min_exits not specified"
		return base
	}
	count := 0
	for _, el := range elements {
		archType, _ := el["archType"].(string)
		elType, _ := el["type"].(string)
		if archType == "door" || elType == "door" {
			count++
		}
	}
	if count < minExits {
		base.Passed = false
		base.Details = fmt.Sprintf("found %d exits, need at least %d", count, minExits)
		return base
	}
	base.Details = fmt.Sprintf("%d exits meets minimum of %d", count, minExits)
	return base
}

// evalDoorSwingClearance: check all doors have opening width >= parameters.min_width_mm / 1000m.
func evalDoorSwingClearance(base ComplianceResult, elements []map[string]interface{}, params map[string]interface{}) ComplianceResult {
	minWidthMM := floatValue(params["min_width_mm"])
	if minWidthMM <= 0 {
		base.Details = "min_width_mm not specified"
		return base
	}
	const pxPerMeter = 100.0
	minWidthPx := (minWidthMM / 1000.0) * pxPerMeter

	found := false
	for _, el := range elements {
		archType, _ := el["archType"].(string)
		elType, _ := el["type"].(string)
		if archType != "door" && elType != "door" {
			continue
		}
		found = true
		openingWidth := floatValue(el["openingWidth"])
		if openingWidth > 0 && openingWidth < minWidthPx {
			base.Passed = false
			base.Details = fmt.Sprintf("door opening %.0fpx < required %.0fpx", openingWidth, minWidthPx)
			return base
		}
	}

	if !found {
		base.Details = "no door elements found"
		return base
	}
	base.Details = fmt.Sprintf("all doors meet clearance of %.0f mm", minWidthMM)
	return base
}

// matchesTarget checks if an element matches the target type string.
// Checks archType, label, roomType, roomName, and element type.
func matchesTarget(el map[string]interface{}, targetLower string) bool {
	archType, _ := el["archType"].(string)
	roomType, _ := el["roomType"].(string)
	roomName, _ := el["roomName"].(string)
	elType, _ := el["type"].(string)
	label, _ := el["label"].(string)
	name, _ := el["name"].(string)

	return strings.Contains(strings.ToLower(archType), targetLower) ||
		strings.Contains(strings.ToLower(label), targetLower) ||
		strings.Contains(strings.ToLower(name), targetLower) ||
		strings.Contains(strings.ToLower(roomType), targetLower) ||
		strings.Contains(strings.ToLower(roomName), targetLower) ||
		strings.Contains(strings.ToLower(elType), targetLower)
}
