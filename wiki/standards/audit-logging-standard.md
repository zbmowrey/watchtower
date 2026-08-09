---
title: Audit / Activity-Logging Standard (v1 — capture, dashboard, partitioned append-only storage)
description: The normative rule set for the entity audit trail on every fleet app — owen-it/laravel-auditing for old→new diffs with a resolved causer, the criterion deciding which entities MUST be audited, causer resolution across the web/queue/console planes, the mandatory user-facing dashboard with morph and value resolvers, and the custom storage layer beneath it (append-only grants, Postgres RANGE partitioning by year-month, detach-to-archive retention, the UNION view). Application logging is a different concern and stays with [[observability]].
tags: [ spec, standard, audit, activity-log, compliance, postgres, partitioning, laravel, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-webhook-specification, defense-in-depth-model, fleet-testing-doctrine, observability, data-privacy-doctrine, encryption-at-rest-doctrine, tenant-isolation-rls, backup-dr-standard ]
---

# Audit / Activity-Logging Standard — v1

The **requirement of record for the entity audit trail**: who changed which record, when, and from
what to what. Written against Laravel 13 / PHP 8.5 and Postgres with declarative partitioning.
Normative language per [[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**,
deviations recorded there, never silent.

## §1 The four laws

1. **The audit trail is not application logging.** The trail answers *"who changed this record, and to
   what?"* for users and auditors; application logs answer *"what did the system do?"* for operators —
   different audience, query surface, retention, storage. [[observability]] owns stderr JSON → Loki →
   Grafana and Sentry, exclusively; nothing here changes it, and neither substitutes for the other.
2. **Append-only.** A written audit row is never updated or deleted by application code — enforced at
   the database grant, not in the ORM (§6). The one sanctioned exception is privacy-driven redaction
   (§8), run by the maintenance role and itself recorded.
3. **The trail is a product surface.** If a human needs shell access to answer "who changed this", the
   standard is not met — hence the mandatory dashboard (§5).
4. **Capture is configuration, not logic.** A model declares *that* it is audited; no action,
   controller, job, or observer writes audit rows by hand.

## §2 Which entities MUST be audited — the criterion, not a list

An entity **MUST** be audited if it meets any of:

- **(a) Authority** — mutating it changes who can do what: users, roles, permissions, memberships, API
  tokens and their abilities, org/tenant settings that gate access.
- **(b) Money or obligation** — it moves a billable, contractual, or legally consequential quantity:
  plans, prices, quotas, entitlements, adjustments.
- **(c) Reach** — it changes what leaves the system or where it goes: webhook Targets and Webhooks,
  notification destinations, egress allowlists, integration configuration.
- **(d) Dispute surface** — a customer, operator, or auditor could plausibly ask "who changed this, and
  when?" and be owed an answer.
- **(e) Explicit obligation** — a regulatory or contractual requirement naming the data.

**MAY be skipped:** derived projections and caches, high-churn counters and telemetry, ephemeral state
rows, and join rows whose parents are both audited *and* whose existence is not itself an authority
grant (a `role_user` pivot **is** authority — audit it).

- **The audited set is a reviewed artifact — MUST.** Each app records its audited entities in its own
  spec; an entity meeting the criterion and left un-audited is an **ACCEPTED-DEVIATION** in
  [[fleet-app-specification]], never a quiet omission. §9's arch test keeps the list honest.
- **MUST NOT audit an entity to avoid designing an event.** "What happened in the business" is a domain
  event with a name and a payload; "which column changed on row X" is an audit diff. Reaching for the
  trail to reconstruct a business narrative means the event is missing.
- **Field exclusion — MUST.** Secrets, credentials, password hashes, recovery codes, and any ciphertext
  column ([[encryption-at-rest-doctrine]]) are excluded from captured diffs (`$auditExclude`). Where the
  *fact* of a change still matters, capture the attribute key with the value redacted through an
  attribute modifier — the "keys, never values" stance [[webhook-management-surface]] already takes.
- **Prior art.** [[fleet-webhook-specification]] §6 rules out an activity-log package for the webhook
  engine's own management surface. Where an app adopts this standard, its webhook config entities are
  audited like any other under criterion (c): the engine's `created_by` / `updated_by` columns survive
  as a denormalized read affordance and its structured stderr line as the operator-plane record — but
  the user-facing history of those entities comes from this trail.

## §3 Capture — the package, under the layering rules

- **Package — MUST:** `owen-it/laravel-auditing`. An audited model `implements Auditable` and uses the
  `Auditable` trait. That trait plus declarative properties (`$auditInclude` / `$auditExclude`,
  `$auditEvents`, `$attributeModifiers`, `$auditStrict`) is the **entire** model-side change — no
  `booted()` hooks, no hand-rolled diffing, no audit branch in a model method. Models stay slim per
  [[fat-models-skinny-controllers]]; business operations stay in [[actions]].
- **MUST NOT write audit rows from application code.** Capture is a model-lifecycle concern; a
  hand-written audit call is the tell that the mutation bypassed Eloquent.
- **Events — MUST:** `created`, `updated`, `deleted`, `restored` — apps with a recycle bin get restore
  history for free, which is the point of including it.
- **Bulk writes bypass the trait — treat as a defect.** `Model::query()->update(...)`, raw SQL, and
  `upsert()` fire no Eloquent events and produce no row. A genuinely required bulk path (backfill, data
  migration) **MUST** either iterate models or write one explicit entry describing the whole operation
  with a system causer — recorded as an ACCEPTED-DEVIATION.
- **Transaction semantics — MUST:** the audit row is written inside the mutation's transaction. A
  rolled-back change leaves no row, which is correct; the corollary worth internalizing is that **an
  audit row is proof the change committed** — the property a separate audit service destroys (§11).
- **Enrichment — SHOULD:** `transformAudit()` stamps the row with the `Context` request id (which
  already rides into queued jobs, per [[observability]]) plus §7's scope column — the join that makes
  "the log line behind this audit row" one Loki query. Auditing **SHOULD** be silenced around seeders
  and importers, and **MUST NOT** be silenced around anything a user triggered.

## §4 Causer resolution — never "unknown", never a name alone

- **Identity is a morph, legibility is a snapshot — MUST.** The row stores `user_type` + `user_id` as
  the causer's identity (joinable, stable) **and** a `causer_label` denormalized at write time, so the
  row stays readable after the principal is renamed or deleted. A display name is not an identity; a
  morph alone goes blank the day the user is removed.
- **Plane — MUST:** a `causer_plane` column records which authentication plane acted (`web`,
  `operator`, `api`, `queue`, `console`, `system`), mirroring the `actor_id` + `actor_plane` pair
  [[webhook-management-surface]] emits. Where an app has both an operator and a web plane, the resolver
  unions the configured guards rather than assuming one.
- **Queued jobs — MUST:** the causer is the human who dispatched the work, not nobody. The dispatch site
  carries it through `Context` (dehydrated into the job per [[fleet-queue-doctrine]] §5) and the
  resolver reads it when no guard is authenticated. Scheduler-originated work resolves to a **stable
  system principal** named for the task; console commands to one named for the command, with an
  operator identity passed explicitly where the app has an operator plane. Unauthenticated mutations
  (public signup, inbound-webhook-driven state changes) resolve to the named system principal for that
  ingress. **A `null` causer is not an accepted outcome** — an unattributable mutation is a finding.
- **Value resolvers — SHOULD:** register per-model resolvers rendering stored values human-readable
  (foreign key → the referenced record's label, enum → its label, flag → words). They run at **read**
  time and degrade to the raw value when they can't resolve — history predates today's schema and must
  never throw in the dashboard.

## §5 The dashboard — a required product surface

- **MUST ship** a first-party audit view (Inertia + React per [[fleet-frontend-specification]]).
- **Resolution — MUST.** Every row renders resolved: causer → username / email / label; audited type →
  a human entity name, never `App\Models\Thing`; audited id → the entity's display label, linked where
  the record still exists; each changed attribute → a human field label with old → new rendered by
  type. **Raw class names, ids, and JSON MUST NOT be the primary rendering** — a raw view is a fine
  secondary affordance.
- **Filter and search — MUST:** by entity type, entity id, causer, event, and date range, plus free-text
  search across resolved labels — server-side per [[api-filtering-sorting]]. The client never filters a
  page of rows and calls it a filter.
- **Paging and targeting — MUST:** keyset/cursor pagination on `(created_at, id)` (offset degrades
  exactly where deep history matters), and every query is date-bounded so Postgres prunes partitions.
  The requested range decides which relation the query targets (§6).
- **Authorization — MUST:** viewing the trail is its own permission, never an implication of being an
  admin elsewhere. Scoped viewers see the trail for records they may already see; the cross-scope feed
  requires the operator-plane permission. Excluded and redacted values (§2) are unreachable here.
- **Read-only — MUST:** no edit, no delete, no "clear log" — the dashboard has no mutation affordance of
  any kind. **MAY:** rate-limited CSV export of the current filtered view, under the same authorization
  and range.

## §6 Storage — append-only, partitioned, archived by detachment

The package supplies the schema; the storage layer beneath it is **custom fleet work**. The package's
table is configured as `audit_logs`.

- **Partitioning — MUST:** Postgres **declarative RANGE** partitioning on `created_at`, one partition
  per calendar month, named `audit_logs_yYYYYmMM` (e.g. `audit_logs_y2026m08`). Retention becomes a
  catalog operation instead of the largest `DELETE` in the app, and date-bounded queries prune.
- **Key consequence — MUST:** Postgres requires the partition key in every unique constraint, so the
  primary key is `(id, created_at)`; code and migrations MUST NOT assume a bare `id` unique index.
- **Columns beyond the package defaults — MUST:** `causer_plane`, `causer_label` (§4), the tenancy scope
  column (§7), `request_id` (§3).
- **Month roll — MUST be automated:** a daily scheduled task idempotently ensures the **current and
  next** month's partitions exist. Never rely on a deploy — a missing partition on the 1st is an
  app-wide insert failure. It rides the scheduler heartbeat ([[fleet-app-specification]] §5) so a dead
  scheduler is caught before the calendar catches it. A `DEFAULT` partition is **rejected** (§11).
- **Indexes — MUST**, declared on the parent so every partition (and every attached one) inherits them:
  `(auditable_type, auditable_id, created_at DESC)` — entity history; `(user_type, user_id, created_at
  DESC)` — causer history; `(created_at DESC)` — the global feed; plus §7's scope index.
- **Append-only enforcement — MUST, at the grant level:** the application role holds `INSERT` and
  `SELECT` on `audit_logs` and its partitions; `UPDATE` and `DELETE` are **revoked**. DDL, partition
  management, and redaction run as a separate maintenance role. **SHOULD, belt and suspenders:** a
  `BEFORE UPDATE OR DELETE` trigger that raises — grants are per-role and someone will eventually run a
  migration as the owner, and the trigger binds regardless of role ([[defense-in-depth-model]]).
  Application-side, the Audit model exposes no update or delete path, arch-tested (§9). All three
  layers, not one.
- **Archive — MUST:** partitions older than the configured window (**default 13 months** — a full
  trailing year plus the current partial month always live) move to `audit_logs_archive`, a mirror
  parent with the same schema and indexes, via `DETACH PARTITION … CONCURRENTLY` then `ATTACH`.
  Archival is **partition detachment, not a copy job**: no row is rewritten and the live table takes no
  long lock. The window is config, and it is operational, not legal (§8).
- **Reading across the boundary — MUST:** an `audit_logs_all` view `UNION ALL`s the two parents. Queries
  target `audit_logs` by default and widen to the view **only** when the requested range reaches before
  the archive boundary — querying the union unconditionally doubles the planning surface for the 99% of
  queries that never leave the live window.
- **Freeze after roll — SHOULD:** once a partition stops taking writes, `VACUUM (FREEZE, ANALYZE)` it.
  An append-only table accumulates unfrozen pages that later surface as an anti-wraparound vacuum storm
  across every archived partition at once.
- **The archive is not a backup.** Durability is owned by [[backup-dr-standard]]; a detached partition
  is exactly as safe as the database it still lives in, and **MUST** stay inside the same backup set.

## §7 Tenancy scoping

- **Multi-tenant (database-per-tenant) — MUST:** the trail lives in the **tenant database**, partitioned
  there per §6. The database boundary *is* the audit scope; no audit row crosses it. Centrally-held
  entities (tenants themselves, plan assignments) audit into the **central** trail.
- **Tenant-aware maintenance — MUST:** month-roll, archival, freeze, and redaction tasks run **per
  tenant** through the tenancy runner. A plainly wired scheduler entry runs once against the central
  connection and silently touches no tenant database — the trap [[webhook-data-model]] records, which
  here surfaces as an app-wide insert failure on the 1st.
- **Single-tenant / org-scoped — MUST:** the row carries a denormalized scope column stamped at write
  time (§3); resolving scope at read time would mean joining every audited entity's table, and
  denormalization is the deliberate trade. Scope filtering is applied in the query layer and the policy,
  **never** by the dashboard's UI filter — the filter is an affordance, the scope is a control.
- **RLS — where the app runs it:** `audit_logs`, `audit_logs_archive`, and their partitions are in
  scope, with policies declared on the parent and inherited. [[tenant-isolation-rls]] owns the policy
  shape; note append-only means `SELECT` and `INSERT` policies are the whole story.

## §8 Retention, privacy, and erasure

- **The archival calendar is configurable** and operational: it decides what is fast to query, not what
  the app may keep. Retention *obligations* — what must be erased, on what clock — are owned by
  [[data-privacy-doctrine]]. Link, never restate.
- **Erasure ripples into the trail — MUST.** Append-only is not an exemption. The reconciling mechanism
  is **redaction in place of deletion**: the erased subject's personal values inside old→new diffs, and
  the denormalized `causer_label`, are overwritten with a tombstone while the row, its morph ids, and
  its timestamps survive — that a change happened is itself the audit record. This is §1 law 2's single
  sanctioned exception: maintenance role only, never application code, and itself audited. The sweep
  **MUST** cover `audit_logs_archive` — an erasure that stops at the live window is not an erasure.
- **Minimization — SHOULD:** the cheapest way to satisfy an erasure obligation is never to have captured
  the value. Exclude PII-dense free-text fields where the *fact* of the change is what the trail needs.

## §9 Testing the trail

Judgment and placement per [[fleet-testing-doctrine]]. **MUST NOT test the package** — "saving a model
writes an audit row" is the vendor's suite ([[testing-antipattern-catalog]]). The seams that *are* ours:

- **The audited set — MUST:** an architecture/spec test asserting §2's entity list implements
  `Auditable`, written so **adding a model fails the test** until it is ruled in or explicitly out.
  This is what makes §2 a standard rather than an intention.
- **Exclusions — MUST:** no excluded field's value appears in a captured diff, for every model carrying
  secrets or ciphertext. **Causer resolution — MUST:** bootless unit tests over the resolver, one per
  plane, including the "no guard authenticated" path. **Scope — MUST:** a Feature test proving one scope
  cannot read another's rows through the dashboard *or* its export. **Month roll — MUST:** creates
  current + next, idempotent on re-run, no-op when both exist.
- **Storage claims are integration tests against a real Postgres (Sail), never mocks** — the claim is
  about catalog behavior. Archival detach: **MUST**. Append-only: **SHOULD** — attempt an `UPDATE` and
  expect failure; where CI provisions the application role that covers the grant, and where it does not
  the **trigger** is the surface under test, since it binds regardless of role.

## §10 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| No audit row for a change users can see | Mutation went through query builder / `upsert` / raw SQL; auditing silenced in that context; model missing the trait | §3 — iterate models or record one explicit entry; narrow the silencing scope; add the trait |
| `no partition of relation "audit_logs" found for row` | Month-roll task didn't run (dead scheduler); in MT, wired centrally so no tenant DB was touched | Heartbeat check, then §7's tenancy runner; create the missing partition, then fix the task |
| Causer is `System` for a user-initiated action | Resolver reading the wrong guard; job dispatched without carrying causer context | §4 — union the guards; stamp `Context` at the dispatch site |
| Dashboard shows `App\Models\X` and bare uuids | No morph/display resolver registered for that type | §5 — register it; resolvers degrade to raw, they don't error |
| Entity-history page slow | Query not date-bounded, so no pruning; targeting the union view by default | §6 — bound the range; target `audit_logs` unless it crosses the archive boundary |
| Table growing far faster than the app | An entity audited that fails §2's criterion (counters, telemetry); a high-churn attribute inside an otherwise-correct entity | Drop the model from the set or exclude the attribute — with the ruling recorded |
| Rows show attributes that no longer exist | Diffs are historical snapshots, not schema-current | Working as designed; the resolver falls back to the raw value |
| Archive ran but the database didn't shrink | `DETACH` is a catalog operation | Expected — space returns only when the partition is dropped past the window, or the archive moves to cheaper storage |
| Vacuum storm across old partitions | Partitions never frozen after they stopped taking writes | §6 — `VACUUM (FREEZE, ANALYZE)` on roll |
| Erasure "completed" but the subject is still readable | Sweep covered the live parent only | §8 — include `audit_logs_archive` |

## §11 Considered and rejected

- **spatie/laravel-activitylog** — activity-stream shaped (a description plus a properties bag) rather
  than entity-diff shaped; reliable old→new means hand-writing what owen-it declares. **Revisit
  trigger:** a real need for freeform activity events untied to an entity mutation — which is a domain
  event, and belongs in the app's event catalog and logs, not in this trail.
- **Hand-rolled observers writing audit rows** — every model becomes a place to forget, the diff logic
  is re-implemented per entity, and nothing structurally keeps a secret out of a diff.
- **Event sourcing / an immutable legal or financial ledger** — explicitly out of scope. A ledger whose
  balances are *derived* from an append-only event stream is a domain design decision with its own page;
  this trail is evidence about mutations, and pressing it into ledger duty produces neither well.
- **Application logs as the audit trail** — §1 law 1. Loki retention is short, the records aren't
  user-queryable, no product surface can be built on them, and the two answer different questions.
- **`DELETE`-based retention** — a monthly bulk delete on the largest table in the app: long
  transaction, bloat, vacuum load, replication lag. Partition detach is O(catalog). **Copy-to-archive**
  fares no better: it doubles the writes, still needs the delete it was meant to avoid, and races with
  readers mid-copy — detach + attach moves the same pages by renaming their parent.
- **`DEFAULT` partition** — attaching a real partition for a month whose rows landed in `DEFAULT`
  requires scanning `DEFAULT` and fails on overlap; it trades a loud, immediate, fixable error for a
  quiet pile that then blocks the fix. Fail loud, plus a monitored month-roll task.
- **Partitioning by tenant or org** — unbounded partition count, per-query planning cost, and it solves
  nothing the database boundary (MT) or an index (ST) doesn't already solve. Time is the axis retention
  actually uses.
- **A separate audit database or service** — loses §3's same-transaction guarantee, precisely what makes
  an audit row proof the change committed, and adds a cross-service failure mode to every write.
  **Revisit trigger:** a compliance requirement for third-party custody of the trail.
