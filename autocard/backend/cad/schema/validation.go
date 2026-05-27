// mirrors cad/contracts/validation.ts
package schema

import "fmt"

type ValidationStage string

const (
	StageSchema             ValidationStage = "schema"
	StageStructural         ValidationStage = "structural"
	StageDomain             ValidationStage = "domain"
	StageConflict           ValidationStage = "conflict"
	StageDerivedConsistency ValidationStage = "derived-consistency"
)

type ValidationError struct {
	Stage   ValidationStage `json:"stage"`
	Code    string          `json:"code"`
	Message string          `json:"message"`
	NodeIDs []string        `json:"nodeIds,omitempty"`
	Field   string          `json:"field,omitempty"`
}

type ValidationResult struct {
	OK     bool              `json:"ok"`
	Errors []ValidationError `json:"errors,omitempty"`
}

// ValidatePatchSet runs schema and structural validation on a patch set.
// Domain and conflict validation is handled in the document service.
func ValidatePatchSet(ps *PatchSet) ValidationResult {
	var errs []ValidationError

	if ps.ID == "" {
		errs = append(errs, ValidationError{Stage: StageSchema, Code: "MISSING_ID", Message: "patchSet.id is required"})
	}
	if ps.DocumentID == "" {
		errs = append(errs, ValidationError{Stage: StageSchema, Code: "MISSING_DOC_ID", Message: "patchSet.documentId is required"})
	}
	if ps.BaseVersion < 0 {
		errs = append(errs, ValidationError{Stage: StageSchema, Code: "INVALID_VERSION", Message: "patchSet.baseVersion must be >= 0"})
	}
	if len(ps.Patches) == 0 {
		errs = append(errs, ValidationError{Stage: StageSchema, Code: "EMPTY_PATCHES", Message: "patchSet must contain at least one patch"})
	}

	for i, p := range ps.Patches {
		if p.Op == "" {
			errs = append(errs, ValidationError{
				Stage:   StageSchema,
				Code:    "MISSING_OP",
				Message: fmt.Sprintf("patches[%d].op is required", i),
			})
		}
		if (p.Op == OpUpdateNode || p.Op == OpDeleteNode) && p.NodeID == "" {
			errs = append(errs, ValidationError{
				Stage:   StageSchema,
				Code:    "MISSING_NODE_ID",
				Message: fmt.Sprintf("patches[%d].nodeId is required for op %s", i, p.Op),
			})
		}
	}

	if len(errs) > 0 {
		return ValidationResult{OK: false, Errors: errs}
	}
	return ValidationResult{OK: true}
}
