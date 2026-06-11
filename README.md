# kai-personal-claude

Personal Claude Code plugin shipping my daily-driver skills under the `kai:` namespace.

## Skills

| Skill | What it does |
|-------|--------------|
| `/kai:maintainer` | End-to-end issue resolution pipeline: triage and BUG/FEATURE auto-classify, GitHub issue create/claim, worktree, flag-routed implementation, UI evidence, PR, review feedback loop, cleanup. |
| `/kai:commit` | Analyze git changes, group related files, and create granular conventional commits. |

## Install

```text
/plugin marketplace add kaitranntt/kai-personal-claude
/plugin install kai@kai-personal-claude
```

## Prerequisites

- `gh` CLI, authenticated.
- [ClaudeKit](https://claudekit.dev) installed. `/kai:maintainer` is an orchestrator: it
  routes implementation work to ClaudeKit skills (`/fix`, `/cook`, `/ck:plan`,
  `/brainstorm`, `/debug`, `/worktree`, `/preview`, `/code-review`, `/git`, `/team`).
  `/kai:commit` works standalone.
- Node.js (only for `--from-signals`, which runs the bundled read-only suggester
  `skills/maintainer/scripts/maintainer-status.cjs`).

## Workflow assumptions

- Dev-first branching: PRs target `dev` by default; `--pr-main` is the explicit
  hotfix exception. Adjust per repo if you work trunk-based.
- Worktree-only changes: the maintainer never edits the original checkout directly.

## Development

`skills/maintainer/SKILL.md` is generated. Edit `SKILL.src.md` or files under
`skills/maintainer/references/`, then rebuild:

```bash
cd skills/maintainer && ./build.sh
```

## License

MIT
