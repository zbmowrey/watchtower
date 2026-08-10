---
title: Data Retention, Erasure & DSAR Doctrine (v1 — classification, retention windows, the subject graph)
description: The normative rule set for the regulatory data lifecycle on every fleet app — the four-class column-class registry a schema test keeps honest, per-class retention windows as recommended defaults with legal-hold suspension, the declared subject graph driving an idempotent erasure workflow (erase leaf PII, anonymize FK-load-bearing rows) and its six-way ripple into audit, backups, encrypted fields, objects, in-flight queue payloads and derivatives, the machine-readable DSAR export walking that same graph with third-party redaction, and the event sensitivity flag closing [[fleet-webhook-specification]]'s deferral. Regime-agnostic mechanism; each app maps its obligations onto it.
tags: [ spec, standard, privacy, retention, erasure, dsar, pii, compliance, postgres, laravel, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, audit-logging-standard, encryption-at-rest-doctrine, backup-dr-standard, tenant-isolation-rls, file-storage-standard, notifications-standard, fleet-queue-doctrine, fleet-webhook-specification, fleet-testing-doctrine, defense-in-depth-model, security-governance, datetime-timezone-doctrine ]
---

# Data Retention, Erasure & DSAR Doctrine — v1

The **requirement of record for the regulatory lifecycle of personal data**: what class a column is in,
how long it may be kept, what "delete me" does, and what "give me my data" produces. Written against
Laravel 13 / PHP 8.5, Postgres, and S3-compatible object storage. Normative language per
[[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, recorded there, never silent.
Site-specific numbers are marked **recommended defaults**.

**Out of scope, by owner.** Who may reach a row *while it exists* is [[tenant-isolation-rls]]'s — it owns
isolation, the security half; this page owns the regulatory lifecycle half, and the split is stated once
here. Crypto mechanics are [[encryption-at-rest-doctrine]]'s, trail redaction [[audit-logging-standard]]
§8's, backup and PITR [[backup-dr-standard]] §7's, object lifecycle [[file-storage-standard]] §7's. Also
out: **legal instruments** — processing agreements, privacy notices, lawful-basis determination. Those are
contracts, not code; this page is the mechanism they point at, and it answers the retention and privacy
questions [[defense-in-depth-model]]'s Data layer raises.

## §1 The four laws

1. **Mechanism, not regime.** Erasure, retention, and subject export are *capabilities*; a regulation is a
   **mapping** recorded per app — which subjects, which clock, which exemptions. Naming a regime in code (a
   `gdpr` module, a statutory deadline as a constant) makes the second regime a rewrite. Regulations appear
   below only as examples of what an app maps on.
2. **Classification is a schema fact, not a judgment at the callsite.** A column has a class the day it is
   created; retention, erasure scope, DSAR export, encryption designation ([[encryption-at-rest-doctrine]]
   §3.1 class 4) and webhook sensitivity (§6) are all *derived* from it. An unclassified column is the
   finding, not a pending task.
3. **Retention is a ceiling, not a promise to keep** — the longest the app *may* hold something, never a
   licence to keep it because it might prove useful. Every extra month is a month of erasure latency
   ([[backup-dr-standard]] §7).
4. **Erasure completes for live data immediately and for backups when the last pre-erasure backup expires
   — and the subject-facing statement says both.** "Fully deleted", claimed from the job's exit code, is
   false for the length of the retention window.

## §2 Classification — four classes, one registry

| Class | What it covers | Downstream consequence |
|---|---|---|
| **C0 public** | Data the app deliberately publishes: published content, public handles, docs | No retention obligation, no erasure scope, freely exportable |
| **C1 internal** | Operational and non-personal: configuration, flags, aggregate counters, non-identifying telemetry | Business retention only; out of scope for erasure and DSAR |
| **C2 personal** | Attributable to a living person directly or by joining: name, email, phone, address, IP, user agent, device id, the timestamps of a person's actions, free text a person wrote | In scope for §3 windows, §4 erasure, §5 export |
| **C3 sensitive-personal** | Government and financial identifiers, precise location, health/biometric, and whatever a regime the app maps treats as special category | Everything C2 carries, **plus MUST** be encrypted ([[encryption-at-rest-doctrine]] §3.1 — designation here, implementation there) and minimized at capture |

- **Ordered, and the maximum wins — MUST.** A derived artifact — materialized view, search document, cache
  entry, export bundle, webhook payload — carries the **highest class of its inputs**. Derivation does not
  launder class, and believing it does is how "erased" subjects stay searchable (§8).
- **The column-class registry — MUST:** one per app, declaring per column its class, retention basis, and
  erasure disposition (`erase` / `anonymize` / `retain` with a named justification). **Ruling on the
  mechanism — a dedicated registry file:** a single enumerable map in the app's `Privacy` namespace, not
  migration annotations and not model attributes (§9). Migrations are append-only *history* while class is
  a *current* fact; one diffable artifact is what a reviewer reads in a minute and a test enumerates
  against the live schema.
- **It covers stores, not just columns — MUST:** one entry per object-storage disk
  ([[file-storage-standard]] §2), per search index, per cache namespace, per queue payload shape carrying
  personal data. A store outside the registry is outside every rule below.
- **MUST NOT classify by table** — "the users table is personal" over-scopes `users.timezone` and leaves
  `settings.emergency_contact_phone` unclassified. The column is the unit.
- **A test keeps it honest — MUST** (§7): adding a column fails the build until it is classified. A column
  deliberately held below the class it looks is an **ACCEPTED-DEVIATION** per [[fleet-app-specification]] §7.

## §3 Retention — the map, the sweep, the hold

**The retention map — MUST.** One row per data class × purpose: what it is, its class, its window, the
basis for that window, the disposition at expiry. Recommended defaults, overridden with a reason rather
than drifted from:

| Data | Recommended default | Note |
|---|---|---|
| Personal data tied to a live account (C2/C3) | Life of the account | The account *is* the basis |
| Personal data after account closure | **30 days**, then erasure sweep | Grace for accidental closure and reactivation |
| Authentication and access records (sessions, login events, IP, user agent) | **90 days** | C2 by definition — an IP is personal data |
| Support and free-text correspondence | **24 months** | Often C3 in practice; minimize at capture |
| Derived analytics | **90 days** to aggregate, identifiers then dropped | An aggregate that cannot be re-identified falls to C1 |
| DSAR export bundles | **7 days** | On the `exports` disk, expiring by lifecycle rule (§5) |
| Financial and transactional records | The longest statutory window the app is subject to | **A retention obligation outranks an erasure request** — resolved in the map, never at the callsite |
| Notification copies; the audit trail | Owned elsewhere: [[notifications-standard]]'s prune, and [[audit-logging-standard]] §6's *operational* archival calendar | Pointed at, never restated — and the archival calendar is not a retention obligation |

- **The sweep — MUST:** a scheduled console command on the `heavy` partition per [[fleet-queue-doctrine]] —
  chunked by primary key and therefore resumable, idempotent, observable (rows swept and remaining, per
  class), riding the scheduler heartbeat. **Tenant-aware — MUST:** per tenant through the tenancy runner
  ([[tenant-isolation-rls]] §3); wired plainly it runs once against the central connection and silently
  touches no tenant database. A sweep deleting nothing on its first run against a live app is broken, not
  clean — that run is a backlog by construction.
- **Expiry writes are domain events — MUST.** Unlike the re-encryption sweep
  ([[encryption-at-rest-doctrine]] §4), an erasing or anonymizing write *is* a mutation of record: it moves
  `updated_at` and it audits under the named system principal [[audit-logging-standard]] §4 requires. An
  erasure invisible in the trail is indistinguishable from data loss.
- **Legal hold — MUST be a row, never a flag:** subject key, scope, opened-at, opened-by, reason reference.
  Sweep and erasure job both consult it and **skip named subjects, recording each skip**. A hold in
  configuration or a code branch is invisible to an auditor and cannot be lifted per subject.
- **A hold suspends; it never cancels — MUST.** When it lifts, the next sweep collects everything it
  protected, with expiry recomputed **from the original clock**, not from the lift. It **MUST NOT** be
  open-ended without a review date, and an erasure request against a held subject is **acknowledged,
  deferred, and recorded** — never silently dropped.

## §4 Erasure — the subject graph

- **Subject roots and the declared graph — MUST.** Each app names its subject roots (typically the user,
  sometimes a separate customer or contact record) and declares, beside the registry, the **subject graph**:
  owned rows, files, notification copies, search and cache derivatives, and audit entries carrying that
  subject's C2/C3 values. The graph is *declared*, not discovered at runtime — the foreign-key graph is not
  the subject graph (§9).
- **Erase vs anonymize — the decision rule, MUST.** A row whose **existence is load-bearing for another
  party's record** — an invoice line, an audit row, a message in someone else's thread — is **anonymized**:
  personal values overwritten with class-appropriate tombstones while the row, its keys, and its timestamps
  survive. A row whose only reason to exist is the subject — profile, preferences, address, uploaded file,
  notification copy — is **erased**. Short form: **FK-load-bearing anonymizes, leaf PII erases.**
- **Anonymization MUST be irreversible.** A pseudonym the app can reverse is still personal data and the
  mapping is the record you promised to delete; hashing an email under a salt the app holds is reversible
  for any candidate email. Where referential continuity needs a stable token it is generated randomly at
  erasure and **no mapping is kept**. Quasi-identifiers left intact (precise timestamp + coarse location +
  device) re-identify a person in any realistic dataset — coarsen or drop them in the same write.
- **The job — MUST** be an idempotent queued workflow on `heavy`, one per subject, safe to re-run and
  resumable at any stage, ordered: mark the subject *erasing* (live surfaces stop serving it) → erase leaf
  data and files → anonymize load-bearing rows → ripple → verify → receipt.
- **The ripple — MUST cover all six.** An erasure stopping at the primary tables is not an erasure.
  1. **Encrypted fields** — decryptable is not erased; a ciphertext column is erased or tombstoned like any
     other, and "the key is gone" is not an argument (§9).
  2. **Object storage** — files, derivatives and thumbnails, **noncurrent versions and replicas**, each on
     its own lifecycle clock ([[file-storage-standard]] §7, [[backup-dr-standard]] §7).
  3. **The audit trail** — redaction in place across the live parent **and** the archive. This page rules
     *when* (a stage of this job) and *what* (the subject's C2/C3 values inside old→new diffs, plus the
     denormalized causer label); [[audit-logging-standard]] §8 owns *how*.
  4. **Backups and PITR** — nothing is rewritten; the job's final durable act is the erasure-ledger entry
     driving the post-restore re-erasure step ([[backup-dr-standard]] §7).
  5. **Queue payloads in flight** — a job dispatched before the erasure holds the subject's data in Valkey.
     Handlers re-fetch at handle time ([[fleet-queue-doctrine]] §3) so most see erased state; the rest
     **MUST** check erasure state at handle time and no-op. Payload copies expire with the queue and **MUST
     NOT** be chased — except a `failed_jobs` row, which outlives it and is covered by its prune.
  6. **Derivatives** — search documents, materialized views, cached fragments, prior export bundles, and
     retained webhook delivery payloads inherit class (§2) and are therefore erasure targets. Being
     regenerable, they are **dropped and rebuilt**, never edited surgically.
- **Tenancy — MUST.** Database-per-tenant apps walk the graph inside the tenant database and, separately, in
  the central one wherever the subject exists there; erasing a whole *tenant* is dropping its database
  ([[tenant-isolation-rls]] §3), the one case needing no graph. Shared-database apps walk it once under the
  org predicate.
- **Verification — MUST.** The penultimate stage queries every registered C2/C3 column for the subject's
  identifiers and lists the subject's object-storage prefixes, asserting both empty. Failure **fails the job
  loudly**; it does not warn. This is what makes "erased" a fact rather than a belief.
- **The receipt — MUST.** Completion writes a durable receipt: subject key (hashed where that suffices),
  requested-at, completed-at, scope covered, what was anonymized instead of erased and why, and the **backup
  horizon** — the UTC date after which the last pre-erasure copy expires ([[datetime-timezone-doctrine]]).
  Law 4's statement is written from the receipt, never from the job's exit. **The receipt is not the
  ledger:** the ledger is the minimal machine record re-applying erasures after a restore, the receipt the
  answerable human record — two artifacts, and neither becomes a PII store in its own right.

## §5 Subject access export — DSAR

- **Same graph, opposite direction — MUST.** The export walks §4's *declared subject graph*. Two graphs
  drift within a quarter; one graph means an export gap is also an erasure gap, and §7's symmetry test finds
  both at once.
- **Format — MUST:** machine-readable **JSON** as the canonical form — one object per source, keyed by a
  stable domain name, values rendered as the subject would recognize them (enum labels, not integers;
  timestamps UTC ISO-8601 per [[datetime-timezone-doctrine]]) — plus a **files manifest** (bundle path,
  original filename, class, byte size, checksum) and the files themselves. A human-readable rendering
  **MAY** ride alongside; the JSON is what makes the bundle portable.
- **Queued, time-limited, authenticated — MUST.** Generated on `heavy`, written to the `exports` disk,
  delivered by a time-limited signed URL or an app-mediated stream ([[file-storage-standard]] §5), expiring
  on §3's window, **rate-limited per subject** (repeated bundles are an exfiltration primitive), and audited
  on every generation under [[audit-logging-standard]] §2 criterion (c). The download **MUST** be
  re-authenticated as the subject — a fresh credential check, not merely a live session — and **MUST NOT**
  be emailed as an attachment: an unauthenticated mailbox copy with no expiry is a second breach surface.
- **Excluded — MUST, with the exclusions stated in the bundle** rather than silently applied. **Other
  subjects' data in shared records:** the subject's own contributions to a thread, a shared document, or an
  org's history are exported while other participants' C2/C3 values are redacted to **stable
  non-identifying references** ("Participant 2"), keeping the structure legible — exporting the shared
  record wholesale hands one subject another's data. **Derived and inferred internal signals** — risk
  scores, fraud and abuse heuristics, internal notes, segmentation — are excluded by default, because
  exporting the model that detects abuse hands it to the abuser; where a regime obliges disclosure of a
  *decision*, the app maps that to a stated summary of the decision, not the feature vector. **Security
  material** — password hashes, tokens, recovery codes, blind-index values ([[encryption-at-rest-doctrine]]
  §5), signing secrets — is credentials, not a copy anyone benefits from holding.

## §6 The webhook sensitivity flag — deferral closed

[[fleet-webhook-specification]] §0 defers PII/sensitivity flags on event types "until there is a standard".
This is that standard.

- **Every event type carries a declared sensitivity — MUST**, drawn from §2's classes and computed as the
  **maximum class of the fields its payload template emits** (a template is a derivation, so max-wins
  applies). It **MUST** be derivable from the registry rather than hand-asserted, so a template that adds a
  C3 field raises its event's class without anyone remembering to. **Per-field designation — MUST** where
  templates are configurable, so a target's payload can be minimized field-by-field without editing the
  event definition.
- **The egress ceiling — MUST.** An app declares the highest class it emits outbound (**recommended
  default: C2** — no C3 field leaves by webhook). An event above the ceiling is refused **at subscription
  time, not at delivery time**: a delivery-time refusal is a silent partial outage.
- **Retention follows class.** Delivery records capture payloads, so a C2+ payload inherits §3's window and
  §4's ripple; the storage window itself stays [[fleet-webhook-specification]] §9's. The subscription UI
  **SHOULD** show each event's class, so an operator wiring a third-party endpoint sees what they are about
  to send before they send it.

## §7 Testing

Placement and judgment per [[fleet-testing-doctrine]].

- **Registry honesty — MUST:** an architecture/integration test enumerating the live schema, failing on any
  column absent from the registry *and* any registry entry whose column is gone.
- **Erasure completeness — MUST, per app:** seed a subject across the full declared graph (rows on each
  owned table, a file on each disk, a notification, an audit entry), run the job, assert §4's verification
  queries return empty and a receipt exists. Written so **adding a subject-owned table fails it** until the
  graph is extended.
- **Idempotency — MUST:** the job run twice yields the same state and one receipt. **Legal hold — MUST:** a
  held subject survives both the sweep and an erasure request, and is collected on the first run after the
  hold lifts. **Export/erasure symmetry — SHOULD:** one test asserting both walkers enumerate the same set.
- **MUST NOT test the regime.** "Erasure completes within N days" is a mapping the app records, not an
  assertion a suite can hold ([[testing-antipattern-catalog]]). Test the mechanism; the mapping names the
  clock.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Erased subject reappears after a restore | No erasure-ledger entry; post-restore re-erasure step skipped | [[backup-dr-standard]] §7 — the ledger write is the job's last act (§4) |
| "Erased" but still searchable or on a dashboard | A derivative not treated as inheriting class — search doc, materialized view, cached fragment | §2 max-wins; drop and rebuild it (§4 ripple 6) |
| Erasure ran, the trail still names the subject | Redaction stopped at the live partitions | [[audit-logging-standard]] §8 — cover the archive |
| A "deleted" file still downloads | Noncurrent version kept by a versioned bucket; a replica on its own clock; an unmapped thumbnail | [[file-storage-standard]] §7 + [[backup-dr-standard]] §7 |
| Retention sweep deletes nothing on a live app | Map never wired; in a multi-tenant app the schedule ran centrally and touched no tenant database | §3 — wire the map, then the tenancy runner ([[tenant-isolation-rls]] §3) |
| Job fails halfway, subject left half-erased | Not staged, not resumable, or not idempotent | §4 — stage it and re-run; a re-run must be harmless |
| Anonymized rows re-identified in a report | Reversible pseudonym; quasi-identifiers left intact | §4 — random token with no mapping; coarsen or drop the quasi-identifiers |
| DSAR bundle contains another customer's name | Shared record exported wholesale | §5 — redact third parties to stable references |
| Subject told "fully deleted" while backups still hold them | Statement written from the job's exit rather than the receipt | Law 4 — state both horizons (§4) |
| A column holding PII nobody classified | Registry test not wired; data living in a store the registry doesn't cover (cache, index, disk) | §2 — the registry covers stores; §7's test |

## §9 Considered and rejected

- **Hard-coding a single regulation** (a `gdpr` module, a statutory deadline as a constant) — law 1: the
  second regime becomes a rewrite, and a regime's specifics belong in the app's mapping where they change
  without touching the mechanism. **Revisit trigger:** none foreseeable.
- **Crypto-shredding as erasure** (discard a per-subject key, call the ciphertext deleted) — fleet encryption
  is `APP_KEY`-scoped and [[encryption-at-rest-doctrine]] §7 already rejects per-row envelope and per-tenant
  keys; retired keys stay in custody as long as the backups they open ([[backup-dr-standard]] §5), so the
  "shredded" key is one restore away; and plaintext copies in search indexes, caches, and logs survive
  untouched. **Revisit trigger:** the BYOK/per-subject-KMS requirement that page records.
- **Classification attached to code instead of a registry** — *migration-adjacent* (a comment or attribute on
  the migration that created the column) makes a current fact derivable only by replaying history, including
  the migrations that renamed or dropped it; *model attributes* (`#[Personal]`) cover only what an Eloquent
  model exposes, missing pivots, log tables, materialized views, and every non-database store, and put a
  compliance artifact inside business code. **Revisit trigger:** a first-party framework surface for column
  metadata that reflection can enumerate against the live schema.
- **Soft delete as erasure** — a `deleted_at` row is intact personal data with a filter in front of it; it
  satisfies a product requirement (undo) and no regulatory one. The sweep is what turns it into erasure.
- **Deleting the subject row and letting foreign keys cascade** — the cascade erases whatever the schema
  happens to reference (too much: another party's invoice line) and nothing it doesn't (too little: files,
  search documents, the audit trail, the other database). §4's declared graph exists precisely because the FK
  graph is not the subject graph.
- **A single global retention window, and its cousin anonymize-everything** — one number over-retains access
  logs by twenty-one months while under-retaining financial records past a statutory obligation, because it
  is asked to be both ceiling and floor; blanket anonymization is cheaper to build and leaves quasi-identifier
  sets that re-identify people. Anonymization is the exception §4 justifies per row, never the default.
- **A third-party privacy/DSAR platform as the system of record** — it needs a standing credential into every
  store it must erase from, exactly the blast radius §4's job avoids, and it still cannot answer for the
  backup horizon. **Revisit trigger:** subject-request volume no first-party queue can absorb — a
  support-workflow problem before it is an engineering one.
