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
