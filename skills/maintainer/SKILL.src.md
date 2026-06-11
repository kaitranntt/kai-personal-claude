---
description: "Daily maintainer workflow -- triage, GitHub issue, worktree, fix, PR, review feedback loop. BUG/FEATURE auto-classify."
---

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

<!-- include: references/signal-intake.md -->

---

<!-- include: references/triage-and-classify.md -->

---

<!-- include: references/github-and-decompose.md -->

---

<!-- include: references/implement-and-pr.md -->

---

<!-- include: references/ui-diff-evidence.md -->

---

<!-- include: references/force-ui-evidence.md -->

---

<!-- include: references/review-feedback-loop.md -->

---

<!-- include: references/cleanup-and-rules.md -->

---

<!-- include: references/scan-reviews.md -->
