# Watchtower Codex Guide

This repository has a detailed Claude Code operating manual in `CLAUDE.md`. Do not
remove, rename, or weaken that file. For Codex, treat this file as the entry point
and `CLAUDE.md` as the shared project law.

## First read

- Read `CLAUDE.md` before doing substantive project work.
- Use `README.md` for the quick map of this repository.
- Search the wiki before the web: `bin/wiki search <kw>`, then inspect or inject the
  owning page as needed.

## Operating rules

- Keep Claude and Codex configuration additive. Do not delete `.claude/`, `CLAUDE.md`,
  Claude commands, hooks, or skills while setting up Codex.
- Push feature and fix branches freely when asked, but do not merge PRs, push to the
  default branch, or force-push without explicit approval.
- Deploy deliberately. Merging to the default branch can trigger production delivery.
- Preserve user work in a dirty tree. Do not revert changes you did not make.

## Commands

- Run the guard suite with `bin/check`.
- Check the Codex parity layer with `bin/codex-setup check`.
- Search and maintain the wiki with `bin/wiki` (`search`, `inject`, `lint`, `index`).

## Wiki maintenance

- The wiki is durable memory. Write back durable facts you learn, one fact in its
  owning page and links elsewhere.
- After wiki edits, run `bin/wiki lint` and `bin/wiki index`; use `bin/check` when
  touching repo structure or generated hubs.
- Dated rollout and status facts belong under `wiki/logs/`, not in normative pages and
  not in this file.

## Codex-specific workflow

- Keep `AGENTS.md` small. Add only recurring, always-on rules here; put detailed
  procedures in skills or wiki pages.
- Use nested `AGENTS.md` or `AGENTS.override.md` only when a subtree genuinely has
  different rules.
- Codex skills are discovered through `.agents/skills/`, which mirrors
  `.claude/skills/`. Keep the workflow source single-sourced; never hand-copy a skill.
- Keep repo-local Codex hooks and config in `.codex/`. Keep writable roots,
  model/provider settings, and credentials in user-level Codex config, so a clone never
  carries one machine's paths.
- If a recurring workflow outgrows this file, create or update a skill rather than
  expanding `AGENTS.md`.
- Prefer repo-local mechanical checks over memory: run the relevant command and report
  whether it passed.
