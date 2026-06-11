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
