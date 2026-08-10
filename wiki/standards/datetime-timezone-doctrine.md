---
title: Date, Time & Timezone Doctrine (v1 — storing, computing, scheduling, rendering)
description: The normative rule set for every datetime value in a fleet app — Postgres `timestamptz` on every column behind a Blueprint macro with a schema-conformance guard, UTC-only backend math on `CarbonImmutable`, IANA zone names (never numeric offsets) for wall-time values and future user-scheduled events, and localization confined to the rendered UI. Owns everything time-shaped; [[fleet-api-specification]] API-404 keeps the JSON wire format and this page points at it.
tags: [ spec, standard, datetime, timezone, utc, carbon, postgres, dst, mandate, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-api-specification, fleet-frontend-specification, fleet-testing-doctrine, php-language-doctrine, testing-antipattern-catalog, laravel-runtime-guardrails, fleet-local-gate, audit-logging-standard, backup-dr-standard ]
---

# Date, Time & Timezone Doctrine — v1

The **requirement of record for datetime values** on every fleet app: what the column type is, what
the backend computes in, how a future appointment survives a DST transition, and where a human
finally sees a local time. Written against Laravel 13 / PHP 8.5 / Postgres / Carbon 3. Normative
language per [[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations
recorded there, never silent. **Out of scope — one fact, one owner:** the JSON wire format is
[[fleet-api-specification]] API-404 (RFC 3339 UTC, `Z`, fixed microsecond precision, pinned on the
base model's `serializeDate()`); this page points there and never restates it.

## §1 The four laws

1. **The database is UTC. Every field, every table.** There is no "this one column is local".
   Storage is an instant, and an instant has no timezone.
2. **All backend math happens in UTC.** Comparison, sorting, ranges, differences, index scans.
   A zone conversion in the domain layer is a defect.
3. **A zone is a name, never a number.** `America/New_York`, not `-05:00` and not `EST`. Offsets
   shift twice a year and the shift dates themselves change by legislation; only the IANA name
   survives that.
4. **Localization is presentation.** The only code that knows a user's zone is the code that
   renders a string for a human. Machines get UTC and localize themselves.

## §2 Storage — `timestamptz` everywhere

- **Column type — MUST:** every instant column is `timestamptz` (`timestamp with time zone`,
  microsecond precision). Postgres normalizes to UTC on write and stores no zone — the type name is
  a misnomer that has fooled a generation of engineers. `timestamp without time zone` is **banned**
  for instants; `timetz` (`time with time zone`) is **banned outright** — Postgres itself
  discourages it, and an offset with no date attached has no DST context to resolve against.
- **The macro — MUST:** columns are declared through a `Blueprint` macro, never the stock helpers,
  so "is this column UTC?" is answered by grep instead of by review:

  ```php
  // AppServiceProvider::configureDefaults() — the byte-identical fleet provider (spec §5)
  Blueprint::macro('utcTimestamp', fn (string $c, int $p = 6) => $this->timestampTz($c, $p));
  Blueprint::macro('utcTimestamps', fn (int $p = 6) => collect(['created_at', 'updated_at'])->each(fn ($c) => $this->utcTimestamp($c, $p)->nullable()));
  Blueprint::macro('utcSoftDeletes', fn (string $c = 'deleted_at', int $p = 6) => $this->utcTimestamp($c, $p)->nullable());
  ```

  Three names, one vocabulary. `$table->timestamp()`, `->dateTime()`, `->timestamps()`, and
  `->softDeletes()` are **MUST NOT** in `database/migrations/`. A missing macro throws
  `BadMethodCallException` at migrate time — loud, which is why registration belongs in the locked
  provider rather than a per-app one *(adding the row is a [[fleet-app-specification]] §5 change,
  not a per-app edit)*. Precision 6 is what makes API-404's fixed `.u` serialization truthful.
- **Enforcement — MUST, two layers:**
  1. **Pre-commit grep** in the local gate ([[fleet-local-gate]]): the banned helpers in
     `database/migrations/`. Cheap, instant, catches the typo before it is history.
  2. **A schema-conformance test** — one Feature test that introspects the migrated schema and
     fails on any non-conforming column. This is a **recorded exception** to
     [[fleet-testing-doctrine]]'s bootless-first posture: `arch()` inspects PHP symbols and cannot
     see which method a migration closure called, so the assertion has to run against real DDL.

     ```php
     expect(DB::table('information_schema.columns')->where('table_schema', 'public')
         ->whereIn('data_type', ['timestamp without time zone', 'time with time zone'])
         ->whereNotIn('table_name', VENDOR_OWNED)   // each entry carries a one-line reason
         ->pluck('column_name', 'table_name'))->toBeEmpty();
     ```

     Framework tables published into `database/migrations/` (jobs, cache, sessions) are **converted
     like any other**; only unpublished, vendor-owned package migrations may sit in `VENDOR_OWNED`.
- **Session and process pinning — MUST, three layers:** container/pod `TZ=UTC`;
  `config('app.timezone') === 'UTC'`; `'timezone' => 'UTC'` on the pgsql connection so the session
  issues `SET TIME ZONE 'UTC'`. The cluster's `timezone` GUC is UTC too, so an operator's ad-hoc
  `psql` reads the wall clock the app wrote. Each layer alone is a convention; together they are a
  floor. **MUST NOT** call `date_default_timezone_set()` at request scope — see §9.
- **Casts — MUST:** every datetime attribute is declared in `casts()` as `immutable_datetime`
  explicitly, even though `Date::use(CarbonImmutable::class)` already makes the plain `datetime`
  cast return an immutable. Explicit beats ambient: static analysis infers the real type, and a
  reader sees the immutability without knowing a boot-time global.

## §3 Compute — UTC in, UTC out

- **`CarbonImmutable` for every datetime value — MUST.** `Date::use(CarbonImmutable::class)` is a
  boot guardrail owned by [[fleet-app-specification]] §5 and catalogued in
  [[laravel-runtime-guardrails]]. This page adds the enforcement: an **arch rule** —
  `arch('datetime values are immutable')->expect('App')->not->toUse('Carbon\Carbon')` — because a
  mutable Carbon is an aliasing bug waiting for a `$start->addDay()` to move a value someone else is
  holding. Properties, DTO fields, and action signatures are typed `CarbonImmutable`, never
  `DateTimeInterface` — the interface admits the mutable implementation back through the door.
  Language-level rulings around this live in [[php-language-doctrine]].
- **Domain code never converts — MUST.** No `setTimezone()`, no zone string, no
  `config('app.timezone')` read below the presentation layer. If an action needs a zone, the zone is
  an explicit argument on the value it operates on (§4), not ambient state it fetches.
- **Reporting queries — SHOULD:** grouping by a *local* calendar day is a legitimate conversion and
  belongs in SQL where the index lives: `date_trunc('day', occurred_at AT TIME ZONE :zone)`. Bind
  the IANA name; never interpolate, and never let the session zone supply it implicitly.
- **Range predicates — MUST be half-open** (`>= $start AND < $end`) with both bounds computed as
  UTC instants. A `BETWEEN` on local midnights loses or duplicates an hour twice a year, and the
  duplicate is the one that bills someone twice.

## §4 Wall-time and scheduling — the two shapes of "when"

The core ruling: **a recorded instant and a future intention are different data, stored differently.**

- **Recorded instants — MUST be a bare `timestamptz`.** `created_at`, `occurred_at`, `paid_at`,
  audit entries ([[audit-logging-standard]]), anything that already happened — one point on the
  world's timeline. The zone it happened *in* is display metadata at most, never part of the value.
- **Time-only values — MUST be `time` plus an IANA zone name.** A business's opening hours are
  `09:00` in `America/New_York` and stay `09:00` across the March transition while the UTC instant
  moves an hour. The zone lives **once on the owning aggregate** (`businesses.timezone`), never
  repeated per row — so a business that relocates updates one field.
- **Future user-scheduled events — MUST persist wall-time + zone, and derive the instant.** Three
  authored columns and one derived: `scheduled_date` (`date`), `scheduled_time` (`time`),
  `scheduled_timezone` (IANA name), and `scheduled_at` (`timestamptz`, **derived, never authored**)
  for sorting, dispatch, and every query in §3. The user said "the 14th at 9am"; if the legislature
  moves the transition, the intention is still 9am and the instant is what must move. A naked UTC
  instant cannot express that, and will silently fire an hour wrong.
- **Reprojection — MUST:** the derived instant is recomputed by the action writing any of the three
  authored columns, and by a scheduled command that re-derives **future rows only** after a tzdata
  release lands in the image (past rows are recorded instants — never reprojected). Treat a tzdata
  bump as a data-affecting change in the [[framework-bump-playbook]] sense, not a base-image detail.
- **Zone values are validated input — MUST:** any IANA name arriving from a user, an import, or an
  API is checked against `DateTimeZone::listIdentifiers()` before it is stored. An unvalidated zone
  string is a stored crash.
- **Ambiguous and nonexistent local times — MUST be ruled on explicitly.** On spring-forward, 02:30
  does not exist; on fall-back, 01:30 happens twice. PHP resolves the first forward and picks the
  **earlier** (pre-transition) occurrence of the second. A scheduling flow **MUST** either reject
  the input at validation with a real message or document that it accepts the platform resolution —
  and recurring handlers are idempotent regardless, so the repeated hour cannot double-fire.

## §5 Presentation — the only place a zone is allowed

- **The API stays UTC — MUST NOT localize.** No middleware, no response macro, no per-caller
  transform rewrites a timestamp on its way out ([[fleet-api-specification]] API-404). A machine
  client localizes itself; a response varying by caller zone breaks caching, ETags, and snapshot
  tests, and makes one resource three documents.
- **Zone resolution — MUST be a single resolver, once per request.** The order is: **the user's
  stored preference** (`users.timezone`, IANA, nullable) → **the tenant/organization zone** →
  **UTC**. One small service resolves it and the shared data handler **shares it into Inertia** as
  a prop beside the authenticated user. **MUST NOT** be read from a header deep in a component, and
  **MUST NOT** be applied by mutating process state.
- **Browser detection — MAY seed, never override.** `Intl.DateTimeFormat().resolvedOptions()
  .timeZone` is a fine default to offer at registration or first login; once stored, the preference
  wins. A traveling user's laptop is not a preference change.
- **The React side receives UTC and formats explicitly.** Timestamps arrive as API-404 `Z` strings;
  formatting uses `Intl` with the **resolved zone passed explicitly** — never the browser's ambient
  zone, because an admin inspecting a tenant's schedule must see the tenant's clock, and because an
  explicit zone is what makes SSR and client render agree instead of hydration-mismatching. The
  helpers are pure functions in `lib/`, owned by [[fleet-frontend-specification]].
- **Server-rendered strings — SHOULD** go through one formatting helper taking
  `(CarbonImmutable $instant, string $zone)` with no ambient fallback. A helper that *can* default
  its own zone will, in production, at 2am.

## §6 DST-safe idioms

| Intent | Correct | Wrong |
|---|---|---|
| "24 hours from now" | `$t->addHours(24)` — instant math, zone-free | converting to local first |
| "same time tomorrow" | `$t->setTimezone($zone)->addDay()->utc()` | `$t->addHours(24)` (off by one on transition days) |
| "9am local on the 14th" | `CarbonImmutable::parse('2026-03-14 09:00', $zone)->utc()` | building in UTC and subtracting a remembered offset |
| "today, for this user" | `now($zone)->startOfDay()->utc()` … `->endOfDay()->utc()` (a 23- or 25-hour span) | `now()->startOfDay()` in UTC |
| comparing two instants | `$a->lt($b)` directly — zone is irrelevant | formatting both to strings and comparing text |
| comparing two wall-times | convert both into the same zone, then compare | comparing a UTC instant to a local `H:i` |
| "every day at 9am" | recompute from wall-time + zone each occurrence (§4) | `addDays(1)` on the previous UTC instant, forever drifting |

## §7 Testing

Brief — mechanics owned by [[fleet-testing-doctrine]] §8, smells by [[testing-antipattern-catalog]].

- **Freeze the clock — MUST:** `Carbon::setTestNow()` in units with a teardown reset;
  `freezeTime()` is Feature-only per the doctrine. A test reading the real clock fails at midnight.
- **Pin the ambient zone — MUST:** `APP_TIMEZONE=UTC` in `phpunit.xml`; a test needing a non-UTC
  ambient zone sets and restores it. A suite that passes only because the developer's laptop is in
  one zone is the classic CI-only failure.
- **Cross a transition — MUST for any wall-time, recurrence, or "local day" logic:** a Pest dataset
  containing a spring-forward instant, a fall-back instant, and a **southern-hemisphere** zone whose
  transitions run the other way. One northern zone tests half the bug.
- **The derived instant is the assertion.** For §4 scheduling, assert the derived `scheduled_at`
  before and after a simulated transition — that is the behavior the storage shape exists to buy.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Appointments fire an hour off, twice a year | UTC instant persisted for a future intention; offset stored instead of a zone name | Move to wall-time + IANA zone with a derived instant (§4) |
| Times display correct locally, wrong in prod | Container `TZ` unset or non-UTC; `app.timezone` not UTC | Pin all three layers (§2) — the pod, the app config, the DB session |
| Timestamps shifted by exactly one offset | Double conversion — a value localized on write and again on read, or middleware localizing an already-local string | Find the second conversion; storage is UTC and only §5 converts |
| Same row reads differently from `psql` vs the app | Session `TimeZone` differs between the two; cluster GUC not UTC | Pin the cluster GUC and the connection `timezone` (§2) |
| "Today's" report misses or duplicates rows at the edge | Day boundaries computed in UTC instead of the user's zone; closed-interval `BETWEEN` | `startOfDay()/endOfDay()` in the zone, then `->utc()`; half-open range (§3) |
| A date is off by one day for some users only | Rendering a `Z` instant with the browser's ambient zone (or none) | Pass the resolved zone explicitly to `Intl` (§5) |
| Stored zone throws on load | Unvalidated zone string, or a legacy abbreviation like `EST` | Validate against `DateTimeZone::listIdentifiers()` on write; backfill abbreviations to IANA names |
| A value changed under a caller that didn't touch it | Mutable `Carbon\Carbon` aliasing | The §3 arch rule; type as `CarbonImmutable` |
| Recurring job doubles up one night a year | Fall-back repeated hour meeting a non-idempotent handler | Idempotency ([[fleet-queue-doctrine]] §1); recompute occurrences from wall-time (§6) |
| Restore lands data at an unexpected hour | Snapshot windows read in the operator's local zone | Windows and RPO are stated in UTC — [[backup-dr-standard]] |

## §9 Considered and rejected

- **`timestamp without time zone` + "we always write UTC" as a convention** — unenforceable by
  construction. One `NOW()` in a maintenance session, one package migration, one analytics tool with
  its own session zone, and the invariant is gone with nothing to catch it. `timestamptz` is
  self-describing and normalizes on write; the type does the work the convention asked humans for.
- **Storing a numeric offset (`-05:00`) or an abbreviation (`EST`)** — an offset is a *result* of a
  zone and a date, not a property of a place; it changes twice a year. Abbreviations are worse:
  `CST` is three different zones on two continents.
- **`timetz`** — Postgres discourages it in its own documentation. A time-of-day with an offset and
  no date has nothing to resolve DST against. §4's `time` + IANA zone is the replacement.
- **Unix epoch integers** — no sub-second precision short of milliseconds-as-bigint, unreadable in
  `psql`, and it forfeits date arithmetic, `date_trunc`, range types, and expression indexes.
- **Middleware that rewrites API timestamps into the caller's zone** — violates API-404, breaks
  ETags and response caching, makes snapshot tests caller-dependent, and pushes an ambiguity (whose
  zone? the token's? the header's?) into every integration. **Revisit trigger:** never for JSON; a
  rendered export (CSV, PDF) is presentation and localizes per §5 by design.
- **`date_default_timezone_set()` per request** — mutating a process global under Octane leaks the
  last request's zone into the next one. The zone travels as a value (§5), not as process state.
- **Mutable `Carbon\Carbon`** — retained only as the thing the §3 arch rule bans.
- **A single app-wide "display timezone" config** — wrong the moment a second user is in a different
  zone, and it invites domain code to read it (§3). The per-user resolver replaces it.
- **Denormalizing a rendered local string beside the instant** — stales on a preference change and
  on a tz-law change, and creates two owners for one fact.
