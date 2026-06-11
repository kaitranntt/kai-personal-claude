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
