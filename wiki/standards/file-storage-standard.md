---
title: File Storage & Uploads Standard (v1 — disks, keys, ingest, egress, lifecycle)
description: The normative rule set for user files in every fleet Laravel app — the Storage facade over an S3-compatible backend as the only sanctioned persistence path, named disks and UUID key conventions, tenant prefixing, content-derived upload validation and the presigned-vs-through-the-app ruling, the two sanctioned exposure paths (app-mediated stream, or a custom domain masking the origin) and their trade-off, the malware-scanning stance, and orphan/temp lifecycle. Owns everything file-shaped; pod posture stays with [[fleet-app-specification]], bucket SSE with [[encryption-at-rest-doctrine]].
tags: [ spec, standard, storage, uploads, files, s3, flysystem, mandate, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-api-specification, fleet-queue-doctrine, defense-in-depth-model, encryption-at-rest-doctrine, backup-dr-standard, data-privacy-doctrine, tenant-isolation-rls, fleet-testing-doctrine ]
---

# File Storage & Uploads Standard — v1

The **requirement of record for user files** — anything a person uploads, an app generates for a
person to retrieve, or a job writes for later reading. Written against Laravel 13's `Storage` facade
over Flysystem on PHP 8.5, in `readOnlyRootFilesystem` pods per [[fleet-app-specification]], whose
normative language it uses: **MUST / MUST NOT / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations
recorded there, never silent. **Out of scope:** edge caching of *public build assets*, owned by the
edge-cache bundle. This page governs *user files*, private by default.

## §1 The five laws

1. **The Storage facade over an S3-compatible API, always.** Every read and write goes through
   `Storage::disk(<named>)` against an S3-compatible backend (MinIO/R2/S3-class) regardless of who
   runs it. `file_put_contents`, `fopen` on a `storage_path()` and vendor SDK calls are forbidden.
2. **The storage source is never publicly reachable.** No public buckets, no public ACLs, no
   anonymous listing, no `public` disk. Ever. An unguessable URL is not authorization.
3. **Bytes are exposed through exactly two sanctioned paths** (§5): an application endpoint that
   authorizes, translates and streams, or a custom domain masking the origin. There is no third.
4. **The database row is the source of truth; the object is a consequence.** Every object has a row
   (disk, key, size, sniffed type, checksum, owner, scan state). No row = garbage to sweep (§7);
   no object = data loss to alert on.
5. **The pod cannot write to itself.** Production pods run `readOnlyRootFilesystem` with a writable
   `/tmp` `emptyDir` only, and that scratch is **per-pod and ephemeral** — never a handoff between
   a web pod and a worker pod.

## §2 Disks, configuration, and local parity

- **Named disks per purpose — MUST.** A disk per *retention and policy class*, never one generic
  `s3`: `uploads` (user-submitted), `documents` (long-retention), `exports` (generated,
  short-lived), `incoming` (unconfirmed direct uploads, §4). Lifecycle, scan requirements and
  erasure differ per class; one shared disk makes each a per-callsite decision.
- **Wired env → config — MUST.** `config/filesystems.php` reads env; code reads
  `config()`/`Storage::disk('uploads')` and **never** `env()` outside config (the `config:cache`
  trap, [[fleet-app-specification]] §5). A disk name **MUST NOT** come from request input.
- **The `local` and `public` drivers are FORBIDDEN in production** — law 5 makes them silently broken
  (writes hit a read-only layer or scratch the next pod lacks) and law 2 makes `public` wrong on
  principle. `storage:link` has no place in a fleet image.
- **Bucket naming — SHOULD** follow `<org>-<app>-<env>-<purpose>`, e.g. `acme-__APP__-prod-uploads`;
  one bucket per env, never shared, because a staging job reconciling (§7) against a production
  bucket deletes production files.
- **Endpoint compatibility — MUST:** set `use_path_style_endpoint` where the backend requires it
  (self-hosted MinIO-class does, vhost-style providers do not), plus region and endpoint from env —
  guessing it is the commonest cause of a `403` that looks like a credentials problem.
- **No hardcoded URLs — MUST.** Object URLs come from `temporaryUrl()`, a named route, or a
  configured base (`config('filesystems.disks.uploads.url')`); a bucket host, prefix or CDN hostname
  concatenated into a controller, Blade template or TSX component hardcodes today's infrastructure
  into the product. **Credentials** come from the secret store, scoped per bucket/prefix and
  rotatable ([[defense-in-depth-model]]) — one cluster-wide key defeats §3's isolation entirely.
- **Local parity — SHOULD:** Sail (and CI, where integration tests need a real backend) runs an
  S3-compatible container so dev exercises the production driver, key conventions and endpoint style;
  falling back to `local` hides a class of prod-only failure. `Storage::fake()` is a **Feature-suite
  tool** ([[fleet-testing-doctrine]] §5), not a substitute for bootless unit tests of key/type/disk.
- **Encryption at rest** (bucket SSE, key custody) is owned by [[encryption-at-rest-doctrine]];
  **backup, versioning and restore drills** by [[backup-dr-standard]]. Neither is restated here —
  this page requires only that a new disk be enrolled in both before it holds real data.

## §3 Keys, paths, and tenant isolation

- **Keys are server-generated, opaque and stable — MUST.** A key is a **UUID** (UUIDv7 preferred,
  matching [[fleet-api-specification]]'s public-identifier rule), optionally suffixed with an
  extension derived from the **sniffed** type (§4). It is never parsed for meaning, never renamed in
  place (copy + new row + delete), and never the file's public identifier — the API exposes the
  row's UUID. The original filename is a **column on the row**, returned in `Content-Disposition` at
  download, and MAY ride as object metadata.
- **A user-supplied filename MUST NOT reach the key** — traversal (`../`), null bytes, unicode
  normalization, cross-backend case collision and length limits are all live hazards, and "sanitize
  the filename" is a losing game against a fixed alphabet you could have controlled instead.
- **Tenant prefixing is the default isolation:** `t/<tenant-uuid>/<purpose>/<uuid>` — one bucket,
  one prefix per tenant, taken **from the resolved tenant context, never from request input**. It
  composes with [[tenant-isolation-rls]] and keeps credentials, lifecycle rules and reconciliation
  single-instance.
- **The prefix is a blast-radius reducer, not the authorization boundary.** Authorization is the
  policy check on the owning model (§5); a correct prefix on an unauthorized read is still a
  breach. The prefix is what makes a scoped credential and an audit query possible.
- **Escalate to bucket-per-tenant — MAY**, only for a named reason: per-tenant data residency, a key
  or credential the tenant controls, a contractual "export/delete my whole bucket" clause, or
  retention that lifecycle rules cannot express by prefix. Escalation is an ACCEPTED-DEVIATION —
  it buys isolation with bucket-count sprawl, provider quotas, per-bucket config drift and a
  provisioning step in signup.

## §4 Ingest — validation and the two upload paths

- **Validation is content-derived — MUST.** The allowed type is decided by **sniffing the bytes**
  (`mimetypes:` rules, or a `finfo` check in the action). `getClientMimeType()` and the extension in
  `getClientOriginalName()` are attacker-controlled strings and **MUST NOT** be the validation
  input. The sniffed value is persisted on the row and pinned as the object's `ContentType` at
  write time, never inferred later.
- **Allow-list per upload context — MUST.** Each surface declares its own permitted types and size
  cap in config (avatar ≠ import CSV ≠ support attachment); a deny-list is forbidden, and one
  fleet-wide constant is nearly as bad — it grants every surface the union of everyone's needs.
  **Size caps are enforced twice:** in the FormRequest *and* at the boundary that protects the
  process (edge body limit, `upload_max_filesize`) — a cap enforced only in PHP means the pod
  buffered the bytes before saying no.
- **Images destined for re-display MUST be re-encoded**, not stored as received: re-encoding strips
  EXIF (including GPS) and destroys polyglots whose bytes are simultaneously a valid image and a
  valid script. **SVG is an HTML document**, not an image — accept it only where genuinely required,
  sanitize it, and serve it only as an attachment or from an isolated origin. Never inline user SVG.
- **Through-the-app upload is the DEFAULT.** FormRequest → action validates → `put()` → row created
  in the same transaction, object write last before commit. Buffers land in the writable `/tmp`
  `emptyDir` (PHP's temp dir MUST point there — law 5); the file MUST be streamed, never slurped.
- **Presigned direct-to-bucket upload is the sanctioned exception — MAY**, for large media, very
  large imports, or any surface where occupying a PHP worker for the transfer is the real
  bottleneck. Allowed only with all five conditions: (1) **the server mints the key and policy** —
  the client never chooses key, prefix or bucket, and the presigned request constrains
  `content-length-range` and content type; (2) **short TTL**, minutes, single-use in intent;
  (3) **uploads land on `incoming`**, quarantine rather than storage; (4) **a confirm endpoint is
  mandatory** — the client calls it, the server `HEAD`s the object, verifies real size and sniffed
  type, then promotes it and creates the row, and nothing in `incoming` is ever served;
  (5) **unconfirmed objects expire** (§7) — a crashing client must not leak storage forever.
- **Post-processing is queue work:** derivatives, thumbnails, text extraction, scanning and import
  parsing dispatch to `heavy` per [[fleet-queue-doctrine]] §2. Jobs carry the **row id**, never the
  bytes and never a `/tmp` path (law 5); handlers are idempotent because they will run twice.
- **Wire detail** — endpoint shapes, status codes, the `202` + status-pointer convention for queued
  processing, error bodies — is owned by [[fleet-api-specification]].

## §5 Egress — the two sanctioned exposure paths

Both keep law 2 intact. They differ in where authorization happens and what it costs.

**(a) Application endpoint — the DEFAULT.** A route authorizes the viewer against the owning model
*before touching bytes* — never on possession of a key or prefix, and `404` not `403` for a file
the viewer may not know exists — then streams via `Storage::disk(...)->response()`/`->download()`,
or redirects to a `temporaryUrl()` once authorization has passed. The app pins `Content-Type` from
the stored sniffed value, sets `Content-Disposition` with the original filename, and inherits
`X-Content-Type-Options: nosniff` from the headers in [[fleet-app-specification]] §5.

- **Signed app URLs** (`URL::temporarySignedRoute`) are how an unauthenticated viewer — an email
  recipient, a one-time share — reaches path (a). They point at **the app endpoint**, never the
  origin, so revocation, expiry and audit all stay the app's.
- **Streaming — MUST:** never `get()` an object into a string to return it. For media needing
  **seeking**, do not reimplement byte ranges in PHP — that file belongs on path (b) or a
  post-authorization `temporaryUrl()` redirect, which get ranges from the backend for free.
- **Cost:** every byte flows through the app — bandwidth, worker occupancy, pod scaling.

**(b) Custom domain masking the origin — the scale path.** A dedicated hostname (`files.<host>`)
fronted by Cloudflare, origin-restricted so only the edge reaches the bucket; authorization rides on
short-lived signed URLs the app issues and the edge enforces, and the origin still refuses anonymous
requests. Choose it when **egress volume, CDN caching or range/seek** decides.

- **Accept what you give up, explicitly:** authorization collapses to URL-possession for the token's
  lifetime, revocation becomes TTL-shaped rather than immediate, and per-view access is invisible to
  the app's audit log. Files whose access must be *recorded* or *revoked on the spot* stay on (a).
- **Signed URLs MUST NOT be embedded in cached HTML, emails, or anything outliving the token** — the
  "link worked yesterday" defect, and its inverse: a link that outlives the recipient's access.

**Both paths — MUST NOT** serve user content from the application's own origin in a way that lets it
execute as first-party script: distinct hostname (b), or forced attachment disposition (a).

## §6 Malware scanning

- **SHOULD scan any file a second person can retrieve** — shared across users, tenants, or out to a
  support/agent surface — with a ClamAV-class scanner dispatched to `heavy`. The row carries a scan
  state starting at *pending*, files stay quarantined until they pass, and **downloads MUST refuse
  anything not clean**.
- **MAY skip scanning for private single-user files** only the uploader can retrieve — the scanner
  is not protecting that user from their own bytes, and the cost is real.
- **MUST NOT treat scanning as the control that makes serving user content safe.** Content-type
  pinning, re-encoding (§4), a non-public origin (law 2) and origin/disposition separation (§5) are
  what hold; the scanner is one more layer per [[defense-in-depth-model]], not the load-bearing one.

## §7 Lifecycle — orphans, expiry, erasure

- **Deletion is a domain action — MUST:** the row is deleted (or soft-deleted) inside the
  transaction; the object delete is dispatched **after commit** ([[fleet-queue-doctrine]] §2).
  Deleting bytes inline in a transaction that rolls back is unrecoverable data loss.
- **A scheduled reconciliation sweep — MUST** (weekly is a reasonable default): list objects under
  the app's prefixes, join against rows, then (1) **delete objects with no row older than a grace
  window** — which stops the sweep racing an in-flight upload — and (2) **alert on rows with no
  object**, never auto-heal them: that direction is data loss, answered by a restore
  ([[backup-dr-standard]]).
- **Temp and unconfirmed uploads expire — MUST:** a bucket lifecycle rule on `incoming` (hours, not
  days), plus an app-side sweep for backends without lifecycle support. `exports` expires the same
  way — a generated report is a cache, not a record.
- **Retention and erasure** — how long a class of file is kept, and what "delete my data" must do to
  objects, backups and derivatives — is owned by [[data-privacy-doctrine]]. This page requires only
  that erasure be *possible*: law 4's mapping and §3's prefix make it a query, not archaeology.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Uploads 500 in prod, work locally | Disk defaulting to `local`; PHP temp dir on the read-only layer | Point the disk at a named S3 disk (§2); point `upload_tmp_dir`/`sys_temp_dir` at the writable `/tmp` `emptyDir` |
| Download saves as `.txt`, or renders as HTML | `ContentType` never pinned at write, backend inferring; missing `Content-Disposition` | Persist the sniffed type and set it on write (§4); set disposition + filename at the endpoint (§5) |
| Works in the web pod, fails in the worker | A `/tmp` path passed through the queue payload | Pass the row id; re-read from the disk in the handler (law 5) |
| `403` from `temporaryUrl()` / on every call | `use_path_style_endpoint` wrong for the backend; wrong region/endpoint; clock skew; rotated or over-scoped key | Fix endpoint style first (§2), then credential scope |
| Model deleted, bytes remain | Deletion not modeled as a domain action | Delete-after-commit job; the reconciliation sweep catches the backlog (§7) |
| Row exists, object missing | Aggressive lifecycle rule on a durable prefix; a sweep pointed at another env's bucket | Alert, never auto-delete the row — restore per [[backup-dr-standard]]; audit lifecycle rules and env→bucket wiring |
| Presigned upload "succeeded", file never appears | Client never called the confirm endpoint | Confirm is mandatory (§4); `incoming` expiry cleans the leak |
| Large uploads time out at the edge | Through-the-app path used where direct-to-bucket was needed | Move that surface to presigned upload with its five conditions (§4) |
| Pod OOM on download | `get()` into a string instead of streaming | `response()`/`readStream()`; range-needing media goes to §5 path (b) |

## §9 Considered and rejected

- **Public buckets / the `public` disk / `storage:link`** — incompatible with
  `readOnlyRootFilesystem`, unrecoverable once a key leaks, and it forecloses every later
  authorization change. "Unguessable URL" is obscurity booked as a control.
- **Files in the database** (`bytea`/BLOB columns) — inflates the row store, poisons every backup and
  replica, turns streaming into a memory problem. The row references the object, never contains it.
- **A shared network volume (RWX PVC) mounted into pods** — stateful pods, node affinity and a
  second backup regime, against the pod baseline in [[fleet-app-specification]]. Object storage is
  what makes the pods disposable.
- **Bucket-per-tenant as the default** — unbounded bucket count against provider quotas, per-bucket
  config drift, and no cross-tenant operation (including §7's sweep) without fanning out. Kept as a
  deliberate escalation with a named reason (§3).
- **Client-declared MIME type or extension as validation input**, and **user-supplied filenames as
  storage keys** — attacker-controlled; traversal, collision, encoding and case-folding hazards.
- **Vendor-proprietary storage features beyond the S3-compatible API** — that compatible surface is
  the portability contract; reaching past it needs an ACCEPTED-DEVIATION.
- **On-the-fly image transformation in the request path** — CPU amplification on a thinly-authorized
  surface; derivatives are generated once, on `heavy`, and stored.
