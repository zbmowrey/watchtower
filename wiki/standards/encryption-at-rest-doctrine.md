---
title: Encryption-at-Rest Doctrine (v1 — two layers, crown jewels, key custody)
description: The normative rule set for data at rest on every fleet app — the two sequenced layers (infrastructure volume/bucket/snapshot encryption as the broad cheap floor; Laravel `encrypted` casts over a named crown-jewel field-class register as the targeted one), where casts attach and what they cost in queryability, `APP_KEY` custody and the `APP_PREVIOUS_KEYS` rotation window with its re-encryption sweep, and the searchable-encryption ruling (restructure → accept-and-compensate → blind index, in that order). Owns data at rest; transit is [[defense-in-depth-model]]'s and secret *delivery* is [[fleet-app-specification]]'s.
tags: [ spec, standard, security, encryption, secrets, key-rotation, postgres, storage, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, defense-in-depth-model, security-governance, fleet-queue-doctrine, fleet-webhook-specification, webhook-signing-scheme, backup-dr-standard, data-privacy-doctrine, tenant-isolation-rls, file-storage-standard, audit-logging-standard ]
---

# Encryption-at-Rest Doctrine — v1

The **requirement of record for data at rest** — bytes on a disk, in a bucket, or in a snapshot, in
the state an attacker finds them without a live application session. Normative language per
[[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations recorded
there, never silent.

**Out of scope, by owner.** Encryption *in transit* is [[defense-in-depth-model]]'s transport layer.
Secret *configuration delivery* — the env → config → k8s Secret path every credential travels — is
already [[fleet-app-specification]] law; this page governs the data an app stores, not the config it
is handed. Backup retention and restore drills are [[backup-dr-standard]]; what counts as personal
data is [[data-privacy-doctrine]]; who may read a row at all is [[tenant-isolation-rls]].

## §1 The four laws

1. **Two layers, sequenced.** **Layer 1** is infrastructure at-rest encryption — encrypted Postgres
   data volume, object-storage bucket SSE, encrypted snapshots: broad, cheap, usually one
   configuration flag. **Layer 2** is application-level encryption — Laravel `encrypted` casts over
   a named set of crown-jewel fields: targeted, queryability-breaking, applied one field class at a
   time. Layer 1 lands first in every app; layer 2 is never a reason to defer it.
2. **North star: every stored file, every row, every snapshot encrypted — reached incrementally.**
   The end state is total; the path is never a big-bang cutover. Each store and each field class is
   its own green-then-ratchet step per [[security-governance]], and the floor moves one direction.
3. **Neither layer substitutes for the other.** Volume encryption defends a stolen disk, a
   decommissioned node, a snapshot copied somewhere less trusted — and nothing else: to a live
   connection, to SQL injection, to a leaked read-replica credential, to anyone holding `psql`, a
   layer-1-encrypted database is plaintext. Layer 2 defends exactly those cases, for exactly the
   fields it covers. Arguing either makes the other unnecessary is [[defense-in-depth-model]]'s
   load-bearing-control tell.
4. **Encryption is not access control, and ciphertext is still the data.** A secret the wrong tenant
   can select is a breach in waiting whatever its encoding ([[tenant-isolation-rls]]); an encrypted
   column is still personal data for retention, export, and erasure ([[data-privacy-doctrine]]); and
   a field decrypted into a log line was never protected ([[audit-logging-standard]]).

## §2 Layer 1 — the infrastructure posture

Every environment satisfies this checklist, and **verification is enumerable**: one row per store
per environment, naming the concrete volume, bucket, or snapshot class and *how* the answer was
obtained. An unfilled cell is the finding, not a pending task.

| Store | Rule | "Verified" means |
|---|---|---|
| Postgres data volume | **MUST** be encrypted at the volume/filesystem layer — encrypted StorageClass, encrypted provider volume, or LUKS under the node | The flag read back from the live volume, not from the manifest that asked for it |
| Replicas + WAL/archive destination | **MUST** — a replica is a full copy, an archive a full history; neither inherits anything from the primary | Same read-back, per replica and per archive target |
| Object-storage buckets (S3-compatible) | **MUST** set **server-side encryption default-on at the bucket**, so an object written without an explicit header is still encrypted | Bucket configuration *plus* a written object's reported state |
| Snapshots / backups | **MUST** be encrypted independently of their source — a snapshot copied to another account, region, or tier carries none of the source's settings | The snapshot's own state, checked on a copy |
| Pod-local scratch | Pods run `readOnlyRootFilesystem`, so app-local writes are structurally near-zero; any `emptyDir`/PVC that *does* take data follows the volume rule | Enumerate writable mounts; the expected answer is "none holding data" |
| Local dev / CI volumes | **MAY** be unencrypted, and **MUST NOT** hold production data ([[data-privacy-doctrine]]) | Absence of production data, not presence of encryption |

- **Enabled at creation, never retrofitted — MUST.** Volume and bucket encryption are properties of
  the resource, not toggles; converting an existing store means creating an encrypted one and
  migrating into it. Planned encrypted the first time, the rule is free.
- **GitOps is the enforcement point — SHOULD.** The setting lives in the reconciled manifest, so a
  store created out-of-band surfaces as drift rather than as a later discovery.
- **A store that genuinely cannot be encrypted gets an ACCEPTED-DEVIATION** carrying compensating
  controls and a revisit trigger per [[security-governance]]'s register schema. Silence is the one
  disallowed outcome.
- **Payload encryption above SSE:** files whose *contents* are crown jewels — credential exports,
  retained captures, bulk PII extracts — are encrypted by the app before upload (§3); bucket SSE
  alone treats the storage operator as trusted. Placement and lifecycle → [[file-storage-standard]].

## §3 Layer 2 — application-level encryption

**Casts attach at the model layer, and only there — MUST.** An encrypted field is declared in the
model's `casts()` (`encrypted`, `encrypted:array`, `encrypted:collection`, `encrypted:object`,
`encrypted:json`), never as hand-rolled encrypt/decrypt inside accessors, actions, or repositories —
one declaration site is what makes the field class enumerable and the §4 sweep possible. Direct
`Crypt::encryptString()`/`decryptString()` is reserved for material with no Eloquent attribute to
hang off (a blob before it reaches object storage, a value placed in a cache entry) and **MUST** go
through the `Crypt` facade or the `Encrypter` contract.

- **Cipher — MUST be the framework default;** `app.cipher` is not an app-level tuning knob. Both
  supported ciphers are authenticated, so a tampered payload raises `DecryptException` instead of
  returning garbage — and a handler **MUST NOT** swallow that into a null. Tamper detection you
  catch and discard is tamper detection you do not have.
- **Column type — MUST be `text`** (`longText` for array/collection casts), never a `varchar` sized
  for the plaintext: the stored payload is base64 over a JSON envelope of IV, value, and MAC, which
  multiplies length several-fold, and a cleartext-sized column truncates on the first write.
- **Queryability is gone — the cost, stated plainly.** Every encryption uses a fresh random IV, so
  identical plaintext yields different ciphertext on every write: **no `WHERE`, no `LIKE`, no
  `ORDER BY`, no index, no join, no foreign key, no unique constraint.** The unique constraint is
  the dangerous one — the database accepts it, it never fires, duplicates accumulate silently, and
  `unique:`/`exists:` validation fails the same way. A field with a query goes through §5 **before**
  the cast, not after the feature breaks.
- **Serialization hygiene — MUST.** Encrypted attributes are `$hidden` and excluded from API
  resources, request/response body logging, and APM capture. The model decrypts on access, so a
  `toArray()` in a log context reverses the whole control ([[audit-logging-standard]]).
- **Queue payloads** carrying secrets or PII are `ShouldBeEncrypted` — the queue is a datastore.
  That rule is [[fleet-queue-doctrine]] §3's: the same taxonomy, a different store.
- **Hash, don't encrypt, wherever reversibility isn't required — MUST.** Passwords take the `hashed`
  cast; a token the app only ever *verifies* is stored hashed (as Sanctum already does). Encryption
  is for material the app must read back and replay outward.

### §3.1 The crown-jewel field classes

Classes an app **MUST** encrypt when it holds them:

1. **Stored third-party credentials** — provider API keys, OAuth access/refresh tokens, SMTP
   passwords: anything held *on someone's behalf* and replayed outward.
2. **Outbound signing secrets** — the per-Target webhook secret and the per-Target auth values
   beside it are this doctrine's reference implementation ([[webhook-signing-scheme]];
   WH-402/WH-404 in [[fleet-webhook-specification]]).
3. **Inbound tokens that must be replayable** — only where the design truly requires reading the
   token back; verification-only tokens are hashed (§3).
4. **Designated PII** — the narrow, *named* set: government and financial account identifiers,
   precise location, health/biometric data, free-text fields known to collect them. Names and email
   addresses are **not** in this class by default — queried constantly, carried by layer 1 plus
   access control. Designation is [[data-privacy-doctrine]]'s call; implementing one is this page's.
5. **Artifacts derived from 1–4** — exports, retained captures, archives ([[file-storage-standard]]).

**Admitting a new class — all five, or it is not admitted:**

1. **Disclosure of the value is itself the harm** — a credential or designated PII, not merely
   something that feels sensitive.
2. **Reading it back in plaintext is a requirement**, not a convenience (else hash it).
3. **No query depends on it** — no filter, sort, join, uniqueness — or §5 has already been walked.
4. **It ships as one change per class:** migration to `text`, the cast, the backfill of existing
   rows, and the serialization-hygiene edits, together. A cast landing ahead of its backfill turns
   every pre-existing row into a `DecryptException`.
5. **It is recorded in the app's field-class register** (model + column + class) — that register is
   the input to the §4 sweep, and an unregistered encrypted field survives rotation only by luck.

"Encrypt everything in this table" is not a field class. Whole-store coverage is layer 1's job,
which is exactly why layer 1 goes first.

## §4 `APP_KEY` — custody, rotation, and the re-encryption sweep

- **One key per app per environment — MUST.** An `APP_KEY` **MUST NOT** be shared across
  environments or apps: a staging key that decrypts production ciphertext makes staging a
  production-tier system with staging-tier controls. The key is 32 CSPRNG bytes from
  `php artisan key:generate` — never hand-authored, never derived.
- **The key is a recovery artifact — MUST be in the DR runbook.** A database restored without its
  key restores ciphertext. Key custody, and retention of *retired* keys for as long as the oldest
  backup they can read, are [[backup-dr-standard]]'s. Delivery to running pods is
  [[fleet-app-specification]]'s; this page owns what the key protects and how it turns over.
- **Rotation window — `APP_PREVIOUS_KEYS`.** New values encrypt under `APP_KEY`; decryption tries
  `APP_KEY` first, then each key in the comma-separated previous-keys list. That fallback is the
  entire zero-downtime mechanism.

**The rotation procedure — MUST, in order:**

1. Generate the replacement without installing it (`key:generate --show`).
2. In **one** change to the Secret, set `APP_PREVIOUS_KEYS` to the outgoing `APP_KEY` (prepended to
   any existing list) *and* `APP_KEY` to the replacement. Split across two changes, some pod sees
   the new key without the old one and throws on every historical row.
3. Roll **every** decrypting pod class — web, each queue-worker Deployment ([[fleet-queue-doctrine]]
   §4), scheduler, console. A worker deployment missed here is the canonical post-rotation
   `DecryptException` storm.
4. Run the sweep, and verify it reports zero rows remaining per registered class.
5. **Only then** drop the retired key from `APP_PREVIOUS_KEYS`. Until it is dropped it is live key
   material carrying its own leak exposure.

**What rotation does *not* re-encrypt: everything already written.** It changes the key used for
*new* encryptions only. Existing rows keep old-key ciphertext until something rewrites them — as do
queue payloads in flight, encrypted cache/session entries, encrypted cookies, encrypted objects in
storage, and every snapshot predating the rotation. A snapshot is readable only with the key current
when it was written, which is why retired keys outlive the rotation by the backup retention.

**The re-encryption sweep — MUST after a compromise-driven rotation, SHOULD after a routine one.**
A console command that walks the field-class register and, per class, reads and re-saves each
attribute (decrypt via fallback, encrypt with the current key), touching nothing else:

- Chunked by primary key (`chunkById`; recommended default 1,000 rows), therefore resumable, and
  idempotent — a second run is harmless.
- **MUST NOT touch `updated_at`** (`Model::withoutTimestamps()`): rotation is not a domain event,
  and a swept timestamp corrupts every "changed since" consumer and floods the audit trail.
- Observable — rows swept and remaining, per class, as structured output. A sweep whose completion
  you cannot assert cannot gate step 5.
- Queued on the `heavy` partition or run as a console job, never inside a request.
- Cache, session, and cookie material is **not** swept: short-lived by construction, it **MAY**
  simply expire, or be flushed.

**Cadence.** Routine rotation **SHOULD** be at least annual (site-specific; annual is the
recommended default). Rotation **MUST** be immediate on suspected key exposure, and there the
sequence is rotate → sweep → retire promptly rather than at leisure — the same shape as the
overlap-zero compromise procedure in [[webhook-signing-scheme]]. **Rotating `APP_KEY` does not
rotate the secrets it protects:** if a stored provider credential leaked, rotate it *at the
provider* — re-encrypting a compromised value under a fresh key protects nothing.

## §5 Searchable encryption — the ruling

A field that must be both encrypted and queried is a design conflict, not a cryptography problem.
Work top-down; the **first applicable option wins**, and reaching option 3 means showing 1 and 2 do not.

1. **Restructure so the query never touches the secret — SHOULD, and it usually works.** Filter,
   sort, and join on a non-sensitive projection beside the encrypted column: a status or type, a
   tenant id, a coarse bucket, a last-four fragment, a creation window. Most "we must search
   encrypted data" requirements dissolve into "we must find the row by something else we hold."
2. **Don't encrypt what you must query — and compensate.** A field genuinely driving filtering,
   sorting, or joining stays plaintext under layer 1, access control, row-level isolation
   ([[tenant-isolation-rls]]), and audit ([[audit-logging-standard]]) — recorded as an
   **ACCEPTED-DEVIATION** naming those compensating controls per [[security-governance]]. This is
   the honest answer for identifiers the application is built around, and it beats a cryptographic
   construction nobody on the team can reason about.
3. **Blind index — MAY, for exact-match lookup only.** A deterministic
   `hash_hmac('sha256', normalize($plaintext), $blindIndexKey)` in a separate indexed column beside
   the ciphertext, which stays the source of truth. If used, all of: **a separate key from
   `APP_KEY`** (same delivery path) so the two rotate independently; **one normalization function,
   defined once** (case-fold, trim, unicode form) applied on both write and lookup, since a
   mismatch is a silent miss rather than an error; **equality only** — no range, prefix, or
   ordering, and a proposal reaching for prefix buckets is rebuilding an order-revealing scheme by
   hand (§7); **uniqueness constraints on the index**, never the ciphertext (§3); and the equality
   leak accepted knowingly — identical plaintexts share an index value, so frequency and
   distribution are visible to anyone who can read the column. **MUST NOT** blind-index a
   low-cardinality field: across a handful of distinct values the index is effectively plaintext.

## §6 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| `DecryptException` storms right after a config change | `APP_KEY` replaced without `APP_PREVIOUS_KEYS`; a pod class (workers, scheduler, console) rolled without both variables; a database restored into an environment holding a different key | Restore the previous key to the list, roll *every* decrypting workload (§4 step 3), re-run the procedure in order |
| An encrypted field reads back null or empty | A handler catching `DecryptException` and defaulting; the cast added ahead of its backfill, so old rows hold plaintext | Stop swallowing the exception; backfill and cast in one change (§3.1 condition 4) |
| Duplicates despite a unique constraint; `unique:`/`exists:` never matching | Random IV per write — neither the constraint nor the validator can ever match | Move uniqueness to a blind index or a non-secret natural key (§5) |
| "Value too long" / truncation after adding a cast | Column left `varchar(n)`; the envelope is several times the plaintext | Migrate to `text`/`longText`, then backfill truncated rows from source |
| A search or filter broke after a field was encrypted | The cast landed on a queried column without walking §5 | Walk §5 top-down — usually restructure, sometimes ACCEPTED-DEVIATION, rarely a blind index |
| Secret visible in logs or APM despite the cast | Serialization decrypts on access; attribute not `$hidden`; request-body logging capturing the write | `$hidden` + resource/APM/body-log exclusion (§3) |
| Backup restores cleanly but nothing decrypts | The key was never a restore artifact; rotated after the snapshot with the retired key already dropped | Key custody + retired-key retention → [[backup-dr-standard]] |
| Sweep floods the audit trail / breaks "changed since" consumers | Sweep writing `updated_at` | `Model::withoutTimestamps()` (§4) |
| Old ciphertext still decrypts under a key believed retired | `APP_PREVIOUS_KEYS` never trimmed after the sweep | Verify the sweep, then trim (§4 step 5) |
| A store turns up unencrypted | Created out-of-band, not through the reconciled manifest | Recreate encrypted and migrate — encryption is not retrofittable in place (§2) |

## §7 Considered and rejected

- **`pgcrypto` (encrypting in SQL)** — puts key material into statement text, where it reaches
  activity views, slow-query logs, and any statement logging; the system holding the ciphertext
  also handles the key, dissolving the separation that makes layer 2 worth its cost. **Revisit
  trigger:** none foreseeable.
- **Transparent data encryption as an answer to layer 2** — TDE *is* layer 1 under another name: it
  protects the file, and any connected application or credential holder reads plaintext. A fine
  implementation of §2, never a substitute for §3.
- **Order-preserving / order-revealing encryption** for sortable encrypted columns — leaks ordering
  by construction, and published attacks recover large fractions of plaintext from realistic
  distributions. Rejected outright, hand-rolled prefix-bucket approximations included.
- **Truncated blind indexes** (a digest prefix, to blur equality) — the induced collisions force a
  decrypt-and-compare pass anyway, so the cost returns while the guarantee stays fuzzy. Take the
  full digest and accept the equality leak knowingly (§5).
- **External KMS with per-row envelope encryption, and its cousin per-tenant application keys** —
  genuinely better custody (rotation without a sweep, hardware-backed keys) but buys a hard runtime
  dependency plus a network call per decrypt, and multiplies custody by tenant count for a property
  [[tenant-isolation-rls]] already enforces at the row level. **Revisit trigger:** a contractual
  customer-managed-key (BYOK) requirement, or a regime demanding hardware-backed custody.
- **Application-encrypting whole tables** — destroys every query the app makes and leaves a
  key-value blob store with extra steps; that breadth is what layer 1 delivers for a configuration
  flag.
- **Hand-rolled `openssl_*` / `sodium_crypto_*` in application code** — the framework encrypter is
  authenticated, key-managed, and rotation-aware; a bespoke one is none of those on its first
  draft, and its payload format is invisible to the §4 sweep.
- **Encrypting where hashing is correct** (passwords, verification-only tokens) — reversibility is
  a liability wherever it is not a requirement (§3).
