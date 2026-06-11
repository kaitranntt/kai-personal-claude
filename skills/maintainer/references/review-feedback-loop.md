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
