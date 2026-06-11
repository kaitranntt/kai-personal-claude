#!/bin/bash
# Build SKILL.md from SKILL.src.md by inlining all <!-- include: path --> references.
# Run this after editing SKILL.src.md or any reference file.
set -euo pipefail
cd "$(dirname "$0")"

SRC="SKILL.src.md"
OUT="SKILL.md"

if [[ ! -f "$SRC" ]]; then
  echo "[X] $SRC not found" >&2
  exit 1
fi

{
  IN_FRONTMATTER=0
  FRONTMATTER_DONE=0
  COMMENT_EMITTED=0
  while IFS= read -r line; do
    # Detect frontmatter boundaries (--- lines)
    if [[ "$line" == "---" && "$FRONTMATTER_DONE" -eq 0 ]]; then
      echo "$line"
      if [[ "$IN_FRONTMATTER" -eq 1 ]]; then
        # End of frontmatter -- emit auto-generated comment right after
        FRONTMATTER_DONE=1
        echo ""
        echo "<!-- AUTO-GENERATED from SKILL.src.md -- do not edit directly. Run ./build.sh to rebuild. -->"
        COMMENT_EMITTED=1
      else
        IN_FRONTMATTER=1
      fi
    elif [[ "$line" =~ \<!--\ include:\ (.+)\ --\> ]]; then
      ref="${BASH_REMATCH[1]}"
      if [[ ! -f "$ref" ]]; then
        echo "[X] Missing reference: $ref" >&2
        exit 1
      fi
      cat "$ref"
    else
      echo "$line"
    fi
  done < "$SRC"
  # Fallback if no frontmatter found
  if [[ "$COMMENT_EMITTED" -eq 0 ]]; then
    echo "<!-- AUTO-GENERATED from SKILL.src.md -- do not edit directly. Run ./build.sh to rebuild. -->"
  fi
} > "$OUT"

LINES=$(wc -l < "$OUT" | tr -d ' ')
BYTES=$(wc -c < "$OUT" | tr -d ' ')
echo "[OK] Built $OUT ($LINES lines, $BYTES bytes)"
