---
title: Backup, DR & PITR Standard (v1 — what is backed up, RPO/RTO tiers, restore drills, the DR runbook)
description: The normative rule set for durability and recovery on every fleet app — what MUST be backed up versus what GitOps re-creates, Postgres base backups plus continuous WAL archiving for point-in-time recovery, the default RPO/RTO tiers, the 3-2-1 stance with backup credentials isolated from app credentials and one retention-locked copy, `APP_KEY` custody as a recovery artifact and retired-key retention, the quarterly restore drill and what it must prove, how erasure ripples through backups, the per-scenario DR runbook with its restore-vs-roll-forward decision, and heartbeating the backup pipeline itself. Owns the recovery mechanism; the incident *process* stays with [[incident-response-template]].
tags: [ spec, standard, backup, disaster-recovery, pitr, postgres, wal, restore-drill, k8s, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, incident-response-template, encryption-at-rest-doctrine, data-privacy-doctrine, file-storage-standard, audit-logging-standard, tenant-isolation-rls, fleet-queue-doctrine, security-governance, datetime-timezone-doctrine, observability ]
---

# Backup, DR & PITR Standard — v1

The **requirement of record for durability and recovery** — what survives the loss of a volume, a
cluster, a provider, or a bad afternoon. Normative language per [[fleet-app-specification]]: **MUST /
SHOULD / MAY / ACCEPTED-DEVIATION**, recorded there, never silent. Site-specific numbers are marked
**recommended defaults**; an app needing another records it rather than drifting into it. **Division
of labor:** [[incident-response-template]] owns the *process* — who declares, containment, the
write-up; this page owns the *mechanism* it reaches for, and its recovery-levers row "restore data to
a point in time" is satisfied by §4 and proven by §6.

## §1 The four laws

1. **A backup unverified by restore is not a backup.** The metric is *last successful restore*, not
   *last successful backup job*. Every rule below exists to make that enforceable; §6 enforces it.
2. **Back up state; re-create everything else.** The cluster reconciles from git, so backup covers only
   what cannot be regenerated — and that set is **enumerated**, never assumed. An unenumerated
   persistent volume is the finding, not a pending task.
3. **A compromised app MUST NOT be able to destroy its own backups.** Backup identities are separate
   from application identities and one copy is retention-locked (§5) — backups an attacker inherits
   with the app credential are a copy, not a control.
4. **A restore is only as good as its keys, and a stopped backup is already an incident.** Restored
   without its `APP_KEY`, a database restores ciphertext (§5); an unheartbeated pipeline fails
   silently for months and is discovered on the worst possible day (§9).

## §2 What is backed up, what is re-created

| Asset | Stance | Mechanism / recovery source |
|---|---|---|
| Postgres — transactional data | **MUST back up** | Periodic base backup + continuous WAL archiving to object storage → PITR (§4). Managed Postgres: its native PITR feature, under the same rules |
| Postgres — second-format copy | **SHOULD** | Weekly logical dump, so a physical-format or version-specific corruption isn't a single point of failure |
| Audit trail + archive partitions | **MUST** | Inside the same database backup set — a detached archive partition is not a backup ([[audit-logging-standard]] §6) |
| Objects, durable classes (`uploads`, `documents`) | **MUST** | Bucket versioning on, noncurrent-version lifecycle, plus a copy in a second region/provider (§5). Disk classes are [[file-storage-standard]]'s |
| Objects, derived classes (`exports`, thumbnails, search index) | **MUST NOT** back up | Regenerable by definition; recovery is regeneration (§3 tier T2) |
| Secrets: `APP_KEY` (current + retired), DB and restore credentials, sealed-secrets private key, DNS/registrar access | **MUST**, out-of-band | The recovery bundle (§5) — readable without the cluster |
| k8s cluster, manifests, images | **MUST NOT** back up cluster state | GitOps re-creates from the reconciled manifests; the **git remote MUST be mirrored** to a second host, the wiki included |
| Persistent volumes other than Postgres | **MUST enumerate** | Each PVC is either in a named backup set or explicitly declared ephemeral. Both answers are fine; no answer is not |
| Valkey/Redis — queues, cache, sessions | **MUST NOT** back up | Nothing. See the ruling below |
| Application logs and metrics | Retention-bounded, not backed up | [[observability]]. Telemetry is diagnosis, never a recovery source |

- **Valkey loss, stated honestly — MUST plan for it.** Losing the instance means queued jobs never run
  (not "run later" — *never*), sessions log out, caches cold-start. At-least-once delivery makes
  *duplication* survivable ([[fleet-queue-doctrine]] §1 law 1), never disappearance.
- **Therefore a queue is not a system of record — MUST NOT** treat an enqueued job as the durable trace
  of an intent. Work whose loss is unacceptable is re-derivable from committed database state (an
  outbox row, a status column a sweeper re-dispatches from) — a flow failing this is a design defect
  DR surfaced, not a reason to persist Valkey (§11).

## §3 RPO and RTO — the declared tiers

| Tier | Data class | RPO — recommended default | RTO — recommended default |
|---|---|---|---|
| **T0** | Transactional Postgres | **≤ 5 minutes** (bounded by WAL shipping, not base-backup cadence) | **≤ 4 hours** to serving |
| **T1** | Durable objects (`uploads`, `documents`) | **≈ 0** (versioning at write time; replication lag for the offsite copy) | **≤ 4 hours** for the working set; restore-on-demand for the tail |
| **T2** | Derived / regenerable | n/a — nothing is lost | The time to regenerate, which **MUST** be known |
| **T3** | Ephemeral (queues, cache, sessions) | No recovery (§2) | 0 — they refill |

- **Targets are per-app and recorded — MUST.** Defaults bind unless the app records an
  **ACCEPTED-DEVIATION** in [[fleet-app-specification]] §7; a tighter target is a purchase (§11), not a
  declaration. **All windows and recovery targets are stated in UTC** ([[datetime-timezone-doctrine]]).
- **An RTO you have not measured is a guess — MUST** record the *measured* restore time from the last
  drill (§6) beside the target; measured exceeding target is a finding for [[security-governance]].
- **RPO is bounded by the archive, not the snapshot.** Daily bases with 60-second WAL shipping give a
  60-second RPO and a multi-hour RTO; conflating them is how an app claims a target it does not hold.

## §4 Postgres — base backups, WAL archiving, PITR

- **Continuous WAL archiving to object storage — MUST**, to a destination the app itself cannot delete
  from (§5). `archive_timeout` **default 60s**, so an idle database still bounds RPO. Managed Postgres
  substitutes its provider PITR feature and every rule here still binds — a different implementation
  of the mechanism, not an exemption from it.
- **Cadence and retention — recommended defaults:** base backup **daily**; **PITR window 14 days**;
  weekly logical dump retained **35 days**. Longer requires a *named* obligation, because **retention
  is erasure latency** — a 90-day window is a 90-day promise to every erasure request (§7).
- **Snapshot cadence sets RTO; WAL sets RPO.** Restore ≈ fetch the base + replay every segment since;
  daily bases cap replay near 24 hours of WAL, while weekly bases multiply RTO by seven and the RPO on
  the dashboard never moves.
- **Restore to a new instance — MUST NOT restore in place** over the live primary: it is both evidence
  and fallback, and a failed in-place restore has no second act. **A replica is not a backup — MUST
  NOT** count one as a copy under §5; replication replays your `DELETE` in milliseconds.
- **Named restore points — MUST** before a destructive migration (`pg_create_restore_point`, a deploy
  runbook step): it turns "restore to roughly when it was fine" into an exact target and makes §8 D a
  decision rather than a bisect. **Recovery targets** — time (UTC), LSN, or named point — resolve at
  the *transaction commit* boundary: "14:00:00" is the last commit at or before it.
- **Backups are encrypted independently of their source** — that rule and its verification are
  [[encryption-at-rest-doctrine]] §2's; a new destination is enrolled there before it holds a byte.

## §5 3-2-1, credential isolation, and the recovery bundle

**3-2-1, adapted:** at least **3** copies (live, primary backup, offsite), across **2** distinct
storage technologies or providers, with **1** copy **outside the blast radius of the production
credential set** — the clause carrying the weight here. "Two buckets in one account" is one copy
wearing a hat.

- **Backup credentials MUST be separate identities from application credentials.** The app's storage
  credential holds **no delete permission on the backup prefix**, preferably no access at all — the
  backup agent is its own workload with its own scoped identity. One credential that can both write and
  delete backups is one compromise from having none.
- **Retention lock / object lock — MUST** where the backend supports it, on the offsite copy at minimum,
  with delete held by **no production identity** — what separates "we have backups" from "ransomware
  deleted the backups too" (§8 F). **The second copy MUST NOT be reachable with the first copy's
  credential**, and **restore credentials are break-glass:** out-of-band, rotated after use per
  [[security-governance]].
- **The recovery bundle — MUST exist and be readable without the cluster.** Per environment: `APP_KEY`
  (plus retired keys still in scope), database credentials, the restore-side object-storage credential,
  the git remote and a read token, the sealed-secrets private key or equivalent, DNS/registrar access.
  One held only in a secret manager running *inside* the cluster cannot be opened on the day it counts.
- **`APP_KEY` custody is a recovery artifact — MUST**, the delegation [[encryption-at-rest-doctrine]]
  §4 makes here: the key rides in the bundle, per app per environment, and a drill proves it decrypts
  (§6). **Retired keys MUST outlive the backups they can read** — held until every artifact written
  before their rotation has expired. Dropping a key from `APP_PREVIOUS_KEYS` removes it from the
  *runtime* (that page's §4 step 5, post-sweep); custody keeps the same value escrowed until the last
  snapshot it opens is gone. Conflating the two restores a database of undecryptable ciphertext.

## §6 Restore drills

- **Cadence — SHOULD quarterly; MUST after a major schema change** and after any change to the backup
  pipeline itself, which is otherwise an untested deploy of the one system whose failure is invisible.
- **What a drill proves — all six, or it was a file-copy test:**
  1. Restore of the **actual archived artifacts** (not a fresh ad-hoc dump) into a **scratch
     environment** sharing no credentials with production.
  2. Restore **to a specific point in time**, not merely "latest" — untested PITR is not PITR.
  3. The app **boots**: schema at the version the paired image expects, extensions present.
  4. A **smoke query** returns plausible business data — counts within an order of magnitude of
     production, newest row within the RPO target of the recovery target time.
  5. **`APP_KEY` decrypts** one field per registered crown-jewel class
     ([[encryption-at-rest-doctrine]] §3.1) — catching custody rot, silent until the day it is fatal.
  6. **Objects restore too** — a sampled key set per durable disk, fetched and checksummed
     ([[file-storage-standard]]); a database-only drill proves half a system.
- **RTO is measured — MUST:** wall clock from "begin" to a passing smoke query, *including* fetching
  the recovery bundle — the step skipped in drills and discovered in incidents. **Automation —
  SHOULD:** scripted, scheduled, structured output, **and read by a human each cycle**, since a fully
  automated drill nobody reviews regresses to green-forever.
- **The scratch environment is production-tier for the life of the drill — MUST.** It holds real data,
  so it takes real controls, is **torn down** afterwards, and its dataset **MUST NOT** be retained or
  reused for development ([[data-privacy-doctrine]], [[tenant-isolation-rls]]).
- **Recording is news, not law — MUST NOT live on this page.** Results (date, artifact, target time,
  measured RTO, what broke) go to a `status: living` log under `wiki/logs/`, which also feeds the "last
  exercised" column of [[incident-response-template]]'s recovery-levers table. A failed drill is a
  finding for [[security-governance]]'s register — not a footnote, and not a green dashboard.

## §7 Erasure ripple — backups and PITR

The regulatory reasoning is [[data-privacy-doctrine]]'s; the mechanics are here.

- **MUST NOT rewrite a backup to remove a subject.** Surgical edits to a base backup or WAL stream
  invalidate the artifact — trading a working restore for a compliance gesture.
- **The pattern: erase in the live store now; the erasure completes when the last pre-erasure backup
  expires.** Erasure latency therefore *equals* the retention window (§4 defaults: 14 days PITR, 35 for
  the dump) — which is why §4 caps retention by need rather than by "storage is cheap".
- **An erasure ledger — MUST:** a durable record outside the erased rows (subject key or its hash,
  erased-at, scope) so a **post-restore re-erasure step** re-applies every erasure predating the
  recovery target — without it a restore silently resurrects erased subjects, and with it that step is
  mandatory in every §8 path. **The ledger MUST hold the minimum needed to re-erase and nothing more**
  — a hashed identifier where that suffices, else it becomes the record you promised to delete.
- **Objects: delete noncurrent versions and replicas.** A `DELETE` against a versioned bucket writes a
  delete marker and keeps the bytes ([[file-storage-standard]]). **The audit trail ripples too** —
  erasure covers `audit_logs_archive` ([[audit-logging-standard]] §8), and the same retention-bounded
  ripple applies to every backup containing it.

## §8 The DR runbook skeleton

**Every scenario opens the same way — MUST:** declare severity and open the incident per
[[incident-response-template]]; **stop the writes**; restore **to new**, never in place (§4); re-apply
the erasure ledger (§7); verify from outside the system before calling it recovered.

| Scenario | Recovery path | Restore or roll forward |
|---|---|---|
| **A. Volume / instance loss** | Restore the latest base to a new instance, replay WAL to the end, repoint the service, smoke-check | **Roll forward to now** — no decision to make; loss is bounded by archive lag |
| **B. Cluster loss** | Reconcile a fresh cluster from git, restore the database (A), re-inject secrets from the recovery bundle, restore enumerated PVCs | Roll forward. The cluster is the *fast* part; RTO is dominated by state and secrets — drill that ordering, not the `kubectl apply` |
| **C. Region / provider loss** | Restore from the second-provider copy (§5), rebuild there, repoint DNS | Roll forward, accepting that copy's replication lag as the real RPO. Honest RTO is hours-to-a-day without warm standby (§11) |
| **D. Bad deploy → data corruption** | Roll the deploy back first ([[incident-response-template]] scenario A); the data half is here | **The decision.** Scope *known and bounded* → **roll forward** with a corrective migration/backfill, preserving every write since. Scope *unknown or unbounded* → PITR to the named restore point (§4), which **costs every write since that point**. Decide on scope-known vs scope-unknown, never on which feels safer |
| **E. Accidental deletion (one table, one tenant)** | PITR into a **parallel** instance, extract the affected rows, merge into live | Roll the system forward, restore the subset. A full swap to fix one tenant discards everyone else's writes ([[tenant-isolation-rls]]) |
| **F. Ransomware / destructive compromise** | Assume the production credential set is hostile: restore **only from the retention-locked copy** (§5) into a **new** cluster with rotated credentials; rotate `APP_KEY` after restore | Restore to **before first known compromise**, not before first symptom — the gap between them is the whole problem. Containment, forensics, and disclosure are [[incident-response-template]]'s |

## §9 Monitoring the backup pipeline

- **Every backup schedule heartbeats — MUST.** A backup job that silently stops *is* the incident, and
  it is invisible by nature. Reuse the scheduler dead-man mechanism and its inert-when-unset config
  pattern verbatim ([[fleet-app-specification]]) — **one check per schedule**, never one for all.
- **Alert on ages, not exit codes — MUST:** age of last *successful* backup, age of last archived WAL
  segment, days since last successful drill (threshold = §6 cadence plus grace). An exit-0 job that
  wrote nothing is the failure exit codes cannot see, and law 1 is unenforceable without the
  drill-staleness alert. **Size deltas — SHOULD:** an artifact 90% smaller than yesterday's is corrupt
  or empty, and it will restore "successfully".
- **Watch `pg_stat_archiver`** — failed count and last-archived time; WAL accumulating on the primary
  is a *precursor* alert, filling the data volume (an outage) while every unarchived segment punches a
  hole in the PITR window (a silent loss of recoverability). **Backup alerts MUST reach a human without
  depending on the cluster** they describe — an alert path inside the failure domain goes quiet exactly
  when it matters. Emission is [[observability]]'s.

## §10 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| WAL piling up on the primary, data volume filling | `archive_command` failing silently; archive-destination credential expired or bucket policy changed | `pg_stat_archiver`, then repair the destination. An outage *and* a PITR window broken from the first failed segment (§9) |
| Backups "green" for months, restore fails | Never drilled; job succeeded writing a zero-byte or truncated artifact | §6 drills; size-delta alert (§9) |
| Backup job stopped weeks ago, nobody noticed | No heartbeat on the backup schedule | §9 — one dead-man check per schedule |
| Restore completes, app won't boot | Restored schema and deployed image from different versions; missing extension on the fresh instance | Restore the image/schema **pair** named in the runbook; create extensions in the restore script (§6 check 3) |
| Restore boots, nothing decrypts | Key never in the recovery bundle; rotated after the snapshot with the retired key already out of custody | §5 retired-key retention; rotation procedure at [[encryption-at-rest-doctrine]] §4 |
| PITR "to 14:00" lands on the wrong data | Target expressed in the operator's local zone; target resolves at a commit boundary | Targets in UTC ([[datetime-timezone-doctrine]]); prefer a named restore point (§4) |
| Erased subject reappears after a restore | No erasure ledger, or the re-erasure step was skipped | §7 — ledger plus a mandatory runbook step |
| "Deleted" object still downloadable | Versioned bucket kept the noncurrent version; replica on its own lifecycle | §7 — delete versions and replicas, not just the current object |
| Ransomware deleted the backups too | Backup credential shared with (or inheritable from) the app; no retention lock | §5 — separate identity, object lock, offsite copy |
| Drill passes; real recovery takes ten times longer | Drilled on a small dataset with warm caches, and skipped fetching the recovery bundle | §6 — production-scale data, whole path timed, bundle included |
| Queued jobs vanished after a failover | Expected — Valkey is not backed up (§2) | Re-dispatch from durable state; if that is impossible, the flow used the queue as a system of record |
| Restore is clean but the object store is stale | Database and object backups run on independent clocks | Record both recovery points; reconcile rows against objects after restore ([[file-storage-standard]]) |

## §11 Considered and rejected

- **Replicas (or an HA pair) as the backup** — replication faithfully replays `DELETE`, `DROP`, and a
  bad migration: availability, never recoverability. **Revisit trigger:** none; a delayed replica
  mitigates but does not substitute for §4's archive.
- **`pg_dump` as the primary mechanism** — RPO collapses to the dump interval, restore scales with
  rebuild-and-reindex, and consistent dumps hold long transactions on the primary; retained as the
  *second-format* copy only (§4). **Revisit trigger:** a small, low-write dataset MAY run dump-only as
  an ACCEPTED-DEVIATION stating the degraded RPO.
- **Backing up cluster state (etcd snapshots, cluster-state backup tooling)** — manifests are in git and
  the reconciler re-creates the cluster; a snapshot preserves yesterday's *drift* and hides that
  something was created out-of-band. **Revisit trigger:** cluster-resident state GitOps genuinely cannot
  re-create — the signal it should have been a PVC or a table.
- **Backing up Valkey (RDB/AOF)** — persists a store already declared expendable (§2), adds fork pauses
  on a latency-sensitive path, and restores stale jobs into a world that moved on. **Revisit trigger:**
  Valkey holding a system of record — which §2 exists to prevent, not accommodate.
- **Multi-region active-active or warm standby** — minutes of RTO for a permanent multiple of
  infrastructure cost, a data-residency question, and a split-brain failure mode the fleet has no
  tooling to arbitrate. **Revisit trigger:** a contractual RTO under an hour, where that cost has a name
  to be charged to.
- **Storing backups in the app's own account and credential scope**, and **encrypting them under a
  passphrase held in the app's secret store** — both put the recovery material inside the blast radius
  of every §8 scenario (§5). Convenience is the whole argument for either.
- **"Restore drill" as a tabletop or checklist review** — reading the runbook exercises the runbook, not
  the restore; law 1 admits no paper evidence. Likewise **retention "just in case"**: every extra month
  is a month of erasure latency (§7) and of ciphertext needing a retired key in custody (§5).
