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
