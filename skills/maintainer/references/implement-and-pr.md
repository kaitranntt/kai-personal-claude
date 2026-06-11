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
