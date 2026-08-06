---
title: Incident Response Template
description: A skeleton incident-response process for a small team — the severity ladder, the five-phase lifecycle, the recovery-levers principle that makes the rest work, and the five scenarios worth writing a runbook for before you need one.
tags: [security, incident-response, runbook, severity, recovery, template]
type: security
status: reference
updated: 2026-08-05
related: [security-governance, defense-in-depth-model]
---

# Incident response template

A process you can hold in your head, sized for a team that does not have an on-call rotation. Fill
in the bracketed parts for your own system and keep the result somewhere reachable when your
primary tooling is the thing that is broken.

The failure this prevents is not "we responded badly". It is "we spent the first forty minutes
working out who decides and where the button is".

## Severity ladder

Severity sets urgency and who gets woken, nothing else. Keep it to four levels; a ladder with more
rungs than that becomes a classification debate held during an outage.

| Level | Shape | Response |
|---|---|---|
| **1** | Production down, or data exposed or destroyed | Drop everything. Start now, at any hour. |
| **2** | A major function broken, or a credible compromise with no confirmed exposure | Start within the hour, during waking hours. |
| **3** | Degraded or partial, with a workaround | Next working session. |
| **4** | Contained, cosmetic, or already mitigated | Normal backlog. |

Classify on **impact**, never on cause. "A dependency has a critical CVE" is not a severity; "that
CVE is reachable from an unauthenticated route" is.

When you cannot tell whether it is a 1 or a 2, it is a 1. Downgrading later costs nothing;
upgrading later costs the time you already lost.

## Lifecycle

1. **Detect.** Something fired, or someone noticed. Record the time and what you actually saw, not
   your first theory about it.
2. **Triage.** Assign severity, and state the blast radius as a question with an answer: what data,
   which users, since when.
3. **Contain.** Stop it getting worse. Containment is not a fix, and it is allowed to be ugly:
   revert, disable, revoke, scale to zero.
4. **Eradicate.** Remove the cause rather than the symptom, now that nothing is actively burning.
5. **Recover.** Restore service, then **verify from outside the system** rather than trusting the
   absence of alerts.

Then a written follow-up while it is fresh: what happened, what the actual cause was, and what made
it take as long as it did. The last part is the valuable one and the one usually skipped. Findings
from it enter the three-way switch in [[security-governance]] like any other finding.

Keep a rough timeline as you go. Reconstructing one afterwards from memory and logs costs more than
writing it down cost.

## Know your recovery levers cold

The single highest-leverage preparation, and the thing to fill in first:

> For every way your system can break, name the **one action** that stops the bleeding, and be able
> to run it from memory.

Typically: revert the deployed version, revoke a credential, disable a feature flag, restore a
database to a point in time, drain traffic. For each one, know the command, know how long it takes,
and **know that it works** because you have run it deliberately at least once. A rollback path you
have never exercised is a hypothesis, and an incident is a poor time to test it.

Write yours here:

| Lever | Command | Time to effect | Last exercised |
|---|---|---|---|
| Roll back a deploy | | | |
| Revoke a credential | | | |
| Disable a feature | | | |
| Restore data to a point in time | | | |
| Drain or block traffic | | | |

The last column is the one that decays. An untested lever belongs on the backlog, not in the table.

## Scenarios worth a runbook

Five cover most of what actually happens. Write each as steps, not prose.

**A. A bad deploy.** Broken or down right after a release. Roll back first and diagnose second: the
rollback is cheap and reversible, and diagnosing while users are down buys nothing. Know whether
your rollback covers data migrations, because usually it does not.

**B. A suspicious workload.** Unexpected egress, unexplained processes, or unaccountable load.
Isolate before investigating: preserve the evidence, remove it from the serving path, then look.
Restarting it destroys exactly what you need.

**C. A leaked credential.** Anything committed, logged, or pasted. Rotate first, always, and assume
compromise regardless of how briefly it was exposed. Then work out its blast radius, then work out
how it got out. Rotation is cheap; the assumption that nobody saw it is not.

**D. A vulnerability in something already deployed.** First establish reachability rather than
severity: an unreachable critical outranks nothing. If it is reachable, patch and ship on the
normal path, because your normal path is faster and safer than an emergency one.

**E. A data incident.** Exposure, corruption, or deletion. Stop the writes before anything else,
determine the last known-good point, then restore. Deletion and exposure are different emergencies
that feel identical in the first ten minutes; decide which you have before acting.

## What this template does not give you

A process document is not detection. If nothing tells you an incident has started, everything above
begins whenever a user happens to complain. Before refining the ladder, confirm that something
actually pages a human, and that a monitor being unreachable does not page anyone at all.
