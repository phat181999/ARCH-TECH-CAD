// mirrors cad/contracts/patches.ts
package schema

import "encoding/json"

type PatchOp string

const (
	OpCreateNode         PatchOp = "create-node"
	OpUpdateNode         PatchOp = "update-node"
	OpDeleteNode         PatchOp = "delete-node"
	OpReorderRoot        PatchOp = "reorder-root"
	OpUpdateLayer        PatchOp = "update-layer"
	OpUpdateDerivedCache PatchOp = "update-derived-cache"
)

type DocumentPatch struct {
	Op      PatchOp                `json:"op"`
	NodeID  string                 `json:"nodeId,omitempty"`
	Node    json.RawMessage        `json:"node,omitempty"`
	Changes map[string]interface{} `json:"changes,omitempty"`
	Roots   []string               `json:"roots,omitempty"`
	LayerID string                 `json:"layerId,omitempty"`
	Layer   map[string]interface{} `json:"layer,omitempty"`
	Cache   map[string]interface{} `json:"cache,omitempty"`
}

type CommandActor struct {
	UserID    string `json:"userId"`
	Type      string `json:"type"`
	SessionID string `json:"sessionId,omitempty"`
}

// PatchSet mirrors cad/contracts/patches.ts PatchSet.
type PatchSet struct {
	ID          string          `json:"id"`
	DocumentID  string          `json:"documentId"`
	BaseVersion int             `json:"baseVersion"`
	Actor       CommandActor    `json:"actor"`
	Timestamp   int64           `json:"timestamp"`
	Patches     []DocumentPatch `json:"patches"`
	CommandID   string          `json:"commandId,omitempty"`
}

type CommittedPatchSet struct {
	PatchSet
	CommittedVersion int    `json:"committedVersion"`
	CommittedAt      string `json:"committedAt"`
}
