---
title: Tenant Data Isolation & Postgres RLS (v1 — database-per-tenant, row security, the session principal)
description: The normative rule set for who may read a row on every fleet Laravel app — database-per-tenant behind a per-tenant Postgres role as the multi-tenant posture, Postgres row-level security as the database-enforced floor beneath Eloquent scoping in shared-database apps, the ENABLE + FORCE + fail-closed policy shape, how the current principal reaches every connection and is cleared at every boundary, the bypass-role escape hatch, and the pg_catalog schema test that makes an unprotected owned table unmergeable. Owns isolation; retention and erasure are [[data-privacy-doctrine]]'s.
tags: [ spec, standard, security, multi-tenancy, postgres, rls, isolation, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, defense-in-depth-model, security-governance, data-privacy-doctrine, encryption-at-rest-doctrine, audit-logging-standard, file-storage-standard, fleet-queue-doctrine, fleet-testing-doctrine, backup-dr-standard, laravel-runtime-traps ]
---

# Tenant Data Isolation & Postgres RLS — v1

The **requirement of record for who may read a row at all** — the boundary between one customer's
data and another's, and between one organization's data and another's inside a shared database.
Normative language per [[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**.

**Out of scope, by owner.** *What* an app may keep, for how long, and how erasure and subject
requests are answered is [[data-privacy-doctrine]]'s; this page rules only who may reach a row while
it exists. Whether the bytes are encrypted underneath is [[encryption-at-rest-doctrine]]'s — and
encryption is not access control: a secret the wrong principal can `SELECT` is a breach whatever its
encoding. Object-storage key isolation is [[file-storage-standard]] §3; the layer this control sits
on is [[defense-in-depth-model]]'s data row.

## §1 The four laws

1. **Isolation is a property of the database, not a habit of the query builder.** Every
   application-layer boundary — a global scope, a repository, a trait everybody remembers — is one
   `withoutGlobalScopes()`, one `DB::table()`, one raw reporting query away from absent.
2. **The floor is beneath the scoping, never instead of it.** Eloquent scoping stays **mandatory**:
   it makes queries *correct* (counts, aggregates, pagination, authorization by role and sharing).
   Row security makes its failure *non-catastrophic*. Arguing either makes the other unnecessary is
   [[defense-in-depth-model]]'s load-bearing-control tell.
3. **Fail closed.** With no principal established an owner-scoped table returns **zero rows**, never
   all of them: a forgotten middleware surfaces as an empty screen, not another tenant's data.
4. **One template per app, chosen at creation.** An app is *either* database-per-tenant *or*
   shared-database-with-row-security. Retrofitting isolation onto a shared database that grew
   without it is a migration of every table, every query, and every backfill at once.

## §2 Choosing the template

- **Database-per-tenant (multi-tenant template) — SHOULD** where tenants are *contractual
  boundaries*: separate customer organizations whose data never legitimately mixes. Signals — a
  plausible per-tenant restore, export, or "delete us entirely" clause; data residency; a
  noisy-neighbour blast radius somebody will ask about; a bounded, provisioned tenant count.
- **Shared database with row security (single-tenant template) — SHOULD** where "tenants" are
  organizations *inside one product*: users who may belong to several, cross-org features (shared
  catalogs, cross-org search, aggregate analytics), self-serve signup at unbounded cardinality.
- **The costs, so the choice is honest.** Per-tenant databases pay migration fan-out across N
  databases, pool pressure proportional to tenant count, a provisioning step in signup, schema-drift
  risk, and cross-tenant reporting that must fan out. Shared-with-RLS pays a permanent correctness
  tax — every owned table needs the column, a policy, and an index — plus coarser recovery:
  restoring one org means extracting rows, not restoring a database.
- **MUST NOT mix the models.** A shared database with per-tenant *connection strings*, or per-tenant
  databases treating an `org_id` policy as their primary boundary, buys both cost structures and
  neither guarantee. Inside a tenant database, separating that tenant's *own* users is
  authorization, not isolation — unless it carries a second ownership dimension, and then §4 applies.

## §3 Database-per-tenant — the multi-tenant posture

The fleet's existing posture, hereby the standard. The guarantee is that the connection cannot
address another tenant's data **at all**, so §4's forgotten-scope bug class cannot exist *between*
tenants — no query, scoped or unscoped, raw or hand-typed into `psql`, crosses the line.

- **One database and one Postgres role per tenant — MUST**, holding `CONNECT` on exactly its own
  database plus the DML grants inside it, and nothing anywhere else.
- **`REVOKE CONNECT ON DATABASE <db> FROM PUBLIC` — MUST**, at provisioning, on the central database
  and every tenant database: without it the default `PUBLIC` grant lets every role in the cluster
  connect and the per-tenant role is decoration. `REVOKE ALL ON SCHEMA public FROM PUBLIC` rides
  along in the same step.
- **The central (landlord) role MUST NOT reach tenant databases**, nor a tenant role the central one.
  Cross-plane work fans out over tenant connections deliberately, never through one credential that
  reaches everything. Tenant connection credentials are themselves stored crown jewels —
  [[encryption-at-rest-doctrine]] §3.1's first field class.
- **Per-tenant restore and erasure are the payoff:** one database restores independently, and
  dropping it *is* erasure with no row-hunt across shared tables. Mechanics →
  [[backup-dr-standard]]; obligation → [[data-privacy-doctrine]].
- **Maintenance runs per tenant, through the tenancy runner — MUST.** A plainly wired scheduler entry
  executes once against the central connection and silently touches no tenant database — the trap in
  [[laravel-runtime-traps]], whose audit-shaped instance is [[audit-logging-standard]] §7.
- **Row security is not required inside a tenant database**, and **MUST NOT** be adopted there as a
  substitute for the database boundary.

## §4 Row-level security — the shared-database floor

The threat is a **bug class, not an attacker**: the query that forgot `->where('org_id', …)` — a
report builder, a `DB::table()` join, a `withoutGlobalScopes()` added to fix an admin screen. Each is
a plausible patch that passes review and returns other organizations' rows; row security means the
database refuses regardless. **The limit, stated plainly:** the principal lives in a session setting
any statement can change, so this is a floor beneath *application bugs*, not a defense against an
attacker executing arbitrary SQL — that is parameter binding's job, at [[defense-in-depth-model]]'s
application-runtime layer.

- **`ENABLE` and `FORCE`, always both — MUST.** `ENABLE ROW LEVEL SECURITY` activates policies; **the
  table owner still bypasses them** until `FORCE ROW LEVEL SECURITY` is also set, so an app
  connecting with the credentials that ran its migrations has RLS "enabled" and entirely inert.
  `FORCE` stays mandatory even under §5's two-role posture where it is redundant: it is the control
  that survives a later deployment collapsing the roles back into one. Superusers and `BYPASSRLS`
  roles are unaffected by either — the runtime role **MUST NOT** be or hold one.
- **No policy means no rows.** RLS enabled with no applicable policy denies everything to non-bypass
  roles, and that default is the wanted one: a policy accidentally dropped breaks the app loudly
  instead of opening it quietly.
- **The canonical declaration** — one `STABLE` helper defining the principal, and a `FOR ALL` policy
  with both clauses, declared to `PUBLIC` (omit `TO`) so it binds every non-bypass role:

  ```sql
  CREATE FUNCTION app_current_org_id() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('app.current_org_id', true), '')::uuid $$;
  ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
  ALTER TABLE invoices FORCE  ROW LEVEL SECURITY;
  CREATE POLICY org_isolation ON invoices FOR ALL
    USING (org_id = app_current_org_id()) WITH CHECK (org_id = app_current_org_id());
  ```

- **`USING` filters, `WITH CHECK` refuses — declare both.** `USING` decides which existing rows
  `SELECT`/`UPDATE`/`DELETE` may see, **silently**; `WITH CHECK` decides which rows `INSERT`/`UPDATE`
  may produce, and **raises**. A `USING`-only policy lets the app write a row stamped with another
  org's id and then lose it, and lets an update *move* a row across the boundary.
- **The predicate is NULL-safe by construction:** `current_setting(name, true)` returns `NULL` rather
  than erroring when unset, `nullif(…, '')` covers reset-to-empty, and `org_id = NULL` is `NULL` —
  not `true` — so an unestablished principal sees nothing. **MUST NOT** write the convenience form
  (`current_setting(…) IS NULL OR org_id = …`): it turns one forgotten middleware into a full-table
  exposure, the exact failure being engineered out.
- **Cross-boundary *references* are not caught by policies.** Referential-integrity checks — foreign
  keys, unique and primary key constraints — bypass row security by design, so a child row can point
  at another org's parent and a unique violation can reveal another org's row exists. Where a
  relationship must not cross, **SHOULD** carry the ownership column into a composite foreign key
  (`FOREIGN KEY (org_id, invoice_id) REFERENCES invoices (org_id, id)`, over a unique index on
  `(org_id, id)`) and let the constraint enforce it.
- **Views launder RLS** — a view executes with its owner's privileges, so one owned by a
  bypass-capable role exposes everything through it: views over owner-scoped tables **MUST** be
  `security_invoker`, or not exist. **Partitioned tables** declare `ENABLE`/`FORCE` and the policy on
  the **parent**, which governs access routed through it; a partition queried directly is governed
  only by its own.

## §5 The current principal — roles, setting it, clearing it

- **Two roles, one privilege boundary — MUST.** `__APP___migrator` owns the schema, runs migrations
  (`--database=pgsql_migrator`), holds `BYPASSRLS` — backfills, `pg_dump`, and partition maintenance
  all need it — and is used for nothing else; `__APP___runtime` serves traffic, workers, and the
  scheduler as a non-owner with DML grants only. `ALTER DEFAULT PRIVILEGES … GRANT SELECT, INSERT,
  UPDATE, DELETE ON TABLES TO __APP___runtime` (plus `USAGE ON SEQUENCES`) is part of provisioning;
  without it every migration ships a table the app cannot touch.
- **Set the value with `set_config`, bound as a parameter — MUST:** `SET` takes no bind parameters,
  so the principal would have to be interpolated into statement text, while
  `SELECT set_config('app.current_org_id', ?, false)` binds it. Custom names **MUST** be dotted.
- **Session scope is the default; transaction scope is for poolers.** That third argument is
  `is_local` — `false` for the session, `true` for the current transaction. Session scope is the
  fleet default because the runtime is classic-mode FrankenPHP with a per-request lifecycle, and
  `SET LOCAL`/`set_config(…, true)` **outside** a transaction block is a warning and a no-op. An app
  behind a **transaction-pooling** proxy **MUST** move to transaction scope (the pooler can hand a
  session variable to the next principal's request) or run session pooling; anything else is an
  ACCEPTED-DEVIATION naming the pooler.
- **Every connection, not every request — MUST.** Laravel opens separate PDO connections for
  read/write splits, reconnects transparently, and may resolve further named connections
  mid-request; each starts with no principal. Hold it in a request/job-scoped context object and
  apply it from a listener on `Illuminate\Database\Events\ConnectionEstablished`, so replicas and
  reconnects are stamped too. Stamping only the default connection is the source of "works locally,
  empty in production".
- **Established after authentication, cleared in `finally` — MUST.** HTTP: middleware ordered after
  the auth middleware resolves the principal from the session or token — **never** from request
  input — and clears it on the way out. Queue: **job middleware** restores it from the job's own
  payload per [[fleet-queue-doctrine]] §3, because a worker is a long-lived process holding one
  connection across many jobs, so a handler inferring "the current org" from process state reads the
  previous job's. Console commands and per-tenant runners do the same; law 3 is what makes a missed
  clear an empty result rather than a leak.
- **Stamp the ownership column from context, never from input — MUST.** A client-supplied org id that
  happens to satisfy the policy is still a client choosing its own boundary.

## §6 Eloquent integration, the escape hatch, and cost

- **The criterion — MUST:** *every table whose rows belong to exactly one principal carries the
  ownership column and a policy.* One column name is chosen fleet-wide per app (`org_id` here); §7
  keys off it. A table owned only transitively (line items reachable via their invoice) **MUST
  denormalize the column** rather than take an `EXISTS (…)` policy — a subquery predicate is
  evaluated per row and gives up the index. The column is stamped at write and immutable after.
- **Exempt tables are an explicit list, not an absence:** genuinely global tables — plans, reference
  data, framework tables (`migrations`, `jobs`, `failed_jobs`, `cache`, `sessions`) — enumerated in
  an allow-list the §7 test reads. Declaration is a schema macro invoked in the creating migration
  (`Schema::enableRowLevelSecurity('invoices')`, registered once, emitting the §4 block), so there is
  one place to fix a predicate and no chance of a policy that differs by a word.
- **The escape hatch is a role, never a flag — MUST.** Genuinely cross-org work (a central admin
  panel, an operator console, a reconciliation job) goes through a **third connection** on a
  `BYPASSRLS` role, selected explicitly per query (`Model::on('pgsql_bypass')`). It **MUST NOT** be
  the default connection, and the bypass **MUST NOT** be a session flag consulted by a permissive
  policy — a flag any statement can set makes the escape hatch the exploit. Every use is an audited
  administrative action ([[audit-logging-standard]]).
- **Cost is an index filter and only that — if the index exists.** `app_current_org_id()` is
  `STABLE`, so the planner evaluates it once per statement and compares against a constant; every
  RLS-covered table therefore **MUST** carry an index leading with the ownership column, usually
  composite with whatever the app filters on next. A `VOLATILE` helper is re-evaluated per row and
  defeats the index. **EXPLAIN the hot paths after adoption — SHOULD:** policy predicates are
  evaluated ahead of query predicates calling non-leakproof functions, which can block a pushdown the
  planner used to make, and a regression there is a plan change, not a constant factor.

## §7 Enforcement — the schema test and the isolation tests

- **The schema test — MUST**, in the architecture suite per [[fleet-testing-doctrine]] §7, asking
  `pg_catalog` rather than trusting the migrations: for every relation in `pg_class` (`relkind` `r`
  or `p`) whose `pg_attribute` rows include the ownership column, assert `relrowsecurity`,
  `relforcerowsecurity`, and at least one `pg_policy` row. The **inverse assertion catches the
  drift** — every table *without* the column must appear in the exempt allow-list, so a new owned
  table cannot merge with neither a policy nor a deliberate exemption.
- **A suite running as the owner proves nothing.** Migrations need the migrator role, so tests
  connect on **both**: arrangement (migrations, factories, seeders spanning several orgs) on the
  privileged connection, act-and-assert on the runtime role. Without that split every RLS test
  passes vacuously.
- **The active-RLS canary — MUST.** One test seeds rows, establishes **no** principal, and asserts
  the runtime connection reads zero. If it ever passes with rows the suite is theater and every
  isolation test under it is meaningless.
- **The forgotten-scope test — MUST**, one per app: seed two orgs, establish org A, run the
  deliberately unscoped query (`Invoice::query()->get()`, or its raw-builder equivalent), assert
  every returned row belongs to A. It documents the guarantee, and belongs beside the policy rather
  than in a security folder nobody opens.
- **The write-side test — MUST:** inserting or updating a row toward another org raises (`new row
  violates row-level security policy`). A `USING`-only policy passes the read tests and fails this
  one, which is the point.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Cross-tenant rows despite "RLS enabled" | App connects as table owner and `FORCE` was never set; runtime role holds `BYPASSRLS`; app runs as superuser | `ENABLE` **and** `FORCE` (§4); split migrator/runtime roles (§5); check role attributes |
| Zero rows in production, fine locally | Principal never applied to *this* connection — read replica, post-reconnect, another named connection, middleware ordered before auth | `ConnectionEstablished` listener (§5); confirm with `SELECT current_setting('app.current_org_id', true)` |
| `new row violates row-level security policy` | Row stamped with an org id other than the established principal; principal set after the write | Stamp from context, establish before the write (§5) |
| A job touches the wrong org's data | Principal inferred from process state on a long-lived worker instead of the payload; previous job's value never cleared | Job middleware sets from payload, clears in `finally` ([[fleet-queue-doctrine]] §3) |
| Whole suite green, production leaks | Tests run as owner or superuser, so policies are inert | Runtime-role connection for act/assert, plus the active-RLS canary (§7) |
| A hot query regressed after adopting policies | No index leading with the ownership column; `VOLATILE` helper re-evaluated per row; `EXISTS(…)` policy on a transitively-owned table | Composite index; mark the helper `STABLE`; denormalize the column (§6) |
| `pg_dump` errors, or silently dumps a subset | `row_security = off` is its default and errors when policies would filter; `--enable-row-security` dumps only visible rows | Dump on the `BYPASSRLS` migrator role (§5) |
| A reporting view still shows everything | The view executes as its owner, laundering RLS | `security_invoker`, or delete the view (§4) |
| Cross-tenant maintenance quietly no-ops (MT) | Scheduler entry wired against the central connection | Run it through the tenancy runner (§3, [[laravel-runtime-traps]]) |

## §9 Considered and rejected

- **Application-layer scoping as the only control** (a global scope, a tenant trait, a repository
  layer) — the premise of this page. Retained as the mandatory first layer (§1 law 2), rejected as
  the boundary. **Row security instead of Eloquent scoping** is the inverse error: policies filter
  *silently*, so a missing scope turns aggregates and pagination into quietly wrong answers; they
  cannot express role, permission, or sharing rules; and the bypass connection sits outside them.
- **Schema-per-tenant in one database** — cheaper provisioning, and `search_path` switching is one
  statement. Rejected: the same migration fan-out, worse dump/restore granularity, and a leak surface
  whose failure mode is *writing into the wrong tenant* rather than reading nothing. **Revisit
  trigger:** a tenant count where per-database connection overhead genuinely dominates.
- **RLS keyed on `current_user`** (a Postgres role per organization, `USING (org_id::text =
  current_user)`) — strictly stronger, since the principal cannot then be forged by SQL. Rejected for
  shared-database apps: a role per org and a connection per role destroys connection reuse at exactly
  the cardinality that made the shared template attractive. **Revisit trigger:** a small, bounded set
  of high-assurance organizations.
- **Per-tenant application encryption keys as isolation** — rejected on custody grounds in
  [[encryption-at-rest-doctrine]] §7, noted here because it is repeatedly proposed *as* isolation. It
  protects bytes at rest, never who may `SELECT`.
- **Running both models to "get both"** — pays both cost structures, and the intermediate state is a
  system where neither boundary is trusted. Choose at creation (§2).
