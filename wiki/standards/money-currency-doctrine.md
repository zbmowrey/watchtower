---
title: Money & Currency Doctrine (v1 — minor-unit integers, brick/money, boundary adapters)
description: The normative rule set for every monetary amount in a fleet Laravel app — the float ban, the `*_minor` BIGINT + `currency_id` FK column pair and the `currencies` reference table, the brick/money value object and its Eloquent cast, explicit rounding and allocate()-not-divide arithmetic, the adapter that converts external decimals exactly once at the boundary, locale formatting at the presentation layer, and the arch/lint guards. Billing lifecycle stays in [[cashier-paddle-integration]]; the wire envelope stays in [[fleet-api-specification]] API-406.
tags: [ spec, standard, money, currency, precision, eloquent, laravel, mandate ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-api-specification, fleet-testing-doctrine, php-language-doctrine, cashier-paddle-integration, fleet-frontend-specification, datetime-timezone-doctrine, type-safety-and-strictness ]
---

# Money & Currency Doctrine — v1

The **requirement of record for representing, storing, computing, and rendering money**. Written
against PHP 8.5 / Laravel 13 / Postgres. Normative language per [[fleet-app-specification]]:
**MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations recorded there, never silent.

**Scope boundary.** Subscription and billing lifecycle — checkout, proration billing, dunning, seats,
the processor seam — is owned by [[cashier-paddle-integration]]; that page's seam *is* an instance of
this page's §6 adapter. The **wire representation** of an amount is owned by
[[fleet-api-specification]] **API-406**. Tax calculation is out of scope until an app need pulls it in.
The sister precision doctrine is [[datetime-timezone-doctrine]].

## §1 The four laws

1. **Money is never a float.** IEEE-754 cannot represent `0.10`; `0.1 + 0.2 !== 0.3`. The corruption is
   *silent* — it ships green (a test that seeds a float and asserts the same float agrees with itself)
   and surfaces months later as fractions of a cent nobody can attribute.
2. **An amount without its currency is not money.** `1999` is a number. Amount and currency travel
   together — one column pair, one value object, one object on the wire.
3. **The stored unit is an integer of the smallest currency increment** ("minor units"), whose size is
   a property of the currency, not a constant: USD 2, JPY 0, KWD 3. Any hardcoded `100` — `* 100`,
   `/ 100`, `round($x, 2)`, `decimal(12,2)` — is wrong for roughly a third of ISO-4217.
4. **Division is allocation.** Splitting with `/` loses the remainder; the parts must sum back to
   exactly the whole. `$10.00 / 3` rounded per part is `$9.99`, and the missing cent becomes an
   unattributable reconciliation line.

## §2 Representation — the in-memory type

- **The type — MUST:** `Brick\Money\Money` (`brick/money`), a direct top-level dependency per
  [[fleet-app-specification]] §1 — it carries the ISO-4217 currency, knows every currency's exponent,
  exposes explicit rounding modes, and implements `allocate()`/`split()` correctly.
- **Domain signatures — MUST** take and return `Money`. A method taking `(int $amountMinor, string
  $currency)` has moved a storage detail into the domain and re-opened law 2 at every call site;
  Money-typed parameters are also what make §8's guards meaningful. An app-level wrapper **MAY**
  concentrate an invariant the library cannot know (a `Price` that refuses negatives) — `final readonly`
  per [[type-safety-and-strictness]], *wrapping* `Money`. Wrapping for a house type buys nothing.
- **Sub-minor intermediates — SHOULD:** per-unit rates and percentage chains that must not round until
  the end use `Brick\Money\RationalMoney`, materialized to `Money` **once**, at the end, with an
  explicit rounding mode. A `RationalMoney` **MUST NOT** be persisted.

## §3 Schema — the column pair and the `currencies` table

- **The column pair — MUST:** every stored amount is **two** columns — `<name>_minor` **BIGINT** plus a
  `currency_id` FK, never one without the other (`int4` caps at ~21.4M major units at exponent 2). The
  **`_minor` suffix is mandatory and load-bearing**: it is the grep surface §8's guards key on, so a
  money column named without it is invisible to enforcement.
- **Nullability moves together — MUST,** in DDL: `CHECK ((amount_minor IS NULL) = (currency_id IS
  NULL))` — half a money value is not a readable state. Two amounts on one row that can differ in
  currency each carry their own FK (`amount_currency_id`, `fee_currency_id`).
- **The `currencies` table — MUST** exist wherever money is stored:

  ```
  currencies
    id          smallint  PK
    code        char(3)   UNIQUE   -- ISO-4217 alpha, uppercase
    minor_unit  smallint           -- digits after the decimal point (USD 2, JPY 0, KWD 3)
    symbol      varchar            -- display metadata for server-rendered surfaces
    name        varchar            -- human label for pickers and reports
    is_enabled  boolean            -- does this app trade in it today
  ```

  **The divisor is derived (`10 ** minor_unit`), never a second column** — two stored values that must
  agree are a drift bug with a schedule. Expose it as an accessor if code wants it.
- **Why an FK when the library already knows ISO-4217 — the split of ownership:** `brick/money` owns
  *arithmetic*, the table owns *identity and presentation*. The FK makes `'usd'`, `'US$'`, and `''`
  unrepresentable and houses the enabled trading set and display metadata; bare text is rejected (§10).
- **Seeding — MUST** be an idempotent seeder (upsert on `code`) invoked from `DatabaseSeeder` and the
  deploy's migrate step, seeding **only the currencies the app trades in**. Data inserts inside schema
  migrations are rejected — they never re-run, so correcting a symbol becomes a new migration. **Rows
  are never deleted:** retire with `is_enabled = false`; an amount whose currency FK dangles is
  unreadable money.
- **Converted amounts — MUST** (apps that convert) store the rate used and the as-of instant beside the
  converted amount — a converted figure without its rate is unauditable. Instant semantics per
  [[datetime-timezone-doctrine]].

## §4 The Eloquent cast

- **One custom cast — MUST:** a `CastsAttributes` implementation (`MoneyCast`) marries the column pair to
  a `Money`, registered in the model's `casts()`. `get()` returns `Money::ofMinor(…, $code)`; `set()`
  returns **an array of both columns** — the multi-column form of the cast contract, which is what lets
  the pair be one attribute.
- **Never lazy-load inside the cast — MUST NOT:** resolving `currency_id → code` through a relation runs
  one query per row and turns any list view into an N+1 farm. `currencies` is a tiny, effectively
  immutable reference table — resolve through a cached id↔code map (a repository over
  `Cache::rememberForever`, invalidated by the seeder).
- **Models expose `Money` — MUST.** Domain code reading `$invoice->total_minor` is a defect; the raw
  columns exist for SQL and nothing else, and accessors returning *formatted strings* belong to §7.
  Money input is validated as an integer of minor units or a **decimal string** and converted exactly
  once at the boundary (§6).
- **SQL aggregation — SHOULD,** and safely: `SUM(total_minor)` is correct and fast but returns a bare
  int, so **the query layer MUST re-wrap it into `Money` at its boundary and MUST group or filter by
  `currency_id`.** Summing minor units across currencies produces a confident, meaningless number no
  type system catches — the most common way a float ban still yields a wrong total.

## §5 Arithmetic — rounding, allocation, comparison

- **Rounding is always a decision — MUST:** name the `RoundingMode` at every operation that can lose
  precision. `brick/money` throws `RoundingNecessaryException` by default and **that default MUST NOT be
  softened globally** — an exception at the moment precision would be lost is the feature you are paying
  for. **Half-up (`RoundingMode::HALF_UP`) is the fleet default — MUST** for anything a customer sees or
  can re-derive by hand: it is the only mode that agrees with a receipt checked on paper.
- **Banker's rounding is the narrow exception — MAY:** `RoundingMode::HALF_EVEN` where systematic upward
  bias across a large N is the actual risk (interest accrual, statistical reporting). Its advantage
  exists only in aggregate; on one invoice it just makes the hand-check disagree. Choosing it **MUST** be
  deliberate and commented at the call site, and **MUST NOT** be mixed with half-up in one chain.
- **Never divide money — MUST NOT** use `/` or `dividedBy()` to split an amount among parts. Use
  `allocate($ratios)` / `split($n)`: the remainder is distributed deterministically so the parts sum to
  exactly the whole. That is the rule for proration, line-item splits, per-seat breakdowns, and refund
  apportionment. **Percentages take strings — MUST:** `->multipliedBy('0.0825', RoundingMode::HALF_UP)`;
  a float literal in a multiplier reintroduces law 1 where it does the most damage.
- **Comparison — MUST** use `isEqualTo()` / `isGreaterThan()` / `isZero()`. Cross-currency operations
  throw `MoneyMismatchException` **by design**; that exception **MUST NOT** be caught and coerced —
  convert explicitly (§3's stored rate) or do not compare. Sum a collection seeded with
  `Money::zero($currency)`, never `0`; a refund or credit is a **negative amount** (SHOULD), never an
  absolute value plus a direction column.

## §6 Boundaries — the adapter rule

- **Convert exactly once, at the edge — MUST.** Every external system that speaks money gets an
  **app-owned interface** whose signatures take and return `Money`; its adapter is the *only* place a
  decimal string, float, or naked int may appear. External sloppiness stops at that class.
- **Decimal strings parse, never cast — MUST:** `Money::of('19.99', 'USD')`; a `(float)` inside an
  adapter defeats the adapter. Where a provider's JSON hands over a native float the value **is already
  lossy** — convert with an **explicit** rounding mode and document the lossiness at that seam: a known,
  bounded defect in one class, not a habit that spreads inward.
- **USD-only externals — MUST be mapped explicitly:** the adapter asserts the currency it hands over and
  throws on mismatch. "Everything here is dollars" holds until the app sells in a second currency, and
  is then silently wrong for every historical record.
- **Egress — MUST NOT** hand out `->getMinorAmount()->toInt() / 100`; use `->getAmount()`/`->toScale()`
  for exact decimal output and `formatTo()` for human output (§7). **Wire representation — one line,
  then defer:** money crosses an HTTP boundary as integer minor units plus the ISO-4217 code, and the
  exact envelope, field names, and nullability are [[fleet-api-specification]] **API-406** — webhook
  payloads inherit the same rule through it.

## §7 Presentation — formatting and the front end

- **Formatting is a presentation act — MUST NOT** happen in a model, action, or domain service, or
  anything returning a value another calculation might consume; a formatted amount is terminal.
  Server-rendered surfaces (mail, PDF, exports) use `Money::formatTo($locale)`: **locale, not currency,
  decides** separators, grouping, and symbol placement.
- **The React ruling — MUST:** props carry **minor units + ISO code**, never a preformatted string, and
  the client formats with `Intl.NumberFormat(locale, { style: 'currency', currency })`. The browser knows
  the user's locale and the server is guessing, and a preformatted string cannot be re-aligned in a
  table, re-summed, or re-rendered on a locale switch without a round-trip. Symmetrically, money **inputs
  MUST** collect and transport a **decimal string** — a `type="number"` input returns a JS float.
- **Derive the exponent from ICU, not a constant — MUST:** read
  `resolvedOptions().maximumFractionDigits` and divide by `10 ** digits` for display. That float division
  is safe **for display only** (amounts sit far below 2^53) and its result **MUST NOT** re-enter any
  computed value. The formatter is one shared module, not a per-component helper — placement per
  [[fleet-frontend-specification]]. The `symbol` column is not the front end's first source.

## §8 Enforcement and testing

- **The float guards — MUST** be wired in `bin/check`, because the doctrine is one careless migration
  away from undone. (a) Fail on `->float(` / `->double(` / `->real(` anywhere in `database/migrations`.
  (b) Fail on any `casts()` entry mapping a `*_minor` (or `*amount*` / `*price*` / `*total*`) column to
  `'float'`, `'double'`, or `'decimal:*'`. Both are one grep and both catch the real regression — and
  **the naming convention is the enforcement surface**, since a money column not named `*_minor` is
  invisible to both. In `tests/Architecture/` (Pest 5):

  ```php
  arch('the domain does not float money')
      ->expect('App\Domains')
      ->not->toUse(['floatval', 'number_format', 'money_format']);
  ```

- **Testing stance — bootless.** `Money` arithmetic, the cast's `get()`/`set()`, allocation and proration
  rules, and every adapter conversion are **pure** and belong in `tests/Unit` on plain `TestCase` per
  [[fleet-testing-doctrine]] §1; booting the framework to test rounding is the clearest sign the logic is
  in the wrong place. **MUST NOT mock `Money`** — construct it; [[testing-antipattern-catalog]] names
  that exact smell.
- **Two legitimate escalations only:** the persistence round-trip (`Money` → columns → `Money`, including
  the null pair) and §4's aggregate-by-currency rule are managed-DB truths and get a minimal Feature test.
  The **allocation invariant SHOULD** be a property-style test — for any amount and any ratio set, the
  parts sum to exactly the whole.

## §9 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| Totals off by a cent or two | `/` instead of `allocate()`; rounding applied per line then re-summed | Allocate once from the whole (§5); assert parts sum to whole |
| Amount 100× too large or small | Hardcoded `* 100` / `/ 100`; `Money::of()` where `ofMinor()` was meant (or the reverse) | `ofMinor()` for stored ints, `of()` for decimal strings; delete every literal exponent |
| `RoundingNecessaryException` | brick refusing to lose precision silently — working as designed | Name the rounding mode at that call site; never soften the default globally (§5) |
| `MoneyMismatchException` | Two currencies met in one expression — usually a `SUM` that forgot `currency_id` | Group/filter by `currency_id` (§4); convert explicitly, never catch-and-coerce |
| Revenue report confidently wrong | Minor units summed across currencies — no exception, no type error | §4's grouping rule; this failure is silent by construction |
| N+1 on any list showing money | The cast resolving `currency_id` through a relation per row | Cached id↔code map in the cast (§4) |
| Wrong symbol/separators for a locale | Formatting from the `symbol` column instead of `formatTo()` / `Intl.NumberFormat` | §7 — locale decides, not currency |

## §10 Considered and rejected

- **Float / double columns and `float` casts** — the reason this page exists (law 1). **No
  ACCEPTED-DEVIATION is available.**
- **`DECIMAL`/`NUMERIC` columns** — exact, and the strongest rival. Rejected because it pushes the
  exponent into per-column DDL (`decimal(12,2)` is wrong for both JPY and KWD, so a multi-currency schema
  is uniform only by accident), returns a string PHP must wrap anyway, offers a float cast at every
  careless step through Eloquent, and makes rounding the database's policy rather than an explicit
  application decision (§5). **Revisit trigger:** an app whose primary workload is DB-side monetary
  aggregation needing sub-minor precision (ledger or interest engines).
- **Currency code as bare `char(3)`, no FK** — join-free reads, but nothing prevents `'usd'` or `''`, the
  enabled trading set becomes tribal knowledge, and display metadata has no home. *(ACCEPTED-DEVIATION: a
  denormalized `currency_code` beside the FK on a read-heavy reporting table, maintained as a generated
  column — never hand-written.)*
- **`moneyphp/money`, and hand-rolled `Money` objects** — the first is a good library and this is a fit
  judgment, not a quality one: brick's `RationalMoney` gives exact intermediate chains, its
  `BigDecimal`/`BigInteger` base removes the `PHP_INT_MAX` ceiling, its default rounding mode *throws*,
  and `Money::ofMinor()` maps one-to-one onto §3's storage shape. The second is rejected outright — every
  app that writes its own reimplements allocation, gets remainder distribution wrong, and hardcodes two
  decimal places.
- **"We're USD-only" — an amount with no currency at all**, or an app-wide default currency constant
  standing in for one. Works until the first second currency, at which point every historical row is
  ambiguous and there is no data left to disambiguate it with; the FK costs one smallint. Its cousin, **a
  single column holding a formatted string** (`"$19.99"`), appears the moment somebody hand-builds a
  reporting table: unsummable, unsortable, locale-frozen.
