#!/usr/bin/env node
// Root maintainer briefing for personal work that starts at ~/claudekit.
// Read-only: summarizes drift and submodule state, never mutates repos.

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const DEFAULT_SUBMODULES = [
  'agentkit',
  'claudekit-cli',
  'claudekit-engineer',
  'claudekit-docs',
  'claudekit-marketing',
  'claudekit-assistant',
  'claudekit-evals',
  'claudekit-admin',
]
const MAX_DRIFT_LINES = 5
const MAX_SUBMODULE_LINES = 8

function resolveRoot() {
  return process.env.CK_REPO_ROOT || process.env.REPO_ROOT || discoverCurrentGitRoot() || path.join(os.homedir(), 'claudekit')
}

function discoverCurrentGitRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trimEnd()
  } catch {
    return ''
  }
}

function readJSON(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readLines(file) {
  if (!fs.existsSync(file)) return []
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function runGit(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    }).trimEnd()
  } catch {
    return ''
  }
}

function tailTagged(lines, tag, count) {
  return lines.filter((line) => line.includes(` ${tag} `)).slice(-count)
}

function stateRunLines(state, fallbackLines) {
  return Array.isArray(state.current_run_lines) ? state.current_run_lines : fallbackLines
}

function stripTimestamp(line, tag) {
  return line.replace(new RegExp(`^\\[[^\\]]+\\]\\s+${tag}\\s+`), '- ')
}

function sanitizeLogLine(line, tag) {
  return stripTimestamp(line, tag).replace(/\s+\|.*$/, '')
}

function driftSection(root, label, relDir, refreshCommand) {
  const state = readJSON(path.join(root, relDir, 'drift.state.json'))
  const logFile = path.join(root, relDir, 'drift.log')
  if (!state || !fs.existsSync(logFile)) return null

  const pending = state.pending_drift | 0
  const pendingMirror = state.pending_mirror_drift | 0
  if (pending <= 0 && pendingMirror <= 0) return null

  const lines = stateRunLines(state, readLines(logFile))
  const driftLines = pending > 0 ? tailTagged(lines, 'DRIFT', Math.min(pending, MAX_DRIFT_LINES)) : []
  const mirrorLines = pendingMirror > 0 ? tailTagged(lines, 'MIRROR_DRIFT', Math.min(pendingMirror, MAX_DRIFT_LINES)) : []
  if (driftLines.length === 0 && mirrorLines.length === 0) return null

  const body = []
  body.push(`### ${label}`)
  body.push('')
  body.push(`Last check: ${state.last_check || 'unknown'}`)
  if (refreshCommand) body.push(`Refresh: \`${refreshCommand}\``)

  if (driftLines.length > 0) {
    const shown = driftLines.length
    body.push('')
    body.push(`SHA drift (${pending} pending; showing last ${shown}):`)
    body.push(...driftLines.map((line) => sanitizeLogLine(line, 'DRIFT')))
  }

  if (mirrorLines.length > 0) {
    const shown = mirrorLines.length
    body.push('')
    body.push(`Mirror drift (${pendingMirror} pending; showing last ${shown}):`)
    body.push(...mirrorLines.map((line) => sanitizeLogLine(line, 'MIRROR_DRIFT')))
  }

  return {
    kind: 'drift',
    pending,
    pendingMirror,
    text: body.join('\n'),
  }
}

function listSubmodules(root) {
  const gitmodules = path.join(root, '.gitmodules')
  if (!fs.existsSync(gitmodules)) return DEFAULT_SUBMODULES.filter((name) => fs.existsSync(path.join(root, name)))

  const data = fs.readFileSync(gitmodules, 'utf8')
  const paths = [...data.matchAll(/^\s*path\s*=\s*(.+)$/gm)].map((match) => match[1].trim())
  return paths.length > 0 ? paths : DEFAULT_SUBMODULES
}

function normalizeStatusPath(statusLine) {
  const match = statusLine.match(/^.{1,2}\s+(.+)$/)
  const pathPart = (match ? match[1] : statusLine.slice(3)).trim()
  if (!pathPart.includes(' -> ')) return pathPart
  return pathPart.split(' -> ').pop().trim()
}

function isSubmoduleStatusLine(statusLine, submodules) {
  const statusPath = normalizeStatusPath(statusLine)
  return submodules.some((name) => statusPath === name || statusPath.startsWith(`${name}/`))
}

function parseSubmodulePointerLine(line) {
  const trimmed = line.trim()
  const match = trimmed.match(/^([+\-U])([0-9a-f]+)\s+([^\s]+)(?:\s+\((.+)\))?$/i)
  if (!match) return { prefix: trimmed[0] || '', path: trimmed, sha: '', detail: '' }
  return {
    prefix: match[1],
    sha: match[2],
    path: match[3],
    detail: match[4] || '',
  }
}

function submoduleState(root, name) {
  const subRoot = path.join(root, name)
  if (!fs.existsSync(subRoot)) return null
  const gitRoot = runGit(subRoot, ['rev-parse', '--show-toplevel'])
  if (path.resolve(gitRoot) !== path.resolve(subRoot)) return null
  const status = runGit(subRoot, ['status', '--short', '--branch'])
  if (!status) return null
  const lines = status.split('\n').filter(Boolean)
  const branch = (lines[0] || '').replace(/^##\s*/, '')
  const dirty = lines.slice(1)
  return {
    branch,
    dirtyCount: dirty.length,
    aheadBehind: /\[(?:ahead|behind)/.test(branch),
  }
}

function classifySubmodulePointer(pointer, state) {
  if (pointer.prefix === 'U') {
    return {
      label: 'conflict',
      guidance: 'resolve the submodule conflict before any root commit',
    }
  }
  if (pointer.prefix === '-') {
    return {
      label: 'not initialized',
      guidance: 'initialize only if you need to work in this submodule',
    }
  }
  if (state && (state.aheadBehind || state.dirtyCount > 0)) {
    return {
      label: 'local submodule work',
      guidance: 'do not commit the root pointer until this submodule is reconciled and pushed',
    }
  }
  return {
    label: 'pointer update pending',
    guidance: 'low noise; commit only when intentionally updating the root pointer',
  }
}

function formatSubmodulePointerLine(line, state) {
  const pointer = parseSubmodulePointerLine(line)
  const classification = classifySubmodulePointer(pointer, state)
  const shortSha = pointer.sha ? pointer.sha.slice(0, 7) : 'unknown'
  const detail = pointer.detail ? ` (${pointer.detail})` : ''
  return `- ${pointer.path}: ${classification.label} at ${shortSha}${detail}; ${classification.guidance}`
}

function rootStatusSection(root, submodules = listSubmodules(root)) {
  const status = runGit(root, ['status', '--short'])
  if (!status) return null
  const lines = status
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('.maintainer/drift.log') && !line.includes('.maintainer/drift.state.json'))
    .filter((line) => !isSubmoduleStatusLine(line, submodules))

  if (lines.length === 0) return null

  return {
    kind: 'root-status',
    text: ['### Root Worktree Changes', '', ...lines.map((line) => `- ${line}`)].join('\n'),
  }
}

function submoduleSection(root) {
  const submodules = listSubmodules(root)
  const states = new Map()
  for (const name of submodules) {
    const state = submoduleState(root, name)
    if (state) states.set(name, state)
  }

  const submoduleStatus = runGit(root, ['submodule', 'status'])
  const pointerLines = submoduleStatus
    .split('\n')
    .filter(Boolean)
    .filter((line) => /^[+\-U]/.test(line))
    .filter((line) => parseSubmodulePointerLine(line).prefix !== '-')
    .map((line) => {
      const pointer = parseSubmodulePointerLine(line)
      return formatSubmodulePointerLine(line, states.get(pointer.path))
    })
    .slice(0, MAX_SUBMODULE_LINES)

  const attention = []
  for (const name of submodules) {
    const state = states.get(name)
    if (!state) continue
    if (state.aheadBehind || state.dirtyCount > 0) {
      attention.push(`- ${name}: ${state.branch}${state.dirtyCount > 0 ? `; ${state.dirtyCount} dirty item(s)` : ''}`)
    }
  }

  if (pointerLines.length === 0 && attention.length === 0) return null

  const body = ['### Submodule Attention', '']
  if (pointerLines.length > 0) {
    body.push('Pointer changes from root index:')
    body.push(...pointerLines)
    body.push('')
  }
  if (attention.length > 0) {
    body.push('Submodule branch/worktree state:')
    body.push(...attention)
  }

  return {
    kind: 'submodules',
    text: body.join('\n').trim(),
  }
}

function nextActions(sections) {
  const actions = []
  if (sections.some((section) => section.kind === 'drift')) {
    actions.push('- Refresh the relevant drift source, inspect current-run drift entries first, then update pins only after review.')
  }
  if (sections.some((section) => section.kind === 'submodules')) {
    actions.push('- For submodule entries, follow the classification: ignore low-noise pointer drift until intentional, but never commit a root pointer to unpublished or conflicted submodule work.')
  }
  if (sections.some((section) => section.kind === 'root-status')) {
    actions.push('- Resolve or intentionally preserve root worktree changes before starting unrelated work.')
  }
  if (actions.length === 0) return ''
  return ['### Suggested Next Actions', '', ...actions].join('\n')
}

function buildBriefing(root = resolveRoot()) {
  const submodules = listSubmodules(root)
  const sections = [
    driftSection(root, 'Root External Source Drift', '.maintainer', 'tools/check-external-sources.sh'),
    driftSection(root, 'AgentKit Maintainer Drift', 'agentkit/.maintainer', 'cd agentkit && make sync-ck'),
    submoduleSection(root),
    rootStatusSection(root, submodules),
  ].filter(Boolean)

  if (sections.length === 0) return ''

  const body = ['## ClaudeKit Maintainer Briefing', ...sections.map((section) => section.text)]
  const actions = nextActions(sections)
  if (actions) body.push(actions)
  return body.join('\n\n')
}

// --- Suggest mode (read-only target ranking) ---------------------------------
// Locked priority order: ci-failure > external-source-drift > submodule-dirt >
// open-issues (P0/P1) > open-prs. Pure ranker: no IO, sorts already-gathered
// signals into the JSON candidate contract.

function rankCandidates(signals = {}) {
  const candidates = []

  const ciFailures = Array.isArray(signals.ciFailures) ? signals.ciFailures : []
  if (ciFailures.length > 0) {
    candidates.push({
      type: 'ci-failure',
      priority: 'CRITICAL',
      count: ciFailures.length,
      targets: ciFailures,
      guidance: 'Fix the failing CI run on dev/main before any other maintainer work.',
    })
  }

  const drift = signals.drift || {}
  const pending = (drift.pending | 0) + (drift.pendingMirror | 0)
  if (pending > 0) {
    candidates.push({
      type: 'external-source-drift',
      priority: 'HIGH',
      count: pending,
      targets: Array.isArray(drift.entries) ? drift.entries : [],
      guidance: 'Review upstream drift, then bump pins per vendor mode (see .maintainer/drift.log).',
    })
  }

  const submoduleDirt = Array.isArray(signals.submoduleDirt) ? signals.submoduleDirt : []
  if (submoduleDirt.length > 0) {
    candidates.push({
      type: 'submodule-dirt',
      priority: 'MEDIUM',
      count: submoduleDirt.length,
      targets: submoduleDirt,
      guidance: 'Reconcile and push the dirty/ahead submodule before committing a root pointer.',
    })
  }

  const issues = Array.isArray(signals.issues) ? signals.issues : []
  if (issues.length > 0) {
    candidates.push({
      type: 'open-issues',
      priority: 'MEDIUM',
      count: issues.length,
      targets: issues,
      guidance: 'Triage open P0/P1 issues; start with the highest-severity item.',
    })
  }

  const prs = Array.isArray(signals.prs) ? signals.prs : []
  if (prs.length > 0) {
    candidates.push({
      type: 'open-prs',
      priority: 'LOW',
      count: prs.length,
      targets: prs,
      guidance: 'Review or merge open PRs when higher-priority work is clear.',
    })
  }

  return candidates
}

// Bounded, graceful read-only `gh` invocation. Returns parsed JSON array, or []
// when gh is missing / unauthenticated / offline / errors. Never throws.
function runGhJSON(args, timeout = 8000) {
  try {
    const out = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout,
    })
    const parsed = JSON.parse(out)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// IO layer: assembles signals from local files, git, and live read-only gh.
// Each external source degrades to empty on any failure.
function gatherSignals(root = resolveRoot()) {
  const signals = {
    ciFailures: [],
    drift: { pending: 0, pendingMirror: 0, entries: [] },
    submoduleDirt: [],
    issues: [],
    prs: [],
  }

  // Drift: reuse the same local state driftSection() reads.
  try {
    const rootDrift = driftSection(root, 'Root External Source Drift', '.maintainer', 'tools/check-external-sources.sh')
    const agentDrift = driftSection(root, 'AgentKit Maintainer Drift', 'agentkit/.maintainer', 'cd agentkit && make sync-ck')
    for (const section of [rootDrift, agentDrift]) {
      if (!section) continue
      signals.drift.pending += section.pending | 0
      signals.drift.pendingMirror += section.pendingMirror | 0
      signals.drift.entries.push({ source: section.text.split('\n')[0].replace(/^###\s*/, '') })
    }
  } catch {
    // leave drift defaults
  }

  // Submodule dirt: reuse submoduleState() / listSubmodules().
  try {
    for (const name of listSubmodules(root)) {
      const state = submoduleState(root, name)
      if (state && (state.aheadBehind || state.dirtyCount > 0)) {
        signals.submoduleDirt.push({
          name,
          branch: state.branch,
          dirtyCount: state.dirtyCount,
          aheadBehind: state.aheadBehind,
        })
      }
    }
  } catch {
    // leave submoduleDirt empty
  }

  // CI failures on dev/main (live read-only gh; bounded + graceful).
  const runs = runGhJSON([
    'run', 'list',
    '--limit', '20',
    '--json', 'status,conclusion,headBranch,name',
  ])
  signals.ciFailures = runs.filter(
    (r) =>
      (r.headBranch === 'dev' || r.headBranch === 'main') &&
      r.status === 'completed' &&
      r.conclusion === 'failure',
  )

  // Open P0/P1 issues.
  signals.issues = runGhJSON([
    'issue', 'list',
    '--label', 'P0', '--label', 'P1',
    '--json', 'number,title,url,labels',
  ])

  // Open PRs.
  signals.prs = runGhJSON([
    'pr', 'list',
    '--json', 'number,title,url,author',
  ])

  return signals
}

function formatSuggestText(result) {
  const lines = ['## ClaudeKit Maintainer Suggest', '']
  if (!result.topTarget) {
    lines.push('No actionable maintainer target detected. Nothing to suggest.')
    return lines.join('\n')
  }
  const top = result.topTarget
  lines.push(`Top target: ${top.type} [${top.priority}] (${top.count})`)
  lines.push(`  -> ${top.guidance}`)
  if (result.candidates.length > 1) {
    lines.push('')
    lines.push('Other candidates:')
    for (const c of result.candidates.slice(1)) {
      lines.push(`- ${c.type} [${c.priority}] (${c.count}): ${c.guidance}`)
    }
  }
  return lines.join('\n')
}

function buildSuggestion(root = resolveRoot()) {
  const candidates = rankCandidates(gatherSignals(root))
  return {
    timestamp: new Date().toISOString(),
    root,
    topTarget: candidates.length > 0 ? candidates[0] : null,
    candidates,
  }
}

function emitHook(additionalContext) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    }),
  )
}

function run(argv = process.argv.slice(2)) {
  // Suggest mode is a separate read-only code path. It deliberately does NOT
  // touch buildBriefing()/the hook path so session start stays fast.
  if (argv.includes('--suggest')) {
    const result = buildSuggestion()
    if (argv.includes('--json')) {
      console.log(JSON.stringify(result))
    } else {
      console.log(formatSuggestText(result))
    }
    return
  }

  const hookJSON = argv.includes('--hook-json')
  let briefing = ''
  try {
    briefing = buildBriefing()
  } catch (err) {
    if (hookJSON) return
    throw err
  }
  if (hookJSON) {
    if (briefing) emitHook(briefing)
    return
  }
  console.log(briefing || 'No maintainer actions detected.')
}

module.exports = {
  buildBriefing,
  buildSuggestion,
  driftSection,
  emitHook,
  formatSubmodulePointerLine,
  gatherSignals,
  isSubmoduleStatusLine,
  listSubmodules,
  parseSubmodulePointerLine,
  rankCandidates,
  resolveRoot,
  run,
  sanitizeLogLine,
}

if (require.main === module) {
  run()
}
