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
