---
description: "Daily maintainer workflow -- triage, GitHub issue, worktree, fix, PR, review feedback loop. BUG/FEATURE auto-classify."
---

<!-- AUTO-GENERATED from SKILL.src.md -- do not edit directly. Run ./build.sh to rebuild. -->

# Maintainer - Daily Issue Resolution Pipeline

End-to-end issue triage and resolution pipeline for daily maintenance work.

**Language rule:** ALL output (conversation, reports, issues, PRs, commits) MUST be in English. If user input is in another language, translate and process in English. Never switch languages mid-conversation.

## Arguments

| Flag | Description |
|------|-------------|
| *(input)* | User report, transcript, image, GitHub issue URL, or plain description |
| `--tdd` | Tests-first: write regression tests before code changes, verify after |
| `--parallel` | Multi-agent parallel execution (plan with file ownership → cook with parallel agents) |
| `--deep` | Deep analysis: per-area scouting + thorough research before implementation |
| `--force-ui` | Hard-gate UI evidence: block PR until screenshots/report exist and are user-approved |
| `--skip-issue` | Skip GitHub issue creation (issue already exists) |
| `--skip-worktree` | Skip worktree creation (already in dedicated branch) |
| `--pr-main` | Target PR to `main` instead of `dev` |
| `--decompose` | Decompose into parallel sub-issues with separate worktrees (auto-suggested if >3 files across >2 domains) |
| `--scan-reviews` | Standalone mode: scan open PRs for unresolved review feedback |
| `--from-signals` | Observe-only intake: read drift/submodule/CI/issues/PRs via the suggester, rank, and suggest the next target. Read-only, no autonomy, no cron. |
| `--max-fix-attempts N` | Max review feedback loop iterations (default: 5) |
| `--no-review-loop` | Skip review feedback loop after PR creation |
| `"PR done"` | Post-merge cleanup: terminate worktree(s) + branches |

**Composable flags:** `--tdd`, `--parallel`, `--deep`, `--force-ui` can combine (e.g., `--parallel --tdd --force-ui`).

## Auto-Classification

Analyze input and classify as BUG or FEATURE:

| Type | Signals | Route |
|------|---------|-------|
| **BUG** | "broken", "error", "crash", "doesn't work", "regression", label:`bug` | Step 1a -> Step 2 -> Step 5 (/fix) |
| **FEATURE** | "add", "new", "would be nice", "enhance", "improve", label:`feat`/`enhancement` | Step 2.5 -> Step 3 -> Step 4 -> Step 5 (/cook) |
| *Ambiguous* | Default to BUG (safer, less overhead) | Step 1a -> Step 2 |

**Track issue origin:** Remember if GitHub issue was created by this workflow (Step 3) or provided by user input. Affects auto-sync in Step 5.5.

## Flag Routing Matrix

Flags propagate to underlying skills. Step 5 uses this matrix to select the right invocation:

| Classification | No flags | `--tdd` | `--parallel` | `--deep` | `--parallel --deep` | `--parallel --tdd` |
|---|---|---|---|---|---|---|
| **BUG** | `/fix --parallel` | `/fix --parallel` + TDD | `/ck:plan --parallel` → `/cook --parallel` | `/ck:plan --deep` → `/cook --auto` | `/ck:plan --deep` → `/cook --parallel` | `/ck:plan --parallel --tdd` → `/cook --parallel --tdd` |
| **FEATURE** | `/cook --auto` | `/cook --auto --tdd` | `/ck:plan --parallel` → `/cook --parallel` | `/ck:plan --deep` → `/cook` | `/ck:plan --deep` → `/cook --parallel` | `/ck:plan --parallel --tdd` → `/cook --parallel --tdd` |

**Key rules:**
- `--parallel` or `--deep` always insert a `/ck:plan` step before implementation (even for BUGs)
- `--deep` controls **planning thoroughness** (per-area scouting); `--parallel` controls **execution strategy** (multi-agent). They're orthogonal — `--parallel --deep` means "plan deeply, execute in parallel"
- `--tdd` appends to whatever implementation skill is invoked
- `--decompose` is orthogonal: splits into sub-issues with separate worktrees (uses the above routing per sub-issue)
- When plan step runs, cook MUST stop before its finalize step — maintainer owns git ops (see Cook Finalize Gate in `implement-and-pr.md`)

## Workflow

```
Input (report/image/transcript/URL)
  |
  v
[0] --from-signals?
  |              |
  YES            NO
  |              |
  v              |
[0a] Signal      |
     intake:     |
     run         |
     suggester,  |
     rank        |
     candidates, |
     USER picks  |
     target      |
     (read-only) |
  |              |
  +------+-------+
         |
         v
[1] Auto-classify: BUG or FEATURE?
  |                       |
  BUG                     FEAT
  |                       |
  v                       | (skip brainstorm/debug)
[1a] /brainstorm          |
  |                       |
  v                       |
[2] /debug                |
  |                       |
  +--------+--------------+
           |
           v
[2.5] Complexity check (--decompose?)
  |                    |
  SIMPLE               COMPLEX
  |                    |
  v                    v
[3] GitHub Issue    [3+3.5] Parent + Sub-issues
       (create or claim)
  |                    |
  v                    v
[4] /worktree       Worktree per sub-issue
  |                    |
  v                    v
[4.5] Flag routing: --parallel/--deep → /ck:plan step
  |                    |
  v                    v
[5] Route by Flag Routing Matrix:
    Default BUG:  /fix --parallel
    Default FEAT: /cook --auto
    --parallel:   /cook --parallel
    --deep:       /cook --auto
    +--tdd:       append --tdd
  |                    |
  +--------+-----------+
           |
           v
[5.5] GitHub progress comment
  |
  v
[6] /preview --explain (MANDATORY)
  |
  v
[7] /code-review codebase --parallel (optional)
  |
  v
[7.5] UI diff evidence + PR body (conditional)
  |
  v
[8] PR to dev --- Closes #N
  |
  v
[8.5] Review feedback loop (poll upstream + self /code-review -> /fix --parallel -> descriptive commits -> push -> repeat)
  |
  v
[9] "PR done" --- cleanup worktrees + branches
```

## Step Reference Map

| Step | Name | Skip If |
|------|------|---------|
| 0, 0a | Signal Intake (observe-only) | Not `--from-signals` |
| 1, 1a | Triage & Classify | -- |
| 2, 2.5 | Debug & Complexity | FEATURE path (skip 2, keep 2.5) |
| 3, 3.5 | GitHub Issue (Create or Claim) & Decompose | `--skip-issue` |
| 4 | Worktree | `--skip-worktree` or `--decompose` (3.5 handles) |
| 4.5 | Plan (flag-gated) | No `--parallel`/`--deep` flags |
| 5, 5.5 | Implement (flag-routed) & Update | `--decompose` (3.5 handles) |
| 6, 7, 8 | Review & PR | -- |
| 7.5 | UI Evidence & PR Composition | Non-UI change AND no `--force-ui` |
| 8.5 | Review Feedback Loop | `--no-review-loop` |
| 9 | Cleanup | -- |
| -- | Scan Reviews Mode | Not `--scan-reviews` |

## File Location Rules

**All reports, brainstorm outputs, and plans MUST be saved in the TARGET REPO's `plans/` directory**, NOT in the worktree directory. Worktrees are for code changes only. Reports persist locally in the repo for backward debugging reference.

---

# Signal-Driven Intake (Step 0 / 0a)

Observe-only intake activated by `--from-signals`. Surfaces what needs attention,
ranks it, and lets the USER pick the target. The chosen target becomes the input
to Step 1 (Auto-classify).

**This mode is strictly read-only.** No autonomy, no cron, no auto-pick, no
ck-loop. It never branches, commits, pushes, edits files, or opens a worktree.
Maintainer owns git ops -- this step only reads and suggests.

## Step 0 -- Gate

- If `--from-signals` is present, run Step 0a (signal intake) below, then feed
  the user's chosen target into Step 1.
- If `--from-signals` is absent, skip straight to Step 1 using whatever input the
  user provided.

**Fallback when neither applies:** if there is no `--from-signals` flag AND no
input (report / image / transcript / URL / description), ask the user what they
want to work on (or suggest re-running with `--from-signals`). Do not guess a
target, and do not run the suggester unless `--from-signals` was passed.

## Step 0a -- Signal Intake

1. From the target repo root, run the bundled read-only suggester. It ships
   with this skill at `scripts/maintainer-status.cjs` -- resolve the absolute
   path from this skill's base directory (shown when the skill is invoked):
   ```bash
   node "<skill-base-dir>/scripts/maintainer-status.cjs" --suggest --json
   ```
   This helper only reads state (drift logs, submodule status, CI, open
   issues/PRs). It does not mutate anything.

2. Parse the JSON. Contract:
   ```json
   {
     "timestamp": "...",
     "root": "...",
     "topTarget": <first candidate or null>,
     "candidates": [
       {
         "type": "ci-failure|external-source-drift|submodule-dirt|open-issues|open-prs",
         "priority": "CRITICAL|HIGH|MEDIUM|LOW",
         "count": N,
         "targets": [ ... ],
         "guidance": "..."
       }
     ]
   }
   ```
   Candidates arrive in priority order: CI > drift > submodule > issues > PRs.
   `topTarget` is the first (highest-priority) candidate, or `null` when nothing
   needs attention.

3. Present a ranked list to the user (topTarget first), one line per candidate
   showing type, priority, count, and guidance.

4. Ask the user which candidate to address. The user may instead override with a
   fresh target -- a GitHub issue URL or a plain description. Never auto-pick,
   even when there is only one candidate or a clear `topTarget`.

5. On pick, hand the chosen target to Step 1 (Auto-classify) as the input. From
   there, the normal BUG/FEATURE pipeline takes over.

## Example presented list

```
Signal intake (read-only). Pick a target -- I will NOT choose for you.

  1. [CRITICAL] ci-failure (1)     -- main build red on <repo>; rerun or triage
  2. [HIGH]     external-source-drift (3) -- 3 vendored source pins behind upstream
  3. [MEDIUM]   submodule-dirt (1) -- <submodule> has uncommitted local work
  4. [LOW]      open-issues (4)    -- 4 unassigned issues awaiting triage
  5. [LOW]      open-prs (2)       -- 2 PRs awaiting review

Which one should I take? (number, a GitHub issue URL, or describe a target)
```

When the suggester reports no candidates (`topTarget: null`, empty `candidates`),
state that nothing needs attention and ask whether the user wants to provide a
target manually.

---

# Triage & Classification

Steps 1, 1a, 2, 2.5 of the maintainer workflow.

## Step 1: Triage & Classify

**If input is an image:** Look at it directly (Claude is multimodal -- no need for external tools).
**If input is a GitHub issue URL:** Fetch via `gh issue view <number> --json title,body,state,url,labels,assignees`.
**If input is a transcript/report:** Parse and summarize.

**Routing:**
- **BUG** -> Step 1a (Brainstorm) -> Step 2 (Debug) -> Step 4.5? (Plan if --parallel/--deep) -> Step 5 (/fix or /cook)
- **FEATURE** -> Step 2.5 (Complexity) -> Step 3 (Issue) -> Step 4.5? (Plan if --parallel/--deep) -> Step 5 (/cook)

## Step 1a: Brainstorm & Debug (BUG path only)

**Skip if:** FEATURE path.

Activate `/brainstorm` with the extracted context to:
- Understand the problem scope
- Identify affected components
- Determine severity and priority
- Agree on approach
- **Prove root cause** -- must show concrete evidence (code path, log, repro steps) that confirms the hypothesis. If brainstorm alone can't prove it, pair with `/debug` to validate before proceeding.

**Brainstorm report -> save to ROOT repo `plans/` directory, not worktree.**

If the issue is trivial (typo, one-liner), skip brainstorm and go to Step 2.

Then proceed to **Step 2** (Debug).

## Step 2: Debug & Root Cause Analysis (BUG path only)

**Skip if:** FEATURE path.

Activate `/debug` skill to:
- Investigate the root cause
- Identify affected files and code paths
- Document findings
- **Confirm or refute** the hypothesis from Step 1a with evidence

Produce a concise diagnosis summary for the GitHub issue.

## Step 2.5: Complexity Check

Evaluate whether this issue needs decomposition:

**Auto-detection heuristic:**
- **BUG:** Count affected files from debug findings
- **FEATURE:** Count affected files from input context (issue body, user description)
- Group by top-level directory (e.g., `src/api/`, `src/db/`, `src/ui/`)
- If >3 files AND >2 groups -> suggest decomposition via `AskUserQuestion`

**Trigger:** Explicit `--decompose` flag OR auto-detection suggests it.

- **SIMPLE** (default) -> Continue to Step 3 (single issue flow)
- **COMPLEX** (`--decompose`) -> Continue to Step 3 then Step 3.5 (decomposed flow)

---

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

---

# Implementation, Review & PR

Steps 4, 4.5, 5, 5.5, 6, 7, 8 of the maintainer workflow.

## Step 4: Create Worktree (MANDATORY)

**Skip if:** `--decompose` triggered (Step 3.5 handles worktrees) or `--skip-worktree`.
**Worktree is REQUIRED for all maintainer work. NEVER make code changes directly on the original repo directory.**
**`--skip-worktree` is only allowed when already inside a dedicated worktree/branch.**

Activate `/worktree` command with the issue context:
- Slug derived from issue title (e.g., `fix-duplicate-nav-links`)
- Prefix auto-detected from issue type (bug -> fix, feat -> feat, etc.)
- If issue number available, include in slug: `fix-123-duplicate-nav-links`

**CRITICAL — Hotfix branch origin (`--pr-main` only):**
When `--pr-main` is used, the worktree MUST be created from `main`, NOT from `dev`:
```bash
git worktree add ../worktrees/<name> -b <branch-prefix>/hotfix/<slug> origin/main
```
Branching from `dev` causes dev-only commits (dev release tags, `chore: merge main into dev`) to leak into the main branch merge, triggering unexpected production releases. This has caused phantom version bumps in the past (a hotfix branch from dev carried dev history into main).

After worktree creation, `cd` into the worktree directory for code work.

## Step 4.5: Plan (Flag-Gated)

**Run if:** `--parallel` or `--deep` flag is set. Otherwise skip to Step 5.

When these flags are present, a planning step runs BEFORE implementation — even for BUGs. This ensures file ownership boundaries (--parallel) or per-area scouting (--deep) are established before agents start writing code.

### Flag → Plan Mode

| Maintainer Flag | Plan Invocation |
|---|---|
| `--parallel` | `/ck:plan --parallel <issue-context>` |
| `--deep` | `/ck:plan --deep <issue-context>` |
| `--parallel --deep` | `/ck:plan --deep <issue-context>` (deep subsumes parallel's research) |
| `--parallel --tdd` | `/ck:plan --parallel --tdd <issue-context>` |
| `--deep --tdd` | `/ck:plan --deep --tdd <issue-context>` |

**Plan context to provide:**
- Issue description and classification (BUG/FEATURE)
- Root cause + affected files (from debug step, if BUG)
- Feature requirements (if FEATURE)
- Repo docs paths (`codebase-summary.md`, `code-standards.md`, etc.)

**Plan output:** Plan directory with `plan.md` + `phase-XX-*.md` files. Save to ROOT repo `plans/` dir (not worktree).

**After plan:** Proceed to Step 5 using plan path.

## Step 5: Implement (Route by Flag Matrix)

**Skip if:** `--decompose` triggered (Step 3.5 handles implementation).

Route based on classification + active flags. See "Flag Routing Matrix" above for the full matrix.

### Default BUG (no --parallel/--deep) → /fix

Activate `/fix --parallel` in the worktree with full context:
- Issue description and root cause from Step 2
- Affected files list
- Proposed approach from brainstorm

The fix skill handles: debug -> implement -> verify -> review -> finalize.

**With `--tdd`:** Append `--tdd` flag. Fix will write regression tests before applying changes, then verify tests pass after.

### Default FEATURE (no --parallel/--deep) → /cook

Activate `/cook --auto` in the worktree with full context:
- Issue description and feature requirements from input
- Affected files list (if known)

**With `--tdd`:** Activate `/cook --auto --tdd` instead.

Cook handles the full cycle: research -> plan -> implement -> test -> review.

### --parallel → /cook --parallel (BUG or FEATURE)

When `--parallel` flag is set, Step 4.5 already produced a plan with file ownership boundaries.

Activate `/cook --parallel <plan-path>/plan.md` in the worktree:
- Plan path from Step 4.5
- Cook spawns multiple `fullstack-developer` agents per parallel phase group
- Each agent respects file ownership — no overlapping edits

**With `--tdd`:** Activate `/cook --parallel --tdd <plan-path>/plan.md`.

### --deep → /cook --auto (BUG or FEATURE)

When `--deep` flag is set, Step 4.5 already produced a thorough plan with per-area scouting.

Activate `/cook --auto <plan-path>/plan.md` in the worktree:
- Plan path from Step 4.5
- Cook executes phases sequentially (deep plans are complex, sequential is safer)
- Auto mode because thorough planning already validated the approach

**With `--tdd`:** Activate `/cook --auto --tdd <plan-path>/plan.md`.

### Cook Finalize Gate

**Cook MUST stop before its finalize step** -- do NOT let cook commit or create PRs. Maintainer owns git operations (Steps 6-8).

To prevent cook from committing, include in the cook prompt:
> "Skip the git commit step at finalize. Do not commit or push. Only update docs if warranted."

## Step 5.5: GitHub Progress Update

**Skip if:** No GitHub issue linked (e.g., `--skip-issue` was used and no URL provided).

**Behavior by issue origin:**
- **Maintainer-created issue (Step 3):** Auto-post comment, no confirmation needed.
- **User-provided issue URL:** Use `AskUserQuestion` to confirm before posting.

```bash
gh issue comment {ISSUE_NUMBER} -R {REPO} --body-file - <<'EOF'
## Progress Update

**Root Cause:** {1-2 sentence summary from debug step}

**Fix Applied:**
- {file1}: {what changed}
- {file2}: {what changed}

**Tests:** {added/modified/existing pass}

**PR:** #{PR_NUMBER} targeting `dev`
EOF
```

**Rules:**
- Keep comment brief -- max 15 lines
- No internal references (plan files, brainstorm outputs)
- No personal info
- Technical and neutral tone

## Step 6: Comprehension Check (MANDATORY)

After implementation, generate explanation of changes:
```
/preview --explain <summary-of-what-changed>
```

Then ask: "Any questions about the implementation before proceeding?"
- Address questions if any
- Proceed when user confirms understanding

**Why:** Prevents "AI Delegation" anti-pattern -- ensures user comprehends changes before ownership transfer.

## Step 7: Codebase Review (Optional)

Before any git operations, ask the user via `AskUserQuestion`:
> "Run `/code-review codebase --parallel` to validate code quality before committing?"

- **If yes**: Execute `Skill tool` with `skill: "code-review"` and args `codebase --parallel` -- address any findings before proceeding
- **If no**: Skip and proceed to Step 7.5

## Step 7.5: UI Evidence & PR Composition (Conditional / Hard Gate)

**Skip if:** the change has no user-facing UI impact AND `--force-ui` is NOT set.

**Hard gate if `--force-ui`:** PR creation (Step 8) is BLOCKED until evidence is produced and user-approved. No exceptions — even for backend-only changes, produce terminal evidence.

Auto-trigger (without `--force-ui`) when changed files touch user-facing surfaces such as `ui/`, `web/`, `frontend/`, `dashboard/`, routes, components, styles, templates, or onboarding/setup flows.

### Evidence Mode Selection

Select the right mode — NOT every change needs before/after. See `references/force-ui-evidence.md` for full mode selection logic.

| Mode | When | Output |
|---|---|---|
| **Before/After** | Bug fix, behavior change — meaningful visual difference exists | Side-by-side comparison |
| **Targeted** | New feature, new component — no meaningful "before" state | Annotated screenshot(s) with callout bounding boxes |
| **Terminal** | CLI output, test results, API responses | `<pre>` blocks with pass/fail highlighting |
| **Hybrid** | Mix of above | Combined sections in one report |

### Workflow

1. Select evidence mode (see mode selection logic above)
2. Capture evidence — scroll target to viewport center (~35% from top)
3. Add callout bounding boxes via **DOM overlay injection** (NOT ImageMagick) — red `#ef4444` border only, no fill, no text, ~12px expanded padding
4. For **targeted mode**: boxes highlight WHERE to look, with optional numbered labels for multi-area screenshots
5. Default to **light theme** unless the feature is explicitly theme-related
6. Limit to `2-4` meaningful captures
7. Generate HTML report using template from `references/force-ui-evidence.md` — store in `.github/pr-assets/{PR}/`
8. **Review locally first** — open report for user approval BEFORE any git commit. Never push evidence incrementally
9. If reliable evidence cannot be produced, **stop and ask the user** before opening a weak PR
10. Run SPA navigation checklist: internal links use `<Link to>` not `<a href>` (see `references/ui-diff-evidence.md`)
11. Follow PR body template matching the evidence mode from `references/force-ui-evidence.md`

## Step 8: PR to Dev

**PR TARGET RULE (MANDATORY -- NO EXCEPTIONS):**
- **Default target: `dev`** -- ALL PRs from worktrees/feature branches MUST target `dev`
- **ONLY exception:** explicit `--pr-main` flag provided by user
- **NEVER auto-decide to target `main`** -- even if branch looks like a hotfix, target `dev` unless user said `--pr-main`
- This rule aligns with project dev-first workflow: all work flows through `dev` before `main`

After fix is complete:
1. Commit via `/kai:commit` (analyzes changes, groups files, creates granular conventional commits)
   - **`--pr-main` commit audit:** Before committing, verify ALL commits use release-worthy types (`hotfix:`, `fix:`, `feat:`). Housekeeping commits (version sync, merge conflict resolution, package.json parity) MUST use `chore:` — never `hotfix:` or `fix:`. A `chore:` commit won't trigger a production release; a mistyped `hotfix:` will create an unexpected version bump.
2. Push and auto-create PR targeting **`dev`** via `/git pr to dev`
   - **ONLY** if `--pr-main` flag was explicitly provided: target `main` instead
   - **`--pr-main` one-shot rule:** Each hotfix issue gets ONE PR to `main`. If the first hotfix PR is already merged and a follow-up fix is needed for the same issue, the follow-up MUST go through `dev` (normal flow), NOT as a second `--pr-main` PR. Multiple hotfix PRs to main for the same issue cause cascading version bumps.
   - Link the GitHub issue in PR body (e.g., `Closes #123`)
3. If Step 7.5 ran, update the PR body after push using the current `HEAD` SHA
   - Use commit-pinned raw GitHub asset URLs for screenshots
   - Use `htmlpreview.github.io` for the static HTML report
   - Keep UI evidence in the PR body, not in follow-up comments, unless the user explicitly asks
4. Report summary: issue link, PR link, worktree path, changes made

---

# UI Diff Evidence & PR Composition

Step 7.5 of the maintainer workflow. Trigger logic lives in `implement-and-pr.md` Step 7.5 — this file covers HOW to capture, not WHEN.

Purpose: make user-facing PRs reviewable. UI evidence tells reviewers what changed, where to look, and whether the diff is trustworthy.

## Capture Rules

Capture **actual product screenshots only**:
- Never screenshot the HTML report itself
- Never use mocked visuals when the real dashboard/app can be run locally

Before/after captures MUST satisfy the parity checklist in `force-ui-evidence.md`.

Theme rule:
- default to **light theme** for dashboard evidence
- use dark theme only if the change is explicitly theme-related
- do not use light-vs-dark as the "before/after" diff unless theme behavior is the feature

### Framing Rule (CRITICAL)

Target element MUST be **centered in the viewport** (~35-40% from top). Scroll the scrollable container so the review area sits mid-viewport with context above and below.

```js
const rect = targetEl.getBoundingClientRect();
const main = document.querySelector('main');
main.scrollTop = rect.top + main.scrollTop - (window.innerHeight * 0.35);
```

### Annotation Rule (CRITICAL)

**NEVER use ImageMagick/convert** — retina 2x scaling breaks coordinate math.
**ALWAYS use DOM overlay injection.** Full technique documented in `force-ui-evidence.md` (Callout Bounding Box Rules).

Scope: prefer `2-4` focused comparisons. Full-page captures only when layout/IA is the change.

## Evidence Workflow (local-first)

**NEVER push evidence commits incrementally.** Capture locally, get user approval, THEN commit+push once.

```
1. Select evidence mode (see force-ui-evidence.md)
2. Capture screenshots (before/after or targeted)
3. Inject DOM overlays and capture final versions
4. Generate HTML report locally
5. Open report for user review → `open path/to/index.html`
6. User confirms evidence quality
7. THEN: commit all evidence + code in clean scoped commits
8. THEN: push once
9. THEN: update PR body with commit-pinned SHA URLs
```

## HTML Report

Self-contained comparison report via `/preview --html` or hand-coded HTML. Report spec and templates in `force-ui-evidence.md`.

## Artifact Rules

- Only commit final screenshots — no raw/unannotated backups
- Store in `.github/pr-assets/{PR_NUMBER}/`
- Naming convention in `force-ui-evidence.md` (Asset Storage & Naming)

## Baseline Fallback

If no clean `before` baseline exists:
- prefer nearest reproducible baseline from `main`, latest release, or stable fixture
- for "before": run production app or checkout `main` branch UI
- for "after": run local dev server with PR changes
- if impossible: state explicitly in PR body, provide annotated `after` evidence
- if reliable evidence still can't be produced: stop and ask the user

## Link Rules

Evidence links MUST be commit-pinned (see `force-ui-evidence.md` Commit-Pinned URL Construction).

Do NOT:
- point at mutable branch-tip URLs
- leave stale links after later UI commits
- move evidence into PR comments (PR body is canonical)

## Refresh Rules

Refresh when: later commits modify a captured surface, feedback says evidence is unclear, or callout targets wrong area.

When refreshed: replace locally → user approval → amend evidence commit → force-push once → update PR body.

## SPA Navigation Checklist

When PR adds navigation links:
- Internal links use framework router (`<Link to>`, `<NuxtLink>`) — NOT `<a href>`
- `<a href>` causes full reload, losing React state and stores
- `ExternalLink` icon only for links leaving the SPA

## Sensitive Data Rule

Mask secrets, tokens, emails, account IDs, tenant names, and personal data before publishing. If sanitizing hides the UI change, recreate with safe fixture data.

## Anti-Patterns

Non-obvious pitfalls only (obvious rule inversions omitted):
- PR body links to the report, but the report contains screenshots of itself
- before/after differs mainly by theme, not by feature
- evidence split across multiple noisy PR comments instead of the PR body

---

# Force UI Evidence

`--force-ui` flag: hard-gate UI evidence workflow. Extracted from production-tested PR patterns.

## Hard Gate Behavior

| Scenario | Without `--force-ui` | With `--force-ui` |
|---|---|---|
| UI files changed | Step 7.5 auto-triggers (skippable) | Step 7.5 is **BLOCKING** — PR creation fails without evidence |
| Backend-only change | Step 7.5 skipped | Step 7.5 still runs — must produce terminal or API evidence |
| Evidence capture fails | Can proceed with warning | **STOP and ask user** — never open a weak PR |

When `--force-ui` is active, Step 8 (PR creation) is GATED on:
1. Evidence assets exist in `.github/pr-assets/{PR}/`
2. HTML report generated and locally reviewed by user
3. PR body follows the mode-appropriate template (below)

## Evidence Modes

`--force-ui` is NOT just "before and after." Choose the right mode:

| Mode | When to Use | What to Produce |
|---|---|---|
| **Before/After** | Bug fix, behavior change, layout shift — meaningful visual difference exists | Side-by-side comparison with callout borders on BOTH states |
| **Targeted** | New feature, new component, first implementation — no meaningful "before" state | Single screenshot(s) with callout bounding boxes pointing to specific areas |
| **Terminal** | CLI output, test results, API responses, chat tool execution | `<pre>` blocks with pass/fail syntax highlighting |
| **Hybrid** | Mix of any above in the same PR | Combine sections in a single report |

### Mode Selection Logic

```
Has meaningful "before" state?
├── YES → Before/After mode
│   (bug fix where old behavior is visible, layout change, config UI change)
└── NO
    ├── Is it a visual surface? → Targeted mode
    │   (new feature, new page, new component, first-time dialog)
    └── Is it output/CLI? → Terminal mode
        (test output, API response, command result)
```

**Targeted mode is the default for new features.** Don't force a before/after when "before" is just an empty page — that adds noise, not signal.

## Callout Bounding Box Rules (All Modes)

The callout bounding box is the core technique. It answers: "where should the reviewer look?"

**DOM overlay injection (NEVER ImageMagick — retina 2x scaling breaks coordinates):**

```js
const el = document.querySelector('{selector}');
const rect = el.getBoundingClientRect();
const pad = 12;
const overlay = document.createElement('div');
overlay.style.cssText = [
  `position:fixed`,
  `top:${rect.top - pad}px`, `left:${rect.left - pad}px`,
  `width:${rect.width + pad * 2}px`, `height:${rect.height + pad * 2}px`,
  `border:3px solid #ef4444`, `border-radius:10px`,
  `pointer-events:none`, `z-index:99999`,
].join(';');
document.body.appendChild(overlay);
```

**Style rules:**
- Border only: `3px solid #ef4444` — no fill, no background
- 12px expanded padding around the element
- Remove after capture: `document.querySelectorAll('[style*="z-index:99999"]').forEach(e => e.remove())`

**Multiple boxes** — if PR touches 3 areas on one page, add 3 overlays. Use numbered labels if >2:

```js
const label = document.createElement('div');
label.textContent = '1';
label.style.cssText = [
  `position:fixed`,
  `top:${rect.top - pad - 22}px`, `left:${rect.left - pad}px`,
  `width:20px`, `height:20px`, `border-radius:50%`,
  `background:#ef4444`, `color:#fff`, `font-size:12px`,
  `display:flex`, `align-items:center`, `justify-content:center`,
  `font-weight:700`, `pointer-events:none`, `z-index:100000`,
].join(';');
document.body.appendChild(label);
```

## Capture Parity Checklist

**Before/after mode** — every pair MUST match:

```
[ ] Same backend instance (or explicitly different: stable vs PR deployment)
[ ] Same user account and role
[ ] Same tenant/workspace (if multi-tenant)
[ ] Same theme (default: light for dashboards)
[ ] Same viewport size
[ ] Same route / page / dialog state
[ ] Fresh conversation/session (not reused state)
```

**Targeted mode** — document the capture environment:

```
[ ] Backend instance and version
[ ] User account and role
[ ] Theme (default: light)
[ ] What state/data is shown (seeded fixtures? real data? demo values?)
```

Document parity/environment in the HTML report AND the PR body.

## HTML Report Spec

Self-contained, no external deps, `htmlpreview.github.io`-friendly.

### Canonical Design Tokens

Use ONE palette across all report types:

```
Dark (default):  --bg: #0d0d0d  --fg: #e8e4df  --card: #1a1714  --border: #2d2923  --muted: #8a837d  --accent: #ef4444  --good: #22c55e  --code: #151210
Light (.light):  --bg: #f8f6f3  --fg: #1a1714  --card: #ffffff  --border: #e5e0da  --muted: #6b6560  --accent: #dc2626  --good: #15803d  --code: #f3f0eb
```

### Required Elements

| Element | Spec |
|---|---|
| **Theme toggle** | Top-right button, toggles `.light` class on `<html>`, text: `○ Light` / `● Dark` |
| **Title bar** | `PR {N} · {Short Title}` + environment parity statement |
| **Summary cards** | 3-column grid: What changed / Why it matters / Review cue |
| **Comparison sections** | 2-4 sections, each with heading card + content grid |
| **Responsive** | 2-col grid → 1-col at ≤900px via `@media` query |

### Content Grid by Mode

**Before/After:** 2-column grid. Each column: `.shot` card with header (`BEFORE`/`AFTER` label + state description) + `<img>`.

**Targeted:** Single-column. `.shot` card with header (`IMPLEMENTED` label + state) + `<img>` of annotated screenshot.

**Terminal:** 2-column grid. Each column: `.col-header` (`BEFORE`/`AFTER`) + `.panel` containing `<pre class="terminal">` with highlighted lines.

### Terminal Highlight Rules

| Line Content | Class | Rendering |
|---|---|---|
| Failure, error, denied, blocked | `.hl-bad` | `rgba(239,68,68,0.14)` bg + `3px solid var(--accent)` left border |
| Pass, success, allowed | `.hl-good` | `rgba(34,197,94,0.14)` bg + `3px solid var(--good)` left border |
| Neutral | No class | Default monospace |

Wrap ONLY the meaningful lines — not entire blocks.

## PR Body Templates

Use the template matching the evidence mode.

### Before/After PR Body

```markdown
## Problem

{1-3 sentences}

Closes #{ISSUE}

## Visual Review

[Full comparison report]({htmlpreview-url})

### {N}. {Surface description}

| Before | After |
| --- | --- |
| ![Before]({commit-pinned-url}) | ![After]({commit-pinned-url}) |

Before: {1 sentence}. After: {1 sentence}.

{Repeat for 2-4 comparisons}

All captures: {environment parity statement}. Red callout borders mark the review area.

## Root Cause

{Technical explanation}

## What changed

| File | Change |
|------|--------|
| `{path}` | {description} |

## Validation

- [x] {build passes}
- [x] {tests pass}
- [x] {evidence captured with matching state}
```

### Targeted PR Body

```markdown
## Summary

{1-3 sentences describing what was implemented}

Closes #{ISSUE}

## Visual Review

[Full comparison report]({htmlpreview-url})

### {N}. {What was implemented}

![{Surface}]({commit-pinned-url})

Red callout boxes highlight: {what each box marks}.
{1-2 sentences on implemented behavior}.

{Repeat for 1-4 captures}

Captures: {environment statement}.

## What changed

| File | Change |
|------|--------|
| `{path}` | {description} |

## Validation

- [x] {build passes}
- [x] {tests pass}
- [x] {annotated evidence reviewed locally}
```

### Non-UI PR Body (reference)

```markdown
## Summary

- {bullet points}

Closes #{ISSUE}

## Root Cause

{Technical explanation}

## Changes

| File | Change |
|------|--------|
| `{path}` | {description} |

## Test plan

- [x] {build}
- [x] {tests}
- [ ] {manual verification}
```

## Asset Storage & Naming

Only commit final screenshots. No raw/unannotated backups.

```
.github/pr-assets/{PR_NUMBER}/
├── index.html                      # Self-contained comparison report
├── before-{surface-slug}.png       # Before/After mode
├── after-{surface-slug}.png        # Before/After mode
├── {surface-slug}.png              # Targeted mode
├── before-{context}.txt            # Terminal logs (optional)
└── after-{context}.txt             # Terminal logs (optional)
```

## Commit-Pinned URL Construction

```bash
SHA=$(git rev-parse HEAD)

# Image URL
https://raw.githubusercontent.com/{OWNER}/{REPO}/{SHA}/.github/pr-assets/{PR}/{filename}.png

# HTML report URL
https://htmlpreview.github.io/?https://raw.githubusercontent.com/{OWNER}/{REPO}/{SHA}/.github/pr-assets/{PR}/index.html

# Fork PRs — use fork owner
https://raw.githubusercontent.com/{FORK_OWNER}/{REPO}/{SHA}/.github/pr-assets/{PR}/{filename}.png
```

**CRITICAL:** Use commit SHA, not branch name. Branch-tip URLs go stale.

---

# Review Feedback Loop

Step 8.5 of the maintainer workflow. Also used by `--scan-reviews` mode.

**Skip if:** `--no-review-loop` flag provided.

After PR is created (Step 8), automatically enter a fix loop that monitors review feedback (both AI bot AND upstream human reviewers) and resolves ALL issues until clean approval.

## Dual Review Mode

This step handles TWO review sources simultaneously:

1. **Upstream reviews** — Review comments, requested changes, inline suggestions on the PR (bot or human)
2. **Self-review** — Run `/code-review codebase --parallel` yourself each iteration to catch issues before reviewers do

**Every loop iteration:** poll upstream feedback AND run parallel self-review. Fix findings from BOTH sources in a single push.

## Configuration

| Setting | Default | Override |
|---------|---------|----------|
| Max fix attempts | 5 | `--max-fix-attempts N` |
| Poll interval (first) | 150s | -- |
| Poll interval (subsequent) | 60s | -- |
| Max first review wait | 600s (10 min) | -- |
| Severity threshold | All (fix High, Medium, Low) | -- |

## Severity Detection Patterns

Parsed from AI review comment body (output of the repo's AI review workflow, if one is configured):

| Pattern | Severity | Action |
|---------|----------|--------|
| `🔴 High` | High | Fix (mandatory) |
| `🟡 Medium` | Medium | Fix (mandatory) |
| `🟢 Low` | Low | Fix (mandatory) |

### Overall Assessment (Loop Termination)

| Pattern | Meaning | Loop Action |
|---------|---------|-------------|
| `✅ APPROVED` | Clean approval | **STOP -- only clean exit** |
| `⚠️ APPROVED WITH NOTES` | Has remaining issues | Continue fixing |
| `❌ CHANGES REQUESTED` | Has blocking issues | Continue fixing |

## Critical Rules

- **ALL severities are actionable.** High, Medium, AND Low -- NO informational-only tier.
- **MUST NOT implement fixes directly.** ONLY role is orchestration and delegation.
- **Loop terminates ONLY on `✅ APPROVED` or max attempts.** No other exit condition.
- **Commit messages MUST be descriptive.** Each commit describes WHAT was actually changed and WHY — never generic "address feedback" or "fix review comments" messages. Reviewers and future debuggers read commit history to understand intent. Example: `fix: guard null session in auth middleware` not `fix: address review feedback round 2`.
- **UI evidence MUST stay fresh.** If newer commits modify a captured user-facing UI surface, or review comments request UI-specific clarification, regenerate screenshots/report and update the PR body before treating the review loop as complete.

## Variables

- `MAX_ATTEMPTS` = `--max-fix-attempts N` or default (5)
- `POLL_INTERVAL_FIRST` = 150 seconds (initial wait for reviewer to process)
- `POLL_INTERVAL` = 60 seconds (subsequent polls)
- `MAX_FIRST_WAIT` = 600 seconds (10 min for first review to arrive)
- `ATTEMPT` = 0

## Loop Process

### 1. Poll for reviews (upstream + bot)

**AI bot reviews:**
```bash
gh api repos/{OWNER}/{REPO}/issues/{PR}/comments \
  --jq '[.[] | select(.user.type == "Bot")] | sort_by(.created_at) | last'
```

**Upstream reviews (PR reviews + inline comments):**
```bash
gh api repos/{OWNER}/{REPO}/pulls/{PR}/reviews \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED")] | sort_by(.submitted_at) | last'
```
Also check inline review comments:
```bash
gh api repos/{OWNER}/{REPO}/pulls/{PR}/comments \
  --jq 'sort_by(.created_at)'
```

- No reviews yet: sleep `POLL_INTERVAL_FIRST` on first poll, `POLL_INTERVAL` on subsequent, retry until `MAX_FIRST_WAIT` exceeded
- If `MAX_FIRST_WAIT` exceeded with no review: alert user, proceed to Step 9

**Parallel self-review:** While polling, also run `/code-review codebase --parallel` to proactively catch issues. Merge self-review findings with upstream feedback for a single fix pass.

### 2. Stale review check
```bash
gh api repos/{OWNER}/{REPO}/pulls/{PR}/commits --jq 'last | .commit.committer.date'
```
If `review.created_at < latest_commit.date` -> review is stale, skip and poll again.

### 3. Parse ALL feedback sources

**AI bot reviews:** Scan for `🔴 High`, `🟡 Medium`, `🟢 Low` markers. **ALL are actionable. Do NOT skip Low.**
Check overall assessment per termination table above.

**Upstream reviews:** Parse inline comments, review body text, and requested changes. Treat ALL upstream feedback as actionable — if no severity markers present, treat every comment as at least Medium priority.

**Self-review findings:** Include findings from `/code-review codebase --parallel` run in this iteration.

### 4. If ANY actionable items found
- Increment `ATTEMPT`
- If `ATTEMPT > MAX_ATTEMPTS`:
  - Alert: "Review feedback loop reached max {MAX_ATTEMPTS} attempts for PR #{PR}. Remaining issues require manual attention."
  - List ALL remaining items by severity. Proceed to Step 9.
- Extract ALL actionable items across all severities
- **Delegate (NEVER fix directly):**
  - **Default:** Activate `/fix --parallel` with PR number, review body, ALL severity items (High + Medium + Low), affected file hints
  - **Escalation:** If feedback requires architectural coordination across many files -> activate `/team cook` instead
  - **MUST NOT modify code yourself.** Delegate entirely to `/fix --parallel` or `/team`.
- After delegation: commit via `/kai:commit` and push
  - `/kai:commit` auto-analyzes changes, groups related files, and creates granular conventional commits with descriptive messages
  - NEVER use generic "address feedback" messages — `/kai:commit` handles this correctly
  ```bash
  git push
  ```
- Report: "Attempt {ATTEMPT}/{MAX_ATTEMPTS}: Pushed fixes. Waiting for re-review..."
- Sleep `POLL_INTERVAL`, goto step 1

### 5. If `✅ APPROVED`: proceed to Step 9

**Progress reporting per attempt:**
```
[i] Review loop #{ATTEMPT}/{MAX_ATTEMPTS} -- {N_HIGH} high, {N_MEDIUM} medium, {N_LOW} low remaining -> delegating to [/fix --parallel | /team]...
```

## Bot Comment Detection

The review bot posts via GitHub App. Filter comments by user type:
```bash
gh api repos/{OWNER}/{REPO}/issues/{PR}/comments \
  --jq '[.[] | select(.user.type == "Bot")] | sort_by(.created_at) | last'
```

## Stale Review Detection

Compare review comment timestamp vs latest commit on PR branch:
```bash
# Latest commit timestamp
gh api repos/{OWNER}/{REPO}/pulls/{PR}/commits --jq 'last | .commit.committer.date'
# Review comment timestamp: from bot comment JSON .created_at
```
If `review.created_at < latest_commit.date` -> stale, skip and wait for fresh review.

---

# Cleanup & Rules

Step 9 and operational rules for the maintainer workflow.

## Step 9: Cleanup (on "PR done")

When user says **"PR done"** (meaning PR is merged):

### 9.1 Verify PR is merged
```bash
BRANCH=$(git branch --show-current)
gh pr list --head "$BRANCH" --state open --json number,url
```
- If PR is still **open** -> Use `AskUserQuestion`: "PR #N is still open (not merged). Merge it first before cleanup?"
  - Options: "Yes, I'll merge it first" (default, abort cleanup) | "No, force cleanup anyway"
- If PR is **merged** or no open PR found -> Proceed to cleanup

### 9.2 Execute cleanup

1. Remove local worktree(s):
   ```bash
   cd <REPO_ROOT> && git worktree remove <WORKTREE_PATH> --force
   ```
   For decomposed issues: remove ALL sub-worktrees.

2. Delete local branch(es):
   ```bash
   git branch -d <branch-prefix>/<type>/<slug>
   ```

3. Delete remote branch(es):
   ```bash
   git push origin --delete <branch-prefix>/<type>/<slug>
   ```

4. Confirm cleanup complete.

## GitHub Issue Interaction Rules

- **NEVER comment on or close user-opened issues** via `gh` unless the user explicitly asks
- When given a user issue URL, treat it as **read-only input** -- triage, debug, and fix locally
- Step 5.5 auto-comments ONLY on maintainer-created issues; asks confirmation for user-provided issues
- If the user explicitly asks to post on a GitHub issue, keep comments **brief, precise, and actionable** -- no walls of text
- PR `Closes #N` linkage is fine (auto-closes on merge) -- that's not a direct comment

## Operational Notes

- Each step builds on previous context -- pass findings forward
- Steps can be skipped with flags if already done
- For multiple issues, run `/kai:maintainer` per issue in separate worktrees
- All plans/reports/brainstorm outputs -> target repo's `plans/` dir (not worktree)
- Worktrees are code-only -- no tracked markdown files in worktrees
- **NEVER modify code directly on the original repo dir** -- always use a worktree
- Auto-classification defaults to BUG if ambiguous -- safer, less overhead
- Flag routing: see Flag Routing Matrix above -- all routing logic lives there
- Review feedback loop (Step 8.5) always uses `/fix` regardless of original classification
- Decomposed issues: max 4 parallel agents to avoid resource contention
- For decomposed "PR done": cleanup covers ALL sub-worktrees and branches
- `--no-review-loop` skips Step 8.5 for quick PRs that don't need review monitoring
- `--scan-reviews` is standalone mode -- skips Steps 1-8, enters review loop directly for existing PRs
- Only `✅ APPROVED` terminates the review loop cleanly -- `⚠️ APPROVED WITH NOTES` still triggers fixes

---

# Scan Reviews Mode

Standalone mode activated by `--scan-reviews` -- skips Steps 1-8.

Scans open PRs across configured repos for unresolved review feedback.

## Configuration

Configure repos by providing `OWNER/REPO` and local absolute path for each repo to scan.
User specifies repos when invoking or stores in project configuration.

## Process

1. For each configured repo, fetch open PRs:
   ```bash
   gh pr list -R {OWNER/REPO} --state open --json number,headRefName,url,title
   ```

2. For each open PR, fetch latest bot review comment:
   ```bash
   gh api repos/{OWNER}/{REPO}/issues/{PR}/comments \
     --jq '[.[] | select(.user.type == "Bot")] | sort_by(.created_at) | last'
   ```

3. Parse review body for severity markers (see `review-feedback-loop.md`)

4. Collect PRs with unresolved High/Medium/Low into fix queue

5. Report found PRs via `AskUserQuestion` -- confirm before proceeding

6. For each PR (sequential):
   - `cd` to repo absolute path
   - `git checkout` the PR branch (exception to the "never modify original repo" rule -- the PR branch is already isolated)
   - Enter review feedback loop (same logic as `review-feedback-loop.md`)
   - After loop completes (approved or max attempts), move to next PR

7. Report summary of all processed PRs

**Why sequential:** Each `/fix --parallel` already spawns parallel subagents internally. Running multiple PR fixes concurrently would cause resource contention.
