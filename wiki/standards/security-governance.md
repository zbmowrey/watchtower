---
title: Security Governance — green-then-ratchet
description: How security and quality findings are operated rather than merely discovered — the four-beat adoption discipline that makes a gate stick, the three-way switch every finding passes through (fix now, accept, ratchet later), the three exception artifacts that keep an accepted gap owned, and the schema a risk-register entry must carry.
tags: [standard, security, governance, ratchet, gates, remediation, risk-register]
type: standard
status: normative
updated: 2026-08-05
related: [laravel-engineering-standard, fleet-app-specification, defense-in-depth-model, incident-response-template]
---

# Security governance

This page owns the **operating discipline** for findings: not which scanners you run, but what
happens to a finding once one of them speaks. It is deliberately tool-agnostic. Swap every scanner
in the stack and the machinery below is unchanged.

Several pages in this repo already use the word "ratchet" as if it were defined. This is where it
is defined.

## Green-then-ratchet — the four beats

Most controls fail at adoption, not at design. A gate switched on at its aspirational threshold
goes red on day one, blocks work unrelated to it, and gets disabled within the week. The adoption
sequence that survives contact:

1. **Adopt at a floor the code passes today.** Either genuinely clean, or with existing debt
   captured in a baseline so the gate is green from the first run. A gate that has never been green
   has never been a gate.
2. **Gate in CI, not in a hook.** Local hooks are developer experience: they surface a finding
   early and they can be bypassed with a flag. CI is the wall. Where a control structurally cannot
   run in CI, say so out loud and treat it as advisory rather than pretending otherwise.
3. **The gate's job is new findings.** Once green, its whole purpose is to fail on the day
   something new appears. A tool that surfaces findings on a new flow has earned its keep; that is
   the gate working, not the gate malfunctioning.
4. **Move the floor one direction only.** Tighten as the backlog burns down. Never re-loosen a
   threshold to absorb new debt, because a floor that can move both ways is not a floor, it is a
   preference.

The asymmetry in beat 4 is the whole mechanism. Everything else is bookkeeping.

## The three-way switch

Every finding, from any source, leaves through exactly one of three doors. Deciding which door is
the core judgment this discipline encodes.

```
                    finding surfaced
                          |
        +-----------------+-----------------+
        |                 |                 |
     FIX NOW           ACCEPT          RATCHET LATER
   a convergence     a register        a baseline or
       change           entry           ignore entry
   (close the gap)   (decide not      (capture it, then
                       to fix)          burn it down)
```

**Fix now** is the default, and most findings should take it. The change closes the gap and leaves
the gate green at the new, stricter state. Most security and quality lifts are the same move:
adopt the control, fix what it surfaces, leave the gate behind to prevent regression.

**Accept** is for a finding where fixing loses to documenting: the fix breaks shipped behavior,
there is no trusted path to the dependency, or the residual risk does not justify the work. It
becomes a register entry carrying the full schema below.

**Ratchet later** is for a finding that is real and should be fixed but cannot be in this pass,
usually on volume. Capture it in a baseline so the gate still fails on anything *new*, and put the
existing debt on a burndown.

**The boundary between the last two is the part people get wrong.** *Accept* means we have decided
not to fix it, and we revisit only when a stated trigger fires. *Ratchet* means we will fix it, just
not yet. Only one of them has a finish line. Filing a "we'll get to it" into the register is how a
deferral quietly becomes a permanent decision nobody ever made.

## Exceptions are documented, never deleted

A suppressed finding and a governed one look identical at the command line. The difference is
whether it left a record. Three artifact classes, and everything accepted lives in one of them:

- **Baselines** (a captured count or file of known findings) — tracked debt, scheduled to shrink.
- **Scanner ignore files** — path-scoped, each entry carrying a written reason. Prefer a format
  that supports an expiry, so the exception re-blocks rather than outliving its justification.
- **The risk register** — decisions not to fix.

A finding silently suppressed is a bug in the process. A finding sitting in one of these three is a
decision with an owner. Nothing accepted should be reachable only through a scanner's exit code.

## Risk-register entry schema

An entry that omits any of these is not a decision, it is a note:

| Field | What it records |
|---|---|
| **Decision** | accept · defer · cannot pursue |
| **Why** | the reasoning, in enough detail that a stranger can re-evaluate it |
| **Compensating controls** | what else stands between this gap and harm |
| **Residual risk** | what remains exposed after those controls, stated plainly |
| **Revisit trigger** | the concrete event that reopens this — a version, a dependency, a scale threshold, a date |

The revisit trigger is the field that keeps the register from becoming a graveyard. "Revisit
someday" is not a trigger. "Revisit when we adopt a CNI that enforces network policy" is.

## Remediation cadence

Cadence is structural rather than scheduled, and the shape matters more than any interval:

- **Per change.** Every gate runs on every proposed change, so a new finding blocks the merge. This
  is the fastest possible loop, and it is why most findings never reach a backlog at all. There is
  no clock to start because the change cannot land.
- **Per deploy.** Artifact-level scanning (images, dependencies as shipped) runs at deploy, so
  packaging-level findings are caught before rollout rather than on a scan schedule.
- **Scheduled.** The gap in the first two: a vulnerability disclosed against something already
  merged and already deployed is invisible until the next change touches it. Closing that needs
  something that runs on a clock rather than on an event. Automated dependency updates are the
  usual answer. Know whether you have this; if you do not, know that you do not.
- **On demand.** A deeper audit surfaces the next tranche, which then re-enters the three-way
  switch above.

## Ownership

Ownership is a property of the artifacts, not a separate tracking system. A register entry names
its decision and trigger. A baseline entry carries its reason and its burndown. An open ratchet is
named in the standard it belongs to. If a gap exists in none of them, it is not owned, which is the
one state this discipline exists to prevent.

Do not build a severity matrix or an SLA clock before you have this. A gate that blocks the merge
has already beaten any SLA you could write down.
