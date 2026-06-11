# GitHub Issue & Decomposition

Steps 3, 3.5 of the maintainer workflow.

## Step 3: GitHub Issue — Create or Claim

### Claim Existing Issue (if issue URL was provided as input)

Before creating a worktree, ensure the issue is properly claimed upstream so others can see we're working on it.

```bash
# Parse issue number and repo from URL
ISSUE_NUM=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')
REPO_NWO=$(echo "$ISSUE_URL" | sed 's|.*/\([^/]*/[^/]*\)/issues/.*|\1|')

# Fetch current issue state (already done in Step 1, reuse $ISSUE_JSON)
# Check assignment -- assign to @me if not already assigned
CURRENT_USER=$(gh api user --jq .login)
if ! echo "$ISSUE_JSON" | jq -e --arg u "$CURRENT_USER" '.assignees[] | select(.login == $u)' > /dev/null 2>&1; then
  gh issue edit "$ISSUE_NUM" -R "$REPO_NWO" --add-assignee "@me"
fi

# Add classification label if missing (verify label exists first)
LABEL=$([ "$CLASSIFICATION" = "BUG" ] && echo "bug" || echo "enhancement")
REPO_LABELS=$(gh label list -R "$REPO_NWO" --json name --jq '.[].name')
if echo "$REPO_LABELS" | grep -qx "$LABEL"; then
  if ! echo "$ISSUE_JSON" | jq -e ".labels[] | select(.name == \"$LABEL\")" > /dev/null 2>&1; then
    gh issue edit "$ISSUE_NUM" -R "$REPO_NWO" --add-label "$LABEL"
  fi
fi
```

After claiming, skip to **Step 4** (worktree creation). Do NOT create a new issue.

**Skip entirely if `--skip-issue`.**

### Create New Issue (if no issue URL provided)

**Skip if `--skip-issue`.**

Determine the correct repo from the affected code paths. Use `gh issue create`:

**Issue writing rules:**
- English only, brief and concise -- no lengthy descriptions
- Never reference internal reports, brainstorm outputs, or plan file locations
- Never include personal info (usernames, emails, real names) -- keep neutral and technical
- No "Proposed Fix" / "Proposed Solutions" section -- keep issue focused on the problem only

```bash
cd <REPO_ABSOLUTE_PATH> && gh issue create \
  --title "<type>: <concise description>" \
  --assignee "@me" \
  --label "<appropriate-label>" \
  --body-file - <<'EOF'
## Description
<brief problem summary>

## Root Cause
<concise findings from debug step>

## Affected Files
- <file1>
- <file2>
EOF
```

Use `AskUserQuestion` to confirm issue title and labels before creation.
Save the issue number for the worktree branch name.

**Only if `--decompose` is active or auto-detection triggered** -- fetch parent issue ID (needed for sub-issue linking in Step 3.5):
```bash
# Get parent issue ID (numeric ID, not issue number)
# REST API sub-issues endpoint needs this ID, not the issue number
PARENT_ID=$(gh api repos/${OWNER}/${REPO}/issues/${PARENT_NUM} --jq '.id')

# Also get node_id if GraphQL fallback needed
PARENT_NODE_ID=$(gh api repos/${OWNER}/${REPO}/issues/${PARENT_NUM} --jq '.node_id')
```

## Step 3.5: Decompose Complex Issue (--decompose only)

**Skip if:** Not triggered by `--decompose` flag or auto-detection.

### Decomposition Process

**1. Analyze findings** into logical work streams:
- Group affected files by domain/concern
- Identify dependencies between streams
- Mark which streams can run in parallel

**2. Create sub-issues on GitHub and link to parent:**

> **CRITICAL: Issue ID vs Issue Number**
> GitHub's sub-issues API requires the actual **numeric issue ID** (e.g., `4263129383`), NOT the issue number (e.g., `992`).
> Get the ID via: `gh api repos/{owner}/{repo}/issues/{number} --jq '.id'`

```bash
# Create sub-issue (no "Sub-task of" text -- GitHub UI shows relationship natively)
CHILD_URL=$(gh issue create -R {REPO} \
  --title "{type}: {parent-title} -- {stream-description}" \
  --assignee "@me" \
  --label "{appropriate-label}" \
  --body-file - <<'EOF'
## Scope
{files in this stream}

## Approach
{specific fix for this stream}
EOF
)
CHILD_NUM=$(echo "$CHILD_URL" | grep -o '[0-9]*$')

# Get actual issue ID (NOT issue number!) -- REST API requires numeric ID
CHILD_ID=$(gh api repos/${OWNER}/${REPO}/issues/${CHILD_NUM} --jq '.id')

# Link child to parent via REST API (preferred -- simpler than GraphQL)
LINK_RESULT=$(gh api repos/${OWNER}/${REPO}/issues/${PARENT_NUM}/sub_issues \
  -X POST \
  --input - <<< "{\"sub_issue_id\": $CHILD_ID}" 2>&1)

# Check for errors
if echo "$LINK_RESULT" | grep -q '"message"'; then
  echo "[!] Sub-issue linking failed for #${CHILD_NUM}"
  echo "    Error: $(echo "$LINK_RESULT" | jq -r '.message // .')"
  
  # Fallback: add body reference
  gh issue edit "$CHILD_NUM" -R {REPO} \
    --body "Part of #${PARENT_NUM}

$(original body)"
else
  echo "[OK] Linked #${CHILD_NUM} as sub-issue of #${PARENT_NUM}"
fi
```

**Alternative: GraphQL API** (use if REST fails)
```bash
# Fetch node IDs (GraphQL requires node_id, not numeric id)
PARENT_NODE_ID=$(gh api repos/${OWNER}/${REPO}/issues/${PARENT_NUM} --jq '.node_id')
CHILD_NODE_ID=$(gh api repos/${OWNER}/${REPO}/issues/${CHILD_NUM} --jq '.node_id')

# Link via GraphQL mutation
gh api graphql -H GraphQL-Features:sub_issues \
  -f parentId="$PARENT_NODE_ID" -f childId="$CHILD_NODE_ID" \
  -f query='mutation($parentId: ID!, $childId: ID!) {
    addSubIssue(input: { issueId: $parentId, subIssueId: $childId }) {
      issue { title number }
      subIssue { title number }
    }
  }'
```

**3. Create worktree per sub-issue:**
Activate `/worktree` for each sub-issue.
Each worktree branch: `{prefix}/{type}/{parent-issue}-{stream-slug}`

**4. Launch parallel agents by classification** (max 4):

Route per sub-issue using the Flag Routing Matrix. Each agent inherits active flags (`--tdd`, `--parallel`, `--deep`) from the parent invocation.

- **BUG (default):** Spawn `/fix --parallel` via Task tool for each sub-issue in its worktree.
- **BUG + --tdd:** Spawn `/fix --parallel` with TDD substeps for each sub-issue.
- **FEATURE (default):** Spawn `/cook --auto` via Task tool for each sub-issue. Include instruction: "Skip git commit at finalize."
- **FEATURE + --tdd:** Spawn `/cook --auto --tdd` for each sub-issue.
- **FEATURE + --parallel:** Spawn `/cook --parallel` for each sub-issue (each agent internally uses multi-agent execution).

Pass: sub-issue description, affected files, approach from decomposition, active flags.

**5. Collect results:**
Wait for all agents to complete. Each agent commits to its own branch.
Report summary of all streams.

**After decomposition:** Skip Steps 4-5 (already handled above). Continue to Step 5.5.

**PR strategy for decomposed issues:**
- One PR per sub-issue targeting `dev`
- Each PR references parent issue: "Part of #{PARENT}"
- Final PR closes parent: "Closes #{PARENT}"

---

## Epic Creation Workflow

When creating an epic (parent issue) with multiple child issues, use GitHub's sub-issues API.

### Key Concepts

| Term | Description |
|------|-------------|
| **Issue Number** | Human-readable number (e.g., `#992`) -- used in URLs and UI |
| **Issue ID** | Numeric database ID (e.g., `4263129383`) -- required by sub-issues REST API |
| **Node ID** | GraphQL identifier (e.g., `I_kwDOQNfRWc7-GjEn`) -- required by GraphQL API |

### Create Epic + Link Sub-Issues

```bash
OWNER=$(gh repo view --json owner --jq .owner.login)
REPO=$(gh repo view --json name --jq .name)

# 1. Create parent epic
EPIC_URL=$(gh issue create -R ${OWNER}/${REPO} \
  --title "epic: Feature name" \
  --assignee "@me" \
  --label "enhancement" \
  --body-file - <<'EOF'
## Overview
Brief description of the epic.

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
EOF
)
EPIC_NUM=$(echo "$EPIC_URL" | grep -o '[0-9]*$')
echo "Created epic #${EPIC_NUM}"

# 2. Create child issues (example: 3 children)
CHILDREN=(
  "feat: Part 1 description"
  "feat: Part 2 description"
  "test: Part 3 tests"
)

for title in "${CHILDREN[@]}"; do
  CHILD_URL=$(gh issue create -R ${OWNER}/${REPO} \
    --title "$title" \
    --assignee "@me" \
    --body "Part of #${EPIC_NUM}")
  CHILD_NUM=$(echo "$CHILD_URL" | grep -o '[0-9]*$')
  
  # Get actual issue ID (NOT issue number!)
  CHILD_ID=$(gh api repos/${OWNER}/${REPO}/issues/${CHILD_NUM} --jq '.id')
  
  # Link as sub-issue
  gh api repos/${OWNER}/${REPO}/issues/${EPIC_NUM}/sub_issues \
    -X POST \
    --input - <<< "{\"sub_issue_id\": $CHILD_ID}" \
    --silent && echo "Linked #${CHILD_NUM} to epic #${EPIC_NUM}"
done
```

### Link Existing Issues to Epic

```bash
EPIC_NUM=991
CHILDREN=(992 993 994 995 998 999 1000 1001 1002)

for child_num in "${CHILDREN[@]}"; do
  # Get actual issue ID (critical: NOT the issue number!)
  child_id=$(gh api repos/${OWNER}/${REPO}/issues/${child_num} --jq '.id')
  
  # Link via REST API
  gh api repos/${OWNER}/${REPO}/issues/${EPIC_NUM}/sub_issues \
    -X POST \
    --input - <<< "{\"sub_issue_id\": $child_id}" \
    --silent && echo "Added #${child_num} as sub-issue" || echo "Failed #${child_num}"
done
```

### Verify Sub-Issues

```bash
# List all sub-issues of an epic
gh api repos/${OWNER}/${REPO}/issues/${EPIC_NUM}/sub_issues \
  --jq '.[] | "#\(.number): \(.title)"'

# Check sub-issue count and progress
gh api repos/${OWNER}/${REPO}/issues/${EPIC_NUM} \
  --jq '.sub_issues_summary | "Total: \(.total), Completed: \(.completed), Progress: \(.percent_completed)%"'
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `"sub_issue_id" is not of type integer` | Passed issue number instead of ID | Use `gh api .../issues/{num} --jq '.id'` |
| `"sub_issue_id" is not of type integer` (with string) | Used `-f` instead of `--input` | Use `--input - <<< '{"sub_issue_id": 123}'` |
| `Not Found (404)` | Wrong repo or issue doesn't exist | Verify repo and issue number |
| `Resource not accessible` | Missing permissions | Check `gh auth status` scope |
