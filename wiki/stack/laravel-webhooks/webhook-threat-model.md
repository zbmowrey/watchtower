---
title: Webhook Threat Model — STRIDE Across the Delivery Chain
description: The STRIDE analysis of the fleet outbound webhook system — spoofing through elevation of privilege across the emitter, engine, management surface, stored state, and receiver — with every threat mapped to its mitigation page and to the layer vocabulary of the defense-in-depth model. Companion to the signing scheme and egress guards, which own the controls this page maps; it also walks the nine defense layers to show where webhook-specific controls sit and where fleet baseline carries the load.
tags: [stack, webhooks, laravel, security, stride, threat-model]
type: stack
status: reference
updated: 2026-08-08
related: [defense-in-depth-model, fleet-webhook-specification, webhook-signing-scheme, webhook-egress-guards, webhook-data-model, webhook-delivery-model]
---

# Webhook Threat Model — STRIDE Across the Delivery Chain

Fleet norms → [[fleet-webhook-specification]] §4. Method: STRIDE per element over the webhook
system, with each threat mapped to the control that answers it and to the layer it lives on in
[[defense-in-depth-model]] — whose organizing rule governs this page too: no single control is
load-bearing, and a threat must cross every applicable layer. This page models the *specified*
system, which is public by intention; a filled-in posture map of your own deployment belongs in
your private notes, exactly as the model page rules.

The defining inversion to hold in mind throughout: in most SSRF literature the attacker-controlled
URL is an input-handling bug. In a webhook engine, an attacker-controllable outbound URL **is the
product**. The design assumes every Target URL is hostile until the guards say otherwise.

## Elements and trust boundaries

The system decomposes into five elements — the **emitter** (Actions dispatching events into the
outbox), the **engine** (queue workers rendering, signing, and delivering), the **management
surface** (REST API + React UI), **stored state** (event rows, Deliveries/Attempts, Target
secrets → [[webhook-data-model]]), and the **receiver** (an external system the fleet does not
control). Four boundaries matter:

- **B1** — webhook manager ↔ management surface: the authentication/authorization boundary
  (the managing plane — operator guard where one exists, web guard otherwise →
  [[webhook-management-surface]]).
- **B2** — engine ↔ receiver: the public-internet egress boundary; the destination is
  user-supplied by design.
- **B3** — engine ↔ internal network and cloud control plane: the boundary SSRF crosses.
- **B4** — stored state ↔ anything reading it: history, logs, backups, exports.

## The STRIDE table

Layer names are [[defense-in-depth-model]]'s vocabulary, verbatim.

| ID | Threat | Mitigation | Layers |
|---|---|---|---|
| S-1 | A third party forges deliveries to a receiver, impersonating the fleet app. | HMAC-SHA256 signature binding timestamp, method, request target, and body in one effect-bound construction; receiver verification requirements → [[webhook-signing-scheme]]. | Application runtime |
| S-2 | The receiver is impersonated (DNS hijack, BGP mishap, MITM) to capture payloads and per-Target credentials. | HTTPS with certificate verification always on, DNS pinning, redirect refusal → [[webhook-egress-guards]]. | Transport / edge |
| S-3 | An unauthorized principal operates the management surface. | The managing guard — the operator plane where the app has one, the web guard otherwise — plus the `webhooks:manage` permission + policies on every object; Sanctum abilities with the grant-time clamp on the API plane → [[webhook-management-surface]], [[fleet-api-specification]] §9. | Application runtime |
| T-1 | A delivery is modified in transit. | TLS integrity plus the effect-bound signature — method, request target, and body all sit inside the MAC, so any change to what is asked of the receiver invalidates it → [[webhook-signing-scheme]]. | Transport / edge · Application runtime |
| T-2 | Template tokens inject into request framing — CRLF into header values, traversal via the path extension. | Save-time token validation and encoding rules of the renderer → [[webhook-templating]]; no user-authored code exists to escalate with. | Application runtime · Source / static |
| T-3 | A compromised manager account re-points a Target at an attacker endpoint — exfiltration by configuration. | `webhooks:manage` gating, soft target verification before Webhooks activate, audit trail with denormalized names, structured log on every config mutation → [[webhook-management-surface]]. | Application runtime · Process / governance |
| T-4 | A captured delivery is replayed at the receiver later, or at a different endpoint sharing the Target secret. | Timestamp bound into the MAC with a tight receiver tolerance; the method and request target sit inside the MAC and the newline-delimited construction is injective — cross-verb and cross-path replay are closed outright, with no field-boundary splice; envelope-`id` dedupe on the receiver → [[webhook-signing-scheme]], [[webhook-receiver-guide]]. | Application runtime |
| T-5 | A crafted `webhook_name` or `event_type` executes as a formula when an exported CSV opens in a spreadsheet (CWE-1236) — the admin who opens the export is a cross-trust-boundary victim. | Every exported cell is neutralized per OWASP CSV-injection guidance: values beginning with `=`, `+`, `-`, `@`, tab, or CR are prefixed with a single quote → [[webhook-management-surface]]. | Application runtime |
| T-6 | Tampering with the unsigned engine headers (`X-Webhook-Id` / `X-Webhook-Test` / `X-Webhook-Replay`) — dedupe poisoning in receivers that read the id from the header instead of the signed material, and marker-driven behavior divergence in receivers that branch on test/replay. | TLS header integrity; save-time validation **rejects** any configuration with no signed copy of the event id ([[webhook-templating]]), so a signed id always exists for the receiver to prefer — plus the receiver-guide guidance to prefer it and to process every verified delivery on one code path → [[webhook-signing-scheme]], [[webhook-receiver-guide]]. | Transport / edge · Application runtime |
| T-7 | Attacker-influenceable strings (`webhook_name`, `event_type`, `target_url`, and kin) forge or corrupt structured log and audit lines — newline/control-character injection, the log-borne sibling of T-5. | Every such field written to structured logs is emitted through the JSON serializer — control characters and quotes escaped, never string-concatenated — per the fleet structured-JSON logging law; the audit-line field inventory → [[webhook-management-surface]]. | Application runtime · Data |
| R-1 | Dispute over what was sent: "you never called us" / "we never received that". | Persisted event rows plus Delivery/Attempt history capturing the request as sent and the response received, within the retention window → [[webhook-data-model]], [[webhook-delivery-model]]. | Data |
| R-2 | A config change or secret rotation is denied by its author. | `created_by`/`updated_by` on config entities + structured stderr JSON on every mutation and rotation, names denormalized so deletion never orphans the trail → [[webhook-management-surface]]. | Data · Process / governance |
| I-1 | SSRF — the engine is coerced into reading internal services or the cloud metadata endpoint. | The complete egress guard set: global-unicast-only destinations, DNS pinning, no redirects, port allow-list, raw-IP denial → [[webhook-egress-guards]]. | Application runtime · Cluster / IaC |
| I-2 | Target secrets or per-Target auth material are recovered from the app. | Server-generated, shown once, encrypted at rest, no retrieval surface, masked in history drill-downs → [[webhook-signing-scheme]]. The guarantee covers **auth-sourced values**; path-borne capability URLs are a distinct exposure class → I-6. | Secrets |
| I-3 | Cross-tenant reads — one org subscribes to or browses another's events and history. | Tenant-DB / org-FK scoping, policies on every object, scoped nested bindings ([[fleet-api-specification]] API-205); history rows denormalize the owning scope (`org_id` stamped at write on events and deliveries), so fan-out matching and history reads stay org-filtered even after config is purged → [[webhook-data-model]]. | Application runtime · Data |
| I-4 | Payloads and captured receiver responses at rest outlive their need. | Capped response capture and bounded retention with scheduled pruning — numbers owned by [[webhook-delivery-model]] and [[webhook-data-model]]. | Data |
| I-5 | Secrets bleed into logs or error tracking. | Structured logs carry IDs, statuses, and durations, never secret material; Sentry receives engine faults only, never customer endpoint traffic → [[fleet-webhook-specification]] §9 observability. | Application runtime |
| I-6 | Path-borne capability URLs: an incoming-webhook URL (Slack, Discord) stored as a Target base path **is a bearer credential**, and `target_url` displays unmasked — readable by every `webhooks:read` holder and by `/control` support, in Target views, delivery-history attempt drill-downs, and audit lines. The CSV export deliberately carries only `target_host`, which omits the path-borne credential ([[webhook-management-surface]] owns the column set). | Accepted and documented in v1, not masked: the template library flags capability-URL Targets as readable by all managers and support ([[webhook-template-library]]), and secrets that must stay masked belong in the custom-secret-header auth option ([[webhook-signing-scheme]]). Recorded as residual risk (below); path-masking of `target_url` is the escalation option. | Application runtime · Process / governance |
| D-1 | Slow or black-holed receivers pin the workers. | Connect/total timeouts, per-Target concurrency cap and rate limit, the dedicated `webhooks` queue isolating the blast, auto-disable of persistently failing Webhooks → [[webhook-delivery-model]]. | Application runtime |
| D-2 | Event storms or malicious fan-out flood the queue. | Per-org Target/Webhook quotas ([[fleet-webhook-specification]] §8) and per-Target caps; queue isolation keeps other workloads unharmed. | Application runtime |
| D-3 | Expensive management surfaces are hammered — test-fire, single replay, bulk replay, CSV export, the verification ping. | Named rate limiters per [[fleet-api-specification]] API-1003 → [[webhook-management-surface]]. | Application runtime |
| D-4 | The engine is weaponized against a third party by registering the victim as a Target. | Per-Target concurrency cap (default-on) and rate limit (opt-in), consumed by queued and synchronous attempts alike; quotas, auto-disable on sustained failure, the port allow-list, and an audit trail that names the abuser → [[webhook-egress-guards]], [[webhook-delivery-model]]. | Application runtime · Process / governance |
| D-5 | A hostile receiver answers with an oversized or decompression-bomb response body, exhausting worker memory inside the timeout window. | Bounded response read: the client streams and hard-aborts at the socket-read cap, and transparent decompression is disabled — the caps are [[webhook-delivery-model]]'s (the 16KB history capture is storage, not the bound). | Application runtime |
| E-1 | SSRF chained into cloud credentials: metadata endpoint → keys → account takeover. | Metadata addresses denied absolutely — the one guard with no carve-out in any environment — plus DNS pinning and redirect refusal; beside them, cluster egress policy and IMDS hardening → [[webhook-egress-guards]]. | Application runtime · Cluster / IaC · Secrets |
| E-2 | The template engine becomes code execution. | No user-authored code, ever: tokens, a fixed formatter set, and Mustache-style sections — no eval path exists by construction → [[webhook-templating]]; arch tests pin the template interface. | Source / static · Application runtime |
| E-3 | A low-privilege user reaches management verbs or another org's objects. | The single `webhooks:manage` permission gates every route on the managing plane; policies authorize ownership per object; token abilities never exceed the minter's permissions on that plane → [[webhook-management-surface]], [[fleet-api-specification]] §9. | Application runtime |

## Depth beside the guard

Two threats justify the whole layered posture, and both show the [[defense-in-depth-model]] rule
in action:

- **E-1, metadata credential theft** — the worst outcome the system can produce. The egress
  guards are the primary control, but they are code, and code has bugs; the cluster egress
  policy (Cluster / IaC) and IMDS hardening exist so a guard bypass finds a second wall, and
  scoped cloud credentials (Secrets) exist so a second-wall breach finds a bounded prize. The
  moment anyone argues the network policy is redundant *because* the guard exists, they have
  identified the load-bearing control — and the argument for keeping both.
- **S-1, forged deliveries** — the signature is the primary control, but it only works if
  receivers verify, which the fleet cannot force. The backing layers are documentation quality
  (the generated event reference and [[webhook-receiver-guide]] make verification the path of
  least resistance) and TLS server authentication, which at least confines forgery to parties
  who can beat the receiver's transport.

## Layer coverage

The [[defense-in-depth-model]] walk, applied honestly — empty cells are findings, and two rows
here are deliberately carried by fleet baseline rather than webhook-specific controls:

| Layer | What the webhook system places there |
|---|---|
| Source / static | Arch tests (event suffix, template interface, DTO purity); pinned unit tests on signing, guard logic, wire-type derivation; no scripting surface to analyze because none exists. |
| Dependencies / supply chain | A bespoke engine on framework primitives (queues + the `Http` facade) — the rejected third-party webhook package is attack surface never imported. Lockfile and advisory law are fleet-wide. |
| Application runtime | Signing, egress guards, permission + policy gates, quotas, per-Target caps, save-time template validation, named rate limiters. |
| Container image | Nothing webhook-specific — the fleet baseline per [[fleet-app-specification]] carries this layer. |
| Cluster / IaC | Egress network policy to 443 for workers; dedicated `webhooks` queue isolation; worker sizing deliberately left to ops. |
| Transport / edge | HTTPS-only, certificate verification, redirect refusal, the port allow-list. |
| Secrets | Server-generated shown-once secrets, encrypted casts, no retrieval surface, rotation overlap (0–24h, overlap 0 the compromise procedure), masking in history. |
| Data | Tenancy scoping, bounded retention with scheduled pruning, capped response capture, denormalized audit rows that survive deletion. |
| Process / governance | The spec's deviation register, audited config mutations and rotations, soft target verification, auto-disable with owner notification, [[security-governance]] adoption discipline. |

## Residual risk — accepted, not ignored

- **Receiver-side verification cannot be forced.** The soft verification ping proves
  reachability, not that verification code exists. The lever is DX: worked examples and
  generated docs, per the Stripe bar.
- **At-least-once means duplicates.** Deduplication by envelope `id` is deliberately the
  receiver's control; the fleet's contribution is a stable id and honest documentation
  (→ [[webhook-delivery-model]], [[webhook-receiver-guide]]).
- **Stored payloads are an exposure bounded by retention**, not eliminated — snapshots, history,
  and captured responses exist because replay and dispute resolution (R-1) require them. The
  bound is the pruning schedule (→ [[webhook-data-model]]).
- **No payload size cap** is a considered rejection in [[fleet-webhook-specification]]; queue
  amplification is bounded by quotas and per-Target caps instead.
- **Capability-URL Targets are visible to every manager and to support** (I-6). A Slack or
  Discord incoming-webhook URL is a bearer credential carried in `target_url` — unmasked in
  Target views, delivery-history attempt drill-downs, and audit lines, because the "request as
  sent" drill-down (WH-704) and the denormalized history depend on the literal URL. The CSV
  export deliberately carries only `target_host`, which omits the path-borne credential
  ([[webhook-management-surface]] owns the export's column set). Accepted for v1
  with documentation steering secrets toward the masked auth options; path-masking of
  `target_url` is the recorded escalation option if the exposure proves unacceptable.
- **A compromised worker host** defeats every application-layer control here; that scenario is
  owned by fleet infrastructure posture ([[fleet-app-specification]], [[defense-in-depth-model]]),
  not by this table.
