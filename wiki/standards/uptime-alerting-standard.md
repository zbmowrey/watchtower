---
title: Outside-In Uptime Alerting Standard (v1 — external probing, check sets, alert routing, coverage)
description: The normative rule set for knowing a fleet app has stopped serving — why detection MUST be outside-in (the prober exercises DNS → TLS → CDN → tunnel → ingress → pod → real response), the off-fleet hosted-prober default and its acceptable variants, the mandatory apex + deep-route check pair with body assertions, single-fleet-channel routing with confirmation retries and recovery notices, coverage-at-birth plus roster reconciliation, the drill cadence that proves the alarm, and the dead-man that watches the watcher. Owns outside-in edge availability; inside-out metrics and SLOs stay with [[observability-slo-standard]], the in-cluster baseline with [[fleet-app-specification]], everything after the alert with [[incident-response-template]].
tags: [ spec, standard, uptime, availability, monitoring, alerting, probes, ops, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, observability-slo-standard, incident-response-template, fleet-queue-doctrine, security-governance, observability ]
---

# Outside-In Uptime Alerting Standard — v1

The **requirement of record for detecting that an app has stopped serving its users**. Normative
language per [[fleet-app-specification]]: **MUST / MUST NOT / SHOULD / MAY / ACCEPTED-DEVIATION**,
deviations recorded there, never silent. The mechanism is already fleet practice; the page exists so
a new app inherits it **by standard rather than by memory**.

**The split, stated once.** This page owns **outside-in edge availability**: is the public URL
returning real pages to a stranger on the internet. [[observability-slo-standard]] owns
**inside-out** signal (metrics, latency, errors, SLOs, burn); [[fleet-app-specification]] the
**in-cluster baseline** (`/up` probe, scheduler heartbeat); [[incident-response-template]]
everything after the alert. Nothing here restates those.

## §1 The four laws

1. **Detection is outside-in.** The prober MUST exercise the **full public chain** — DNS → TLS →
   CDN → tunnel → ingress → pod → a real rendered HTTP response — from outside the cluster. That
   chain *is* the product; a signal taken from inside it measures a component, not the service.
2. **Green in-cluster signals are not evidence of service.** The founding case: a multi-day fleet
   outage in which every page served 502 while pod probes passed, the heartbeat pinged and GitOps
   reported synced — the failure lived in the ingress hop nothing in-cluster exercises. Every
   component was healthy, the product was down, and an in-cluster prober would have agreed.
3. **Absence of alerts is not evidence either.** Every leg of the alarm — prober, transport,
   channel — is proven by a **positive signal** (§7) or a **deliberate drill** (§6); silence is
   indistinguishable from a dead monitor, and the fleet has met both.
4. **Coverage is a property of the standard, not of memory.** An app gets checks at birth (§5); a
   live app with no check is a **defect in the detector**, found by reconciliation, not by a user.

**The outcome:** when any app stops serving real pages at its public URL — 5xx, timeout, bad TLS,
DNS — a human is alerted in the channel they already watch, within minutes, with the app named.

## §2 The prober

- **Default posture — MUST: an off-fleet hosted external prober** (UptimeRobot-class), webhooking
  into the fleet alert path. Two decisive reasons: the detector **must not share a failure domain
  with what it watches** — the outage class this page exists for takes out the shared edge, and a
  prober behind that edge dies with it — and it adds **zero infrastructure that itself needs
  monitoring, patching and a deploy**. Its global probe network also gives §4's multi-location
  confirmation free; a second prober on another vendor network is a **MAY**, for contractual uptime.
- **Vantage point — MUST:** whatever the prober, it resolves the app's **public hostname** over the
  public internet and traverses the hops a browser does. **MUST NOT** target a ClusterIP, pod IP,
  internal service name, CDN-bypass hostname, or pinned `/etc/hosts` entry. **One skipped hop
  invalidates the vantage point** — that shortcut is law 2's blind spot, rebuilt.
- **Acceptable variant — MAY: a self-hosted prober** (Gatus, Uptime Kuma) for more checks, richer
  assertions, or custody of the data. Mandatory conditions: it runs **outside the cluster and edge
  it watches** (separate provider or region — not "another namespace"), egresses via the **public**
  edge per the rule above, carries its own dead-man (§7), and its host is itself in the roster.
  An ACCEPTED-DEVIATION only where it *replaces* the hosted prober.
- **Acceptable supplement — MAY: CDN-native health checks** (origin checks at Cloudflare), for
  origin-side signal and edge failover. **MUST NOT be the sole detector**: they originate *inside*
  the edge provider, after the DNS and CDN hops users traverse, so law 2's failure class is invisible.

## §3 The check set per app

- **Two checks minimum, per app — MUST:** (a) **apex** — `https://__APP__.<host>/`, expected status
  **200**; (b) **at least one deep content route** — a real page exercising routing, middleware,
  session bootstrap and **a database read**. Apex-alone is **not** coverage: it is the route most
  likely to be edge-cached or statically shelled, and deep routes 502 first. One deep check per
  materially different surface (marketing, app shell, API).
- **Choosing the deep route — MUST:** reachable **unauthenticated**, and a page users actually load.
  Where an app has no public content the **sign-in surface** qualifies — it renders the front-end
  bundle, boots session and CSRF, reads config from the database. A route built only to be probed
  does not qualify (§9).
- **Assertions — MUST:** an explicit **expected status** — of the *final* URL, following only the
  app's expected redirect chain — plus a **body substring** on every deep check where the prober
  supports it: a 200 returning an error shell, a maintenance page or an empty React root is a
  **false green** status-only checking cannot see. The substring MUST be stable text, never a build
  hash or copy marketing rewrites.
- **Timing and TLS — MUST:** apex at a **60 s** interval, every check **no worse than 5 minutes**
  (the detection-latency budget behind "within minutes"); a response slower than **30 s** fails,
  because a hung edge is an outage rather than slowness; certificate validation is never disabled
  (invalid or expired = down) and the prober warns on **expiry 14+ days ahead**.
- **Probe traffic — SHOULD** carry a stable identifying User-Agent, so it can be excluded from
  analytics and narrowly **exempted** from bot/WAF rules by UA plus source — a rule that blocks the
  prober reads as an outage, and loosening it wholesale is not the fix.

## §4 Alert routing

- **Destination — MUST: one fleet-wide alert channel** for every uptime alert, distinct from the
  per-app error channels [[fleet-app-specification]] owns. Ruled deliberately: this failure class is
  usually **fleet-shaped** — one tunnel, one ingress, one DNS zone — and per-app channels shred one
  incident into N conversations while hiding the correlation ("all six went at once") that names the
  cause. Down is also rarer and graver than an error spike, so it needs no per-app noise isolation.
  Error routing is unaffected: errors are app-shaped, availability is not.
- **Contents — MUST:** app name, URL probed, failure class (5xx / timeout / TLS / DNS / body),
  observed status, first-failure time.
- **Confirm, then dedupe — MUST:** never alert on a single failed probe — require **≥2 consecutive
  failures**, from **≥2 distinct probe locations** where offered; that is the whole flap-suppression
  budget, and §3's interval floor keeps it cheap in wall-clock. One incident then produces **one**
  alert thread: re-alerting per cycle is forbidden, and repeated up/down inside a short window
  collapses into that thread with a flap note.
- **Recovery — MUST:** a recovery notification to the same channel, naming the app and the
  **downtime duration**. Without it the channel cannot answer "is it still down" and §6's drill has
  nothing to assert on.
- **Chat, not mail — MUST:** the alert lands where humans already look; email MAY be a second leg
  (§7), never the only one. Phone/SMS paging is a **MAY**: with no on-call rotation, a 3 a.m. page
  has no responder.
- **Handoff — MUST:** the alert *is* the **Detect** step of [[incident-response-template]]'s
  lifecycle; severity and all that follows belong there. This page stops at "a human knows, and
  knows which app".

## §5 Coverage — checks at birth, then reconciliation

- **Provisioning — MUST:** creating the checks is a **step in new-app provisioning**, in the same
  sequence that creates the DNS record, the tunnel route and the app's alert channel — an app is not
  **live** until its check pair exists and has passed once.
- **Checks as config — SHOULD:** where the prober exposes an API or IaC provider, checks are
  declared **alongside the app's deploy config**, applied by the same GitOps flow, so a check change
  is reviewed like any other. Hand-clicked checks are the drift below must catch.
- **Reconciliation — MUST:** a scheduled job diffs the **app roster** against the prober's live
  check list and reports discrepancies to the fleet channel — a live app with no check, a check
  aimed at a renamed or decommissioned host, a target that is not the public hostname, a paused or
  quota-suspended check. **Each discrepancy is a finding**, disposed of like any other in
  [[security-governance]]. Retiring an app MUST delete its checks in the same change.

## §6 Proving the path — the drill

- **Cadence — MUST: at least quarterly**, deliberately break a **low-stakes target** and confirm the
  alarm fires end to end. The target is a staging host or a purpose-built canary serving a trivial
  page through the **identical** chain — never a production customer surface.
- **What it asserts — MUST:** (a) the alert lands in the fleet channel, (b) within the minutes §3's
  interval and §4's threshold predict, (c) recovery fires on restore. All three, or it failed.
- **After any change to the alert path — MUST:** the drill is part of that change, not a follow-up.
  Webhook rotation, channel migration, prober swap, plan change, notification-settings edit — each
  can sever the transport silently while every check stays green. Record date and outcome, the same
  accounting as the "last exercised" column in [[incident-response-template]]'s recovery-lever
  table, for the same reason: **an unexercised alarm is a hypothesis.**

## §7 Monitoring the monitor

- **The dead-man — MUST:** the prober emits a **periodic heartbeat to an independent dead-man
  service** (healthchecks.io — already carrying scheduler heartbeats per
  [[fleet-app-specification]]), and a missed ping alerts. A prober that dies, is suspended or
  exhausts its quota stops alerting, which is indistinguishable from health; self-hosted probers
  (§2) carry this without exception. That alert MUST route through a **different path** (channel
  *and* email) than the uptime alerts — two alarms on one webhook are one alarm.
- **MUST NOT** treat the prober's own dashboard as this control (nobody opens it), and **MUST NOT**
  let a monitor's *own* transport failure page a human — the anti-pattern
  [[fleet-app-specification]] already rules on for the heartbeat ping. The queue-plane twin of this
  section is [[fleet-queue-doctrine]] §5's liveness canary.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Users see 5xx; every in-cluster signal green | The founding class — a hop nothing in-cluster exercises (ingress, tunnel, DNS, TLS) | The outside-in pair (§1–§3) is the only detector that sees it; verify the check really traverses the public chain |
| Checks green, users report a broken app | Apex-only coverage; status-only assertion passing on an error shell; check aimed at a health stub | Add the deep content route and a body substring (§3) |
| Alert storm on every deploy | No confirmation retries; rollout briefly drops all ready replicas | Confirmation threshold (§4); fix the rollout so a ready replica always serves — not by muting the check |
| Alert fired, nobody saw it | Email-only routing; a channel nobody watches; webhook rotated and never re-tested | Route to the fleet channel (§4); prove it with a drill (§6) — exactly what §6 exists to catch |
| Outage found by a user, not the monitor | App never got checks at provisioning; check points at a renamed/dead host | Treat as a detector defect; reconciliation is the control (§5) |

## §9 Considered and rejected

- **An in-cluster prober** (ClusterIP, pod IP, internal service name) — recreates exactly the blind
  spot the founding outage lived in, while *looking* like monitoring.
- **A self-hosted prober as the fleet default** — good tool, wrong default: infrastructure that must
  itself be run, patched and monitored, and careless placement shares a failure domain with its
  target. Acceptable variant under §2's conditions.
- **A dedicated `/health` or `/status` route as the probe target** — one that touches nothing proves
  nothing (the in-cluster probe again, from further away); one that touches everything is an
  unauthenticated dependency-enumeration and load-amplification surface. Probe the pages users load.
- **Per-app alert channels for uptime** — fragments one fleet-shaped incident into N conversations
  and hides the correlation that names the cause. Errors stay per-app because errors are app-shaped.
- **Paging on latency or SLO burn from these probers** — a few samples a minute is a poor latency
  estimator and a worse budget ([[observability-slo-standard]]'s job). A public status page is
  likewise downstream of detection, not a detector.
- **Blanket suppression during deploys or maintenance windows** — the deploy is the *most* likely
  moment to break, and convenience-driven suppression is how a multi-day outage stays quiet. Narrow,
  per-check, **auto-expiring** silences only, never on the apex check.
- **Alerting only after a long failure window** (15+ minutes) to buy quiet — pays in detection
  latency; confirmation retries (§4) buy the same quiet for one probe interval.
