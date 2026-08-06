---
title: Defense-in-Depth Model — the layer checklist
description: A coverage template for reasoning about application security by layer rather than by control list — the eight layers a threat must cross, what class of control belongs at each, and the method for mapping your controls to recognized frameworks (OWASP Top 10, ASVS, CIS, NIST CSF) for legibility without pursuing certification.
tags: [security, defense-in-depth, layers, owasp, asvs, cis, nist, coverage]
type: security
status: reference
updated: 2026-08-05
related: [security-governance, incident-response-template, fleet-app-specification]
---

# Defense-in-depth model

A **coverage template**, not an inventory. Its use is to find the layer you have not thought about
yet. Fill the right column for your own system and the empty cells are the finding.

The organizing rule: no single control is load-bearing, and a threat must cross **every applicable
layer**. When you catch yourself explaining why one control makes another unnecessary, you have
found the load-bearing control and the argument for adding depth beside it.

## The layers

| Layer | What guards it | Ask yourself |
|---|---|---|
| **Source / static** | Static analysis at a strict level, taint analysis, complexity ceilings, architecture tests, formatting | Can a dangerous shape reach the default branch without a human noticing? |
| **Dependencies / supply chain** | Advisory blocking at install time, audit at build time, committed lockfiles, trusted install channels only | If a dependency you already ship is disclosed tomorrow, what tells you? |
| **Application runtime** | Validation at the HTTP edge, output escaping, a content security policy, authorization checks, rate limits | Which of these is enforced by the framework and which by developer memory? |
| **Container image** | A minimal, non-root, patched base; no shell where none is needed; scanning before rollout | Does a scan failure actually stop the deploy, or only annotate it? |
| **Cluster / IaC** | A restricted pod baseline, read-only root filesystems, dropped capabilities, misconfiguration scanning, network segmentation | Which of these are *enforced* rather than *configured*? |
| **Transport / edge** | TLS termination, HSTS, forced HTTPS URL generation, proxy trust scoped to what the edge actually sets | What does the app believe about a request that an attacker can set? |
| **Secrets** | A real secret store, scoped tokens, rotation, no credentials in the repo, no piping remote scripts into a shell | If one token leaked, what is its blast radius and how fast can you rotate it? |
| **Data** | Encryption in transit and at rest, backups with a tested restore, retention limits, tenant isolation | Have you restored from a backup, or only taken them? |
| **Process / governance** | Required status checks, branch protection, the adoption discipline in [[security-governance]] | Can the controls above be bypassed by someone in a hurry? |

The right-hand column is the point. A layer with a control listed and no honest answer to its
question is a layer you have decorated rather than defended.

## Mapping to frameworks

Mapping controls to a recognized framework buys **legibility**: it lets a newcomer, an auditor, or
your future self see coverage and gaps in a shared vocabulary. It is not the same as certifying,
and pursuing the map as a goal in itself produces documentation instead of security.

The method:

1. **Pick the frameworks that match your layers.** An application lens, an application verification
   standard, an infrastructure benchmark, and a program-level framing cover most systems. More than
   that and you are maintaining a spreadsheet.
2. **Declare a target level rather than implying all of them.** "Level 1 broadly, level 2 on
   authentication, session, and access control" is a claim you can hold. "ASVS compliant" is not a
   claim at all.
3. **Map to controls you actually run**, and let the empty rows show. A map that is complete on
   first writing was written backwards from the framework instead of forwards from the system.
4. **Re-derive it from the code, not from the last version of the map.** A control mapping is a
   snapshot of a moving system, and it decays exactly as fast as the system moves.

A blank cross-reference to fill in:

| Framework | Scope | Your target | How it is enforced | Gaps |
|---|---|---|---|---|
| Application top-ten list | the primary application lens | | | |
| Application verification standard | per-requirement verification depth | | | |
| Infrastructure benchmark | the cluster or host baseline | | | |
| Program framework | identify · protect · detect · respond · recover | | | |

Where a framework control is enforced by an automated gate, name the gate. A row whose enforcement
column reads "code review" is a row that describes an intention.

## Using this page

Walk the layer table when you add a surface, adopt a dependency class, or move a workload. The
question is never "is this secure" but "which layers does this change cross, and which of them
still hold". What you record about your own system belongs in your private notes, not here: this
page is the template, and a filled-in copy of it is a map of where to attack you.
