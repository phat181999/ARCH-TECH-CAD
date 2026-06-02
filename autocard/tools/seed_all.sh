#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# seed_all.sh — Master RAG seeding script for ARCH-TECH-CAD
#
# Seeds the full knowledge base in order:
#   1. Vietnamese building rules  (building_rules_seed.json)
#   2. Vietnamese building codes  (knowledge/qcvn_*.txt)
#   3. International standards    (knowledge/neufert_standards.txt)
#   4. CAD component library      (cad_components_seed.json)
#
# Usage:
#   ./seed_all.sh                                    # prompts for confirmation
#   ./seed_all.sh --yes                              # auto-confirm all
#   ./seed_all.sh --url http://my-server:8080 --yes  # custom backend URL
#   ./seed_all.sh --dry-run                          # preview only
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-python3}"
SEED="${SCRIPT_DIR}/seed_rag.py"

# Parse flags
URL="http://localhost:8080"
EMAIL="admin@example.com"
PASSWORD="password123"
FLAGS=""

for arg in "$@"; do
  case "$arg" in
    --yes|-y)      FLAGS="$FLAGS --yes" ;;
    --dry-run)     FLAGS="$FLAGS --dry-run" ;;
    --url=*)       URL="${arg#--url=}" ;;
    --email=*)     EMAIL="${arg#--email=}" ;;
    --password=*)  PASSWORD="${arg#--password=}" ;;
    --url)         shift; URL="$1" ;;
    --email)       shift; EMAIL="$1" ;;
    --password)    shift; PASSWORD="$1" ;;
  esac
done

COMMON="--url $URL --email $EMAIL --password $PASSWORD $FLAGS"

echo "════════════════════════════════════════════════════════════"
echo "  ARCH-TECH-CAD RAG Seeder"
echo "  Backend: $URL"
echo "════════════════════════════════════════════════════════════"

# ── Step 1: Building Rules ────────────────────────────────────────────────────
RULES_FILE="${SCRIPT_DIR}/building_rules_seed.json"
if [ -f "$RULES_FILE" ]; then
  echo ""
  echo "▶ Step 1/4 — Vietnamese & International Building Rules"
  $PYTHON "$SEED" --rules "$RULES_FILE" $COMMON
else
  echo "[SKIP] building_rules_seed.json not found."
fi

# ── Step 2: QCVN Knowledge Chunks ────────────────────────────────────────────
echo ""
echo "▶ Step 2/4 — Vietnamese Building Code Knowledge Chunks (QCVN/TCVN)"
for f in \
  "${SCRIPT_DIR}/knowledge/qcvn_03_2022.txt" \
  "${SCRIPT_DIR}/knowledge/qcvn_06_2022.txt" \
  "${SCRIPT_DIR}/knowledge/qcvn_01_2021.txt" \
  "${SCRIPT_DIR}/knowledge/tcvn_4451_2012.txt"
do
  if [ -f "$f" ]; then
    TITLE=$(basename "$f" .txt | tr '_' ':' | tr '[:lower:]' '[:upper:]')
    echo "  → $TITLE"
    $PYTHON "$SEED" "$f" --title "$TITLE" $COMMON
  else
    echo "  [SKIP] $(basename $f) not found — download from moc.gov.vn or thuvienphapluat.vn"
  fi
done

# ── Step 3: Neufert & International Standards ─────────────────────────────────
echo ""
echo "▶ Step 3/4 — International Standards (Neufert)"
NEUFERT="${SCRIPT_DIR}/knowledge/neufert_standards.txt"
if [ -f "$NEUFERT" ]; then
  $PYTHON "$SEED" "$NEUFERT" --title "Neufert Architects Data" $COMMON
else
  echo "  [SKIP] neufert_standards.txt not found — download from archive.org/details/NeufertArchitectsData4thEdition"
fi

# ── Step 4: CAD Components ────────────────────────────────────────────────────
echo ""
echo "▶ Step 4/4 — CAD Component Library (Block Metadata)"
COMP_FILE="${SCRIPT_DIR}/cad_components_seed.json"
if [ ! -f "$COMP_FILE" ]; then
  echo "  Generating from blockLibrary.ts..."
  node "${SCRIPT_DIR}/generate_components_seed.mjs" 2>/dev/null || \
    echo "  [WARN] Could not auto-generate. Run: node autocard/tools/generate_components_seed.mjs"
fi
if [ -f "$COMP_FILE" ]; then
  $PYTHON "$SEED" --components "$COMP_FILE" $COMMON
else
  echo "  [SKIP] cad_components_seed.json not found."
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Seeding complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "To verify seeded data, query the RAG:"
echo "  curl -X POST $URL/api/rag/query \\"
echo "    -H 'Authorization: Bearer \$TOKEN' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"prompt\":\"phòng ngủ diện tích tối thiểu bao nhiêu m2\",\"elements\":[]}'"
