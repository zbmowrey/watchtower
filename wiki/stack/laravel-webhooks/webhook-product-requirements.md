---
title: Webhook Product Requirements — User Stories and Acceptance Criteria
description: The user-requirements register for the fleet webhook system's management experience — exhaustive "As a…, I want…, so that…" stories grouped by feature area (onboarding/empty states, targets, webhooks, templates, testing, history, replay, recycle bin, notifications, docs, access and audit), each with concrete, testable Given/When/Then acceptance criteria. This page is where the required React UI (Tier E — expressive, per-app presentational freedom) is specified: capabilities and outcomes, never pixels. Mechanics live on the sister pages — endpoints, permissions, and lifecycle on webhook-management-surface; retry, replay, and test-fire semantics on webhook-delivery-model; token language on webhook-templating; entities and retention on webhook-data-model.
tags: [stack, webhooks, laravel, product, requirements, ui]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-management-surface, webhook-delivery-model, webhook-templating, webhook-template-library, webhook-data-model]
---

# Webhook Product Requirements

Every behavioral demand on the webhook management experience, as user stories with testable
acceptance criteria. The normative anchor is [[fleet-webhook-specification]] §7; the API and
lifecycle mechanics these stories exercise are defined on [[webhook-management-surface]] and are
not restated here. Stories bind **behavior**; the UI's look is per-app freedom (Tier E,
[[fleet-frontend-specification]]). Where a criterion touches a fact owned by a sister page, it
links there — the criterion is the observable outcome, the sister page is the mechanism.

**Roles.** *Webhook manager* — the holder of `webhooks:manage` on the app's managing plane:
webhook management is business configuration, so in apps with an operator plane that is an
operator-guard user, and in apps without one a tenant user on the web guard
([[webhook-management-surface]]). *Teammate* — a user of the same plane without the
permission. *Administrator* — provider staff on the `/control` plane, read-only in every app.
*Receiver developer* — the external engineer integrating against the app's webhooks.
Every story's criteria hold for both the React UI and the management API unless a criterion
names one surface explicitly.

## Onboarding and empty states

**O1 — Empty and first-run states.**
As a webhook manager, I want every empty state to tell me what it means and what to do next, so
that a blank screen is never a dead end.

- Given no Targets exist, then the landing state explains what a Target is and points to
  registration (T1) — not an empty table.
- Given an `unverified` Target, then its view states that nothing delivers until verification
  and offers the verification flow (T3).
- Given a new Webhook with an empty delivery history, then the empty state says no matching
  events have occurred yet — explicitly distinct from an error state — and offers a test-fire
  (TF1).
- Given an empty recycle bin, then the bin states the auto-purge window
  ([[webhook-data-model]]) rather than rendering blank.

## Targets

**T1 — Register a Target.**
As a webhook manager, I want to register a Target with a scheme, host, optional base path, and
an auth mode, so that my receiving system is represented once and every Webhook on it shares
that configuration.

- Given valid input, when I create the Target, then it is created in the `unverified` state and
  the create response/screen is the only place its signing secret is ever shown.
- Given the create succeeds, then the secret is displayed once with a copy control and an
  explicit "you will not see this again" notice; reloading the page or re-fetching the Target
  never returns it.
- Given I supply an additional auth option (bearer token, basic auth, custom secret header),
  when I save, then the values are accepted, stored encrypted ([[webhook-data-model]]), and
  never displayed back in full on any surface.

**T2 — Rejected destinations.**
As a webhook manager, I want invalid or dangerous destinations rejected at entry, so that I
find out at save time rather than at delivery time.

- Given a production environment, when I enter an `http://` URL, a raw-IP host, or a host that
  resolves to a private/reserved range, then the save fails 422 with a corrective message
  naming the violated rule (guard list → [[webhook-egress-guards]]).
- Given a local/dev environment with the egress carve-out enabled
  (`webhooks.egress.allow_local` → [[webhook-egress-guards]]), when I enter an `http://` URL,
  then it is accepted; with the carve-out disabled, the production rules apply unchanged.

**T3 — Verify a Target.**
As a webhook manager, I want a one-click verification ping, so that I prove the endpoint is
reachable before any Webhook goes live.

- Given an `unverified` Target, when the verification ping succeeds ([[webhook-delivery-model]]),
  then the Target becomes `active` and the UI reflects it without a manual refresh.
- Given an `unverified` Target whose receiver rejects the bare envelope (a Slack or Discord
  URL), when a `ping` test-fire through an attached Webhook succeeds
  ([[webhook-delivery-model]]), then the Target becomes `active` — verification is satisfied by
  any successful signed ping delivery, base-URL probe or template path alike.
- Given the ping fails, then the Target stays `unverified` and I see the failure reason
  (HTTP status or transport error) inline — shown once, never stored
  ([[webhook-data-model]]); the API returns 409
  `webhook-target-verification-failed`.
- Given an `unverified` Target, then every Webhook on it shows why it cannot activate, with a
  path to trigger verification from that context.

**T4 — Edit a Target.**
As a webhook manager, I want to edit a Target's name, auth, and throughput settings freely, and
its address deliberately, so that routine changes are cheap and address changes are safe.

- Given an `active` Target, when I change only its name, auth options, or throughput settings,
  then it remains `active` and its Webhooks are untouched.
- Given an `active` Target with active Webhooks, when I change its scheme, host, or base path,
  then I am warned before saving that the Target will require re-verification and its active
  Webhooks will pause; on confirm, the Target reverts to `unverified` and those Webhooks are
  paused with an audit trail entry.
- Given the Target re-verifies after such an edit, then its paused Webhooks stay paused until I
  activate them — nothing silently resumes traffic to a new address.

**T5 — Configure per-Target throughput.**
As a webhook manager, I want to set a rate limit and/or concurrency cap per Target, so that a
burst of events cannot flatten my receiving system.

- Given a new Target, then sane defaults are prefilled and visible ([[webhook-delivery-model]]).
- Given I set custom values, when deliveries run, then the caps are honored at the point of work
  ([[webhook-delivery-model]]); attempts held back by the cap show as pending, not failed.

**T6 — Rotate a Target's secret.**
As a webhook manager, I want secret rotation with an overlap window I control, so that my
receiver can switch keys with zero missed verifications — or, on a compromise, none at all.

- Given an `active` Target, when I rotate, then the new secret is shown exactly once with a copy
  control, and during the overlap window every delivery is signed with both old and new secrets
  (two signature values → [[webhook-signing-scheme]]).
- Given I rotate without choosing an overlap, then the default 24-hour window applies; given I
  choose any overlap from 0 to 24 hours, then the old secret signs for exactly that window
  ([[webhook-signing-scheme]]).
- Given I suspect the secret is compromised, when I rotate with overlap 0 — the documented
  compromise-response procedure ([[webhook-signing-scheme]]) — then the old secret stops
  signing immediately, and the UI is explicit that deliveries will fail verification until my
  receiver installs the new secret.
- Given a completed rotation, then the UI shows the overlap expiry time until it passes, and the
  rotation is audit-logged without any secret material.
- Given I rotate again while an overlap is still open, then the oldest secret is retired
  immediately — at most two secrets ever sign.
- Given any read surface (Target detail, exports, audit log, `/control`), then neither the old
  nor the new secret is ever retrievable after its single display.

**T7 — Delete a Target that has live Webhooks.**
As a webhook manager, I want deleting a Target to be explicit about the blast radius, so that I
never silently kill integrations.

- Given a Target with non-deleted Webhooks, when I request deletion, then the confirmation
  names the count and names of the Webhooks that will go with it.
- Given I confirm, then the Target and those Webhooks are soft-deleted into the recycle bin as
  one cascade ([[webhook-data-model]]), no further delivery attempts occur for them, and
  already-recorded history remains readable with denormalized names.
- Given the deletion, then it is audit-logged with the denormalized Target name and URL.

**T8 — Target quota.**
As a webhook manager, I want the Target quota visible and enforced, so that I understand the
limit before I hit it.

- Given my org is at the Target quota (default 10 — WH-803,
  [[fleet-webhook-specification]]), when I attempt to create another, then the API returns 422
  problem `webhook-quota-exceeded` and the UI disables the create affordance, showing
  used/allowed counts.
- Given I soft-delete a Target, then the freed quota slot is available immediately (bin rows do
  not count).

**T9 — Target health rollup.**
As a webhook manager, I want a per-Target health view, so that I can answer "is this
integration healthy?" in one place.

- Given a Target with Webhooks, when I open its rollup, then I see one row per Webhook — state,
  success rate, latency percentiles, last delivery time — plus Target-level totals for a
  selectable window.
- Given a Webhook there is `disabled`, then the rollup makes that state and its reason visually
  primary, with a path to the heal flow (W7).

## Webhooks

**W1 — Create a Webhook.**
As a webhook manager, I want to subscribe a Target to chosen events with a chosen request
shape, so that the receiver gets exactly the traffic it wants in the form it wants.

- Given the create form, then the event picker is fed from the live catalog
  ([[webhook-event-catalog]]) — explicit types, `invoice.*`-style wildcards, and `*` are all
  selectable, each type showing its description.
- Given I choose a verb, then the form enforces the verb/body matrix ([[webhook-templating]]):
  GET/DELETE hide the body editor, POST/PUT/PATCH offer it, HEAD/OPTIONS are not offered.
- Given I save with valid input on an `active` Target, then the Webhook is created `active` and
  begins receiving matching events; on an `unverified` Target it is created `paused` with the
  reason shown.

**W2 — Zero-config delivery.**
As a webhook manager, I want a Webhook with no template to just work, so that the common case
needs no configuration.

- Given a POST Webhook with no body template, when a matching event fires, then the delivered
  body is the standard envelope as-is ([[webhook-event-catalog]]).
- Given that Webhook, then the create form makes clear a template is an override, not a
  requirement.

**W3 — Edit a Webhook.**
As a webhook manager, I want to edit any part of a Webhook with save-time validation, so that
configuration mistakes surface at entry.

- Given an edit that references an unknown token path for the subscribed event types, when I
  save, then I get a 422 with a pointer to the offending token ([[webhook-templating]]); the
  previous configuration remains in effect.
- Given a successful edit, then subsequent deliveries and retry attempts use the new
  configuration; the frozen event payloads are unchanged (snapshot law →
  [[webhook-event-catalog]]).
- Given I narrow the event selection, then already-recorded Deliveries for now-unsubscribed
  types remain in history untouched.
- Given I narrow the event selection while Deliveries for a now-deselected type are
  mid-schedule, then those Deliveries terminate as `skipped` at the point of work
  ([[webhook-delivery-model]]) — enumerable and replayable, never a `template_error`.

**W4 — Edit a Webhook mid-retry (the heal-in-place edge).**
As a webhook manager, I want configuration fixes to apply to in-flight retries, so that I can
repair a bad header or path without waiting out the retry schedule.

- Given a Delivery is mid-retry because of a bad header value, when I fix the Webhook's
  headers, then the next scheduled attempt uses the corrected configuration and can succeed
  (attempt mechanics → [[webhook-delivery-model]]).
- Given a Delivery already terminally failed with a template error (not retried →
  [[webhook-templating]]), when I fix the template, then the fix does not resurrect that
  Delivery — I replay it explicitly (R1) and the replay succeeds.

**W5 — Pause and resume.**
As a webhook manager, I want to pause a Webhook and later resume it, so that I can take my
receiver down for maintenance without losing anything.

- Given an `active` Webhook, when I pause it, then no further HTTP requests are made for it,
  and matching events during the pause are recorded and visible in history as skipped
  ([[webhook-delivery-model]]).
- Given a Delivery is mid-retry when I pause, then its job terminates the Delivery as `skipped`
  at the point of work ([[webhook-delivery-model]]) — enumerable and bulk-replayable exactly
  like a fan-out-time skip.
- Given a `paused` Webhook, when I activate it, then new matching events deliver normally, and
  I can bulk-replay the pause window to backfill what was skipped (R2).
- Given the Target is `unverified`, when I attempt to activate, then I am refused with the
  reason (409 `webhook-target-unverified`) and a link to the verification flow.

**W6 — See Webhook state at a glance.**
As a webhook manager, I want every list of Webhooks to show state and health, so that a broken
subscription is impossible to overlook.

- Given a list of Webhooks, then each row shows its state (`active`/`paused`/`disabled`), its
  recent success rate, and its last delivery time, and the list is filterable by state.
- Given a `disabled` Webhook, then its row is visually distinct and links to the reason.
- Given a Webhook whose explicit event selection names types absent from the current catalog,
  then list and detail views flag it ([[webhook-management-surface]]) and editing it reports
  the stale types with a 422 pointer — a partially dead subscription is never silent.

**W7 — Auto-disable and healing.**
As a webhook manager, I want the system to stop hammering a dead endpoint and hand me a clear
recovery path, so that a long outage on my side is an incident, not a permanent gap.

- Given a Webhook crosses an auto-disable threshold ([[webhook-delivery-model]]), then it
  becomes `disabled`, the owner is emailed, and the UI shows when it was disabled and why.
- Given a `disabled` Webhook, then events during the disabled window are still recorded
  ([[webhook-data-model]]), and the UI states that re-enable plus replay heals the gap.
- Given I fix my receiver, when I test-fire (TF1) and it succeeds, activate the Webhook, and
  bulk-replay the disabled window, then the missed events are delivered and the Webhook
  resumes normal service — the complete heal path exercised end to end.
- Given I activate a `disabled` Webhook, then the consecutive-failure streak resets to zero
  ([[webhook-delivery-model]]) — one failed replay mid-heal never instantly re-disables it.

**W8 — Delete a Webhook.**
As a webhook manager, I want Webhook deletion to be recoverable, so that a mistaken delete is a
detour, not a rebuild.

- Given I delete a Webhook, then it stops delivering immediately, lands in the recycle bin, and
  its delivery history remains readable with denormalized names ([[webhook-data-model]]).
- Given events matching the Webhook occur while it sits in the bin, then no Deliveries — not
  even skipped ones — are recorded for it, and that window cannot be replayed after restore:
  deletion is the one gap replay does not heal ([[webhook-data-model]]).
- Given the deletion, then it is audit-logged with actor and denormalized names.

**W9 — Webhook quota.**
As a webhook manager, I want the Webhook quota enforced the same way as the Target quota, so
that limits behave consistently.

- Given my org is at the Webhook quota (default 50 — WH-803,
  [[fleet-webhook-specification]]), when I attempt to create
  another, then I get 422 `webhook-quota-exceeded` and a disabled affordance with counts, and
  soft-deleting a Webhook frees a slot immediately.

**W10 — Schema-version drift flag.**
As a webhook manager, I want to know when the envelope schema has moved past my Webhook's pin
and to acknowledge it deliberately, so that drift is visible and the flag is clearable.

- Given the global `schema_version` bumps past a Webhook's pin, then list and detail views flag
  the Webhook, showing the pinned and current versions side by side
  ([[webhook-event-catalog]]).
- Given I confirm my receiver handles the current shape, when I re-pin
  ([[webhook-management-surface]]), then the pin updates to the current version and the flag
  clears.
- Given I ignore the flag, then nothing changes on the wire — v1 performs no payload
  transformation; the flag is information, not a migration.

## Templates

**TL1 — Browse the template library.**
As a webhook manager, I want a library of ready-made templates, so that common integrations
(Slack, Discord, generic JSON) are minutes, not hours.

- Given the library view, then each template shows its name, description, verb, content type,
  applicable event types, and any target suggestion ([[webhook-template-library]]).
- Given I have selected event types for a new Webhook, then templates not applicable to that
  selection are hidden or visibly marked inapplicable.

**TL2 — Apply a template (copy semantics).**
As a webhook manager, I want applying a template to stamp editable values, so that my Webhook
never changes underneath me when the library evolves.

- Given I apply a template, then verb, headers, content type, and body template are copied onto
  the Webhook form and every field remains freely editable.
- Given a shipped template later changes in code, then existing Webhooks created from it are
  byte-identical to before ([[webhook-template-library]] — apply is copy).

**TL3 — Target suggestions are hints.**
As a webhook manager, I want template host suggestions without enforcement, so that guidance
never becomes a constraint.

- Given a template with a target suggestion (e.g. a `hooks.slack.com` hint), when I pick a
  Target on a different host, then the save proceeds with at most an informational notice.

**TL4 — Required token mappings.**
As a webhook manager, I want templates to tell me what they need, so that I cannot ship a
half-configured integration.

- Given a template declaring required token mappings, when I apply it, then the unmapped
  requirements are surfaced as fields to complete, and saving with one missing fails 422 naming
  the mapping.

**TL5 — Token editing, two modes.**
As a webhook manager, I want a simple insert-token mode and a raw editor, so that easy cases
stay easy and hard cases stay possible.

- Given insert-token mode, then I am offered only token paths valid for the subscribed event
  types (from the payload schema → [[webhook-event-catalog]]), and insertion cannot produce an
  invalid path.
- Given the raw editor, then formatters and sections ([[webhook-templating]]) are available,
  and save-time validation still applies (W3).
- Given either mode, then a rendered preview against the catalog's sample payload is shown
  before I save.

## Testing

**TF1 — Test-fire a Webhook.**
As a webhook manager, I want to send a realistic test delivery on demand, so that I can prove
the pipe end to end before real traffic depends on it.

- Given the event-type picker, then it offers the Webhook's subscribed types plus `ping` —
  never the whole catalog ([[webhook-management-surface]]).
- Given a Webhook and a chosen event type, then the payload editor is prefilled with the
  catalog's sample payload and I may edit the values ([[webhook-delivery-model]]).
- Given I fire, then a real HTTP request is sent through the Webhook's template with the test
  marker header set and the event `type` unchanged, and I see the outcome — status, duration,
  response snippet — immediately.
- Given the test completes, then it appears in the delivery history flagged as a test, and is
  filterable in or out (H2).
- Given the Webhook is `paused` or `disabled`, then test-fire is still available — it is the
  diagnostic tool of the heal path (W7).

**TF2 — Ping.**
As a webhook manager, I want a bare ping event, so that I can verify connectivity without
composing a payload.

- Given any Webhook, then `ping` is offered in the test-fire picker
  ([[webhook-event-catalog]]) and fires without payload editing.
- Given the Webhook has a body template — even one referencing `data.*` paths — when I fire a
  `ping`, then it succeeds as a connectivity check: the ping renders through the body template
  with unresolvable `data.*` tokens resolving as null under the null-rendering rules
  ([[webhook-delivery-model]]) — never a `template_error`.
- Given the Target is `unverified`, when the ping test-fire succeeds, then the Target verifies
  (T3).

**TF3 — Test-fire limits.**
As a webhook manager, I want test-fire rate-limited, so that a stuck finger or a script cannot
turn the diagnostic into a flood.

- Given I exceed the named test-fire limiter ([[webhook-management-surface]]), then I receive a
  429 with `Retry-After` and the UI communicates the wait.

## History

**H1 — Delivery list.**
As a webhook manager, I want a per-Webhook delivery list, so that I can see at a glance what
was sent, when, and how it went.

- Given a Webhook with history, then the list shows status, event type, timestamps, attempt
  count, next-retry time for pending rows, and test/replay flags, newest first, paginated.
- Given a pending Delivery, then its row updates to its terminal state without my re-filtering
  (on refresh or reasonable polling — the mechanism is per-app freedom).

**H2 — Filters.**
As a webhook manager, I want to slice history by status, event type, and date, so that I can
isolate a problem window fast.

- Given filters for status, event type, date range, and test/replay flags, when I combine
  them, then results honor all of them and pagination preserves them.
- Given an invalid filter member, then the API answers 400 per the reserved-family rules
  ([[fleet-api-specification]] API-306).

**H3 — Attempt drill-down.**
As a webhook manager, I want to inspect any attempt's exact request and response, so that
debugging needs no guesswork — and no secret exposure.

- Given an Attempt, then I see the request as sent — method, URL, headers, body — with
  auth-sourced header values masked and the signature header shown in full
  ([[webhook-management-surface]] masking rules), plus response status, captured response
  snippet ([[webhook-delivery-model]]), and duration.
- Given a Delivery that failed with a template error, then the drill-down shows the template
  error message and names the token that failed ([[webhook-templating]]).

**H4 — Success-rate and latency summary.**
As a webhook manager, I want summary numbers per Webhook, so that "mostly fine" and "quietly
degrading" look different.

- Given a Webhook, then I can see totals by outcome, success rate, p50/p95 latency, and the
  current consecutive-failure streak over a selectable window.

**H5 — CSV export.**
As a webhook manager, I want to export filtered history as CSV, so that I can analyze or
archive it outside the product.

- Given an active filter set, when I export, then the CSV contains exactly the filtered rows
  with the stable column set ([[webhook-management-surface]]), streamed as a download.
- Given the export limiter is exceeded, then I receive a 429 with `Retry-After`.

**H6 — Retention transparency.**
As a webhook manager, I want the history window stated where history is shown, so that I am
never surprised by pruning.

- Given any history view, then the retention window ([[webhook-data-model]]) is stated, and
  export exists as the escape hatch before pruning.

**H7 — Event lookup.**
As a webhook manager, I want to see one event and every delivery it fanned out to, so that a
receiver-reported event id is one lookup.

- Given an event id (from a receiver's log or an envelope), when I look it up
  ([[webhook-management-surface]]), then I see the envelope metadata and the per-Webhook
  delivery rollup — totals by outcome and last delivery time — with each Delivery one click
  away.
- Given the event stream list, then I can filter by type, date range, and test flag; given a
  delivery list, then I can filter it by event id.

## Replay

**R1 — Replay one delivery.**
As a webhook manager, I want single replay with immediate feedback, so that "did my fix work?"
takes seconds.

- Given a `failed`, `succeeded`, or `skipped` Delivery, when I replay it, then a new Delivery
  is created synchronously with the same event id and the replay marker
  ([[webhook-delivery-model]]), and I see its outcome immediately; the original Delivery is
  preserved unchanged — skipped rows are single-replayable exactly as they are bulk-replayable.
- Given a `pending` Delivery, then replay is refused with 409 — work still in flight is not
  replayable (and there is deliberately no "attempt now" affordance; the omission is recorded
  in the spec's considered-and-rejected tail).
- Given a test Delivery, then replay is refused with 409 `webhook-delivery-not-replayable` —
  the test-fire button is the re-run ([[webhook-delivery-model]]).
- Given the replayed row, then it is flagged as a replay in history and filterable (H2).
- Given the Webhook is `paused` or `disabled`, then replay is refused with guidance to activate
  first (409 `webhook-not-active` → [[webhook-management-surface]]).

**R2 — Bulk replay.**
As a webhook manager, I want to replay failures across a date range, so that healing an outage
does not mean clicking through hundreds of rows.

- Given a Webhook, when I request a bulk replay for a date range and status filter, then the
  work is queued (202) and I can watch progress — queued/running/completed/failed with
  matched/replayed/failed counts ([[webhook-management-surface]]).
- Given the bulk replay completes, then each replayed event appears as a new, replay-flagged
  Delivery, and I MAY receive a completion notification.
- Given the named bulk-replay limiter is exceeded, then further requests receive 429 with
  `Retry-After`.
- Given the Webhook is `paused` or `disabled`, when I request a bulk replay, then it is refused
  409 `webhook-not-active` with guidance to activate first ([[webhook-management-surface]]) —
  matching single replay (R1).

## Recycle bin

**RB1 — See what is deleted.**
As a webhook manager, I want one recycle bin for Targets and Webhooks, so that recovery starts
from a single place.

- Given deleted items exist, then the bin lists both kinds with name, type, who deleted, when,
  and days until auto-purge ([[webhook-data-model]]).

**RB2 — Restore a Target.**
As a webhook manager, I want restoring a Target to bring back what its deletion took, so that
undo means undo.

- Given a Target deleted with Webhooks in one cascade, when I restore it, then the Target
  returns in its pre-delete verification state and exactly the Webhooks stamped with that
  deletion's cascade marker (`cascade_id` → [[webhook-data-model]]) return with it — in the
  `paused` state, never straight to `active`.
- Given a Webhook that had been deleted individually *before* the Target cascade, when I
  restore the Target, then that Webhook stays in the bin.
- Given restoring would exceed either quota — the Target itself against the Target quota, or
  its cascade Webhooks against the Webhook quota — then the whole restore is refused 422
  `webhook-quota-exceeded` carrying both counts, checked atomically: no partial restore
  ([[webhook-management-surface]]).

**RB3 — Restore a Webhook.**
As a webhook manager, I want Webhook restore to respect its parent, so that I cannot resurrect
an orphan.

- Given a trashed Webhook whose Target is not deleted, when I restore it, then it returns
  `paused` and I activate it explicitly.
- Given a trashed Webhook whose Target is also trashed, when I attempt restore, then I am
  refused (409 `webhook-target-deleted`) with a one-step path to restore the Target instead.
- Given the restored Webhook, then its trash window has no Deliveries to replay — fan-out
  excluded it while trashed; deletion is the one gap replay does not heal
  ([[webhook-data-model]]).

**RB4 — Purge now.**
As a webhook manager, I want explicit, final purge, so that "gone for real" is a deliberate act.

- Given a binned item, when I purge it, then I confirm past a warning naming the cascade
  (purging a Target purges its binned Webhooks), the rows are hard-deleted, the action is
  audit-logged with denormalized names, and delivery history remains readable
  ([[webhook-data-model]]).

**RB5 — Auto-purge.**
As a webhook manager, I want the bin to empty itself on schedule, so that deleted config does
not accumulate forever.

- Given an item older than the auto-purge window ([[webhook-data-model]]), then the scheduled
  purge removes it with the same cascade as a manual purge, and the bin always displays the
  per-item time remaining beforehand.

## Notifications

**N1 — Auto-disable email.**
As a webhook manager, I want an email when the system disables my Webhook, so that a dead
integration never fails silently.

- Given a Webhook is auto-disabled, then the owner — in operator-plane apps every operator
  holding `webhooks:manage` (optionally CCing the owning org's owners as an FYI); in web-guard
  apps every current holder of `webhooks:manage` in the org, org owners as fallback; the
  owning user in no-org apps (recipient definition →
  [[webhook-delivery-model]]) — receives an email through the app's normal mailer naming the
  Webhook and Target, the threshold crossed, and linking to the heal flow (W7).
- Given repeated failures *before* the threshold, then no email is sent — the email marks the
  state change, not every failure.

**N2 — In-app failure notifications (MAY).**
As a webhook manager, I want deduplicated in-app failure notices, so that I learn about
problems without being buried by repeats.

- Given the app ships this MAY-tier feature and a Webhook fails repeatedly with the same error,
  then I see one notification for that webhook + error pair with an updated count — not one per
  failure ([[webhook-management-surface]]).
- Given a distinct error on the same Webhook, then it produces its own notification; given the
  next success or my dismissal, the notification clears.
- Given any notification, then it links to the attempt drill-down and contains no secrets,
  headers, or response bodies.

## Docs

**D1 — Public event reference.**
As a receiver developer, I want a generated reference of every event type, payload, and the
signing scheme, so that I can integrate without asking anyone.

- Given the app enables the SHOULD-tier generated reference ([[webhook-management-surface]]),
  then every registered event type appears with its wire type, description, payload schema, and
  a copy-pastable sample payload ([[webhook-event-catalog]]).
- Given the reference, then it includes signature-verification instructions consistent with
  [[webhook-signing-scheme]] and the walkthroughs in [[webhook-receiver-guide]].
- Given a new event class is added to the app, then regenerating the reference includes it with
  no hand-editing — the reference is built from the registry and cannot drift.

**D2 — Docs discoverable from the product.**
As a webhook manager, I want the reference linked where I work, so that I can hand my receiver
developer the right page instantly.

- Given the subscription picker, then each event type links to its entry in the generated
  reference; given a Target's detail view, then the verification and signing docs are one click
  away.

## Access and audit

**A1 — No permission, no surface.**
As a teammate without `webhooks:manage`, I want webhook management invisible and inert, so that
the permission boundary is real.

- Given no `webhooks:manage`, then webhook navigation is absent from the UI, a deep link
  renders the app's standard denied experience, and every management endpoint answers 403
  problem+json ([[fleet-api-specification]] API-1201's standing negative).

**A2 — One permission covers the job.**
As a webhook manager, I want the single permission to grant the whole workflow, so that I never
hunt for a second grant mid-incident.

- Given `webhooks:manage`, then every capability on this page — CRUD, verify, rotate, pause,
  activate, test-fire, replay, export, restore, purge — is authorized with no further
  permission; no separate view or replay permission exists ([[webhook-management-surface]]).

**A3 — Automate with tokens.**
As a webhook manager, I want API tokens scoped to webhook work, so that CI and scripts can
manage subscriptions without my session.

- Given I hold `webhooks:manage`, then I can mint tokens carrying `webhooks:read` and/or
  `webhooks:write` and they authorize exactly the read/write rows of the endpoint register
  ([[webhook-management-surface]]).
- Given a user without `webhooks:manage`, then the mint UI does not offer the webhook abilities
  and the API refuses to grant them (the clamp — [[fleet-api-specification]] API-904).

**A4 — Accountability on every change.**
As an org owner, I want every configuration change attributed, so that "who changed this?" has
an answer.

- Given any config mutation or secret rotation, then the entity's `created_by`/`updated_by`
  reflect it in the UI and one structured stderr audit line is emitted with actor, entity,
  denormalized names, and changed keys — never values, never secrets
  ([[webhook-management-surface]]).
- Given the entity is later purged, then prior audit lines remain meaningful because they carry
  the denormalized name and URL themselves.

**A5 — Support can look, not touch.**
As an administrator, I want read-only webhook visibility on `/control`, so that I can support a
customer without holding their keys.

- Given the `webhooks:support` permission on the admin plane, then I can list and inspect
  Targets, Webhooks, Deliveries, and Attempts, with the same masking as the tenant surface.
- Given the control plane, then no mutation affordance exists — no create, edit, rotate,
  replay, or delete — and no auth-sourced secret is retrievable there under any circumstance;
  a capability URL stored as a Target base path remains visible, the recorded I-6 exposure
  ([[webhook-threat-model]]).
