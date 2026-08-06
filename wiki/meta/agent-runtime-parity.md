---
title: Agent Runtime Parity
description: How Watchtower maps Claude Code setup to Codex setup without deleting or duplicating either runtime's files.
tags: [meta, codex, claude, agents, skills, hooks]
type: meta
status: normative
updated: 2026-07-22
related: [tending-the-garden, wiki-tool]
---

# Agent Runtime Parity

Watchtower keeps one project law and one set of reusable procedures while allowing
Claude Code and Codex to load them through their own native surfaces.

## Source Map

| Concern | Claude surface | Codex surface | Owner |
|---|---|---|---|
| Always-loaded repo law | `CLAUDE.md` | `AGENTS.md` points to `CLAUDE.md` | `CLAUDE.md` for shared law; `AGENTS.md` for Codex bootstrapping |
| Reusable workflows | `.claude/skills/` | `.agents/skills` symlink | `.claude/skills/` until a workflow needs a Codex-only fork |
| Wiki/project commands | `.claude/commands/` | `bin/wiki`, skills | `bin/` and wiki pages |
| Edit-time checks | `.claude/hooks/` | `.codex/hooks/` | shared mechanics in `bin/` where possible |
| Guard suite | `bin/check` | `bin/check` | `bin/check` |
| Project roster | your own roster file | the same roster file | one roster, read at runtime |

## Rules

- Keep Claude and Codex configuration additive. Do not remove `.claude/`,
  `CLAUDE.md`, Claude commands, hooks, or skills while setting up Codex.
- Keep shared workflow bodies single-sourced. Codex discovers the Claude skills
  through `.agents/skills`; do not hand-copy the skill roster or skill text.
- Put shared mechanical checks in `bin/` and have runtime-specific hooks call
  those commands. `bin/skill-lint` is the model.
- Keep user-specific Codex permissions outside the repo. Writable roots belong in
  `~/.codex/config.toml`, never in a tracked file, so a clone never carries one
  machine's paths.
- Run `bin/codex-setup check` after touching `.agents/`, `.codex/`, or shared
  skill tooling.
