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
