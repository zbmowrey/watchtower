---
title: Fleet API Specification (v1 — the REST API rule of record)
description: The normative Specification for every HTTP API a fleet app exposes — architecture, URLs, requests, responses, errors, versioning, auth, rate limiting, documentation, and contract enforcement. Derived from primary-source research (RFCs, Laravel docs + framework source, spatie docs, Stripe/GitHub/Zalando/Azure prior art), NOT from existing fleet APIs; existing surfaces converge to this page.
tags: [spec, standard, api, rest, laravel, http, mandate]
type: standard
status: normative
updated: 2026-08-01
related: [fleet-app-specification, fleet-frontend-specification, http-method-semantics, http-status-codes, problem-details, api-versioning, sanctum-token-auth, openapi-scramble]
---

# Fleet API Specification — v1

The **requirement of record** for every HTTP API a fleet Laravel app exposes. Sister to
[[fleet-app-specification]] (operational config) and [[fleet-frontend-specification]] (FE
architecture); this page owns the **API surface**: what a request looks like, what a
response looks like, and what enforces the contract.

**Provenance.** Every ruling here was derived 2026-07-30 from primary sources — RFC 9110/9111
(HTTP), RFC 9457 (problem details), RFC 6585/8288/9745/8594, the IETF ratelimit + idempotency
drafts, OpenAPI 3.1, the Laravel docs *and framework source*, the spatie package docs, and the
Stripe/GitHub/Shopify/Zalando/Azure/Google guidelines — **not** from existing fleet APIs. Where
a shipped surface disagrees with this page, **the surface converges to the page**, never the
reverse. Track your own current state and gaps as a living convergence page. Deep reference for
every section → the [laravel-rest-api corpus](../stack/laravel-rest-api/_index.md).

## §0 Scope, doctrine, and conformance

- **Applies to:** every Laravel app in your fleet that exposes an HTTP API, including any golden
  template you scaffold from, which MUST ship this spec's scaffold.
- **Normative language:** **MUST / MUST NOT / SHOULD / MAY** per RFC 2119;
  **ACCEPTED-DEVIATION** = a justified departure recorded in §13, never silent. Rules carry
  citable IDs (`API-###`).
- **Deviation policy:** identical to [[fleet-app-specification]] — if a rule breaks an app,
  refactor the app; never weaken the rule silently.
- **The doctrine** (each expanded in [[rest-maturity-and-doctrine]]):
  1. **Richardson Level 2, honestly.** Resources + correct verbs + correct status codes +
     a published OpenAPI contract. No HATEOAS, no hypermedia vocabularies — the position
     Stripe and GitHub take. Statelessness IS kept as a hard rule.
  2. **The API is a second transport, not a second app.** It reuses the same
     actions/services/repositories as the web plane (§1).
  3. **Tolerant reader, conservative writer** (Zalando #108/#109). Clients must survive
     additive change; the server never breaks a mounted major (§8).
  4. **Code is the contract's source of truth.** The OpenAPI document is generated from the
     code, committed, and CI-gated — it structurally cannot drift (§11).
  5. **Uniformity over cleverness.** An external engineer who has seen one fleet endpoint
     has seen them all.

---

## §1 Architecture — the second transport

The full pattern → the [laravel-rest-api corpus](../stack/laravel-rest-api/_index.md); layering ground rules → [[transport-layer-boundary]], [[controllers]], [[repositories]], [[query-builders]].

| ID | Rule |
|---|---|
| API-101 | API controllers **MUST NOT contain business logic**. They translate HTTP → a domain call → HTTP, exactly like [[controllers]] mandates for web controllers. The layer chain is controller → action/service → repository/query builder — the **same** classes the web plane calls. |
| API-102 | Logic needed by an API endpoint that currently lives only in a web controller / Inertia handler **MUST be extracted** into a transport-agnostic action or service both planes call. **Every API implementation plan MUST include this extraction step.** Copying logic into the API plane is forbidden — one behavior, one owner, two transports. |
| API-103 | Only the **transport layer is versioned** (`App\Http\Api\V1\…`: controllers, FormRequests, Resources). The domain layer is shared and unversioned. `if ($version === 2)` branches in shared code are forbidden — a new major is a new transport directory, not a domain fork. |
| API-104 | The API plane **MUST be stateless**: token auth per request, no session, no cookies, no CSRF. (SPA cookie auth is the web plane's affordance, not the API's.) |
| API-105 | Arch tests **MUST** pin the boundary: `App\Http` used only in `App\Http`; the domain never uses `request()` / `Illuminate\Http` (already in the fleet arch suite); Api controllers extend nothing beyond the base controller and stay `final`. |

## §2 URLs, routing, and resource design

Deep reference → [[http-method-semantics]], [[api-versioning]].

| ID | Rule |
|---|---|
| API-201 | Every versioned surface mounts at **`/api/v{major}`** (integer major, no minors — `/api/v1`, never `/api/v1.2`). Route names mirror it: `api.v1.*`. MT (stancl) apps register the group inside the tenant route file with the same URL shape and names — the spec constrains the URL and middleware stack, not the file. |
| API-202 | Resource segments are **plural, kebab-case nouns** (`/booking-requests`), IDs are route parameters with an explicit constraint (`->whereUuid()` or equivalent). No verbs in URLs, with one exception: **lifecycle transitions are `POST` to a sub-path** (`POST /runs/{id}/complete`) — a controlled sub-resource, not RPC. `GET` never mutates (RFC 9110 §9.2.1). |
| API-203 | Plain CRUD **SHOULD use `Route::apiResource`** (canonical URIs + names for free); lifecycle and non-CRUD routes are explicit and named. Every route is named. |
| API-204 | Nesting is **at most one level** and **shallow** (`->shallow()`): collection routes nest under the parent, member routes are flat. Deeper hierarchies flatten behind filters (`?filter[project_id]=`). |
| API-205 | Nested bindings **MUST be scoped** — `->scoped([...])` or `->scopeBindings()` on every nested resource. Laravel does NOT scope child bindings by default: without this, `/photos/{photo}/comments/{comment}` happily serves a comment belonging to a different photo. This is a cross-tenant/cross-parent data leak, not a style point. |
| API-206 | Laravel's health endpoint `/up` stays **unversioned, outside `/api`, and out of the OpenAPI document**. |

## §3 Requests

Deep reference → [[form-requests]] (architecture), [[spatie-laravel-data]] (the DTO carrier and why it does not validate).

| ID | Rule |
|---|---|
| API-301 | Every endpoint that accepts input **MUST validate through a FormRequest** — rules, `authorize()`, and a `toData()` handoff producing a typed DTO, per [[form-requests]]. Controllers consume `->toData()` / `->safe()`, never `$request->all()`. |
| API-302 | **FormRequests own validation; Data classes carry.** `spatie/laravel-data` validation attributes on inbound classes are **forbidden** — its two-step validation makes verb-conditional rules structurally impossible and silently skips validation on `new`/`from(array)`, so attributes there are decorative contract theater. One Data class per operation (`CreateXData`/`UpdateXData`) when shapes differ. Full evidence → [[spatie-laravel-data]]. |
| API-303 | Request bodies are **JSON only**: `Content-Type: application/json` (415 otherwise, §6). No form-encoded bodies, no `_method` spoofing on the API plane — clients send real verbs. |
| API-304 | Validation failures are **422** with the problem-details validation shape (§6/[[problem-details]]). **400** is reserved for malformed requests: unparseable JSON, invalid query syntax, unknown/disallowed members of the reserved query families (§5). |
| API-305 | Booleans in query strings parse via `$request->boolean()` semantics (`1/true/on/yes`); normalize in `prepareForValidation()` so the `boolean` rule sees a real bool. A bare valueless `?flag` MUST NOT mean true. |
| API-306 | Unknown **body** fields are ignored (tolerant server; `validated()` consumes only allow-listed input, which also keeps mass assignment safe by construction). Unknown members of the **reserved query families** (`filter`, `sort`, `include`, `fields`, `page`, `per_page`, `cursor`) are rejected with 400. |
| API-307 | Unsafe non-idempotent endpoints where a duplicate would be costly (payments, sends, one-shot creates) **SHOULD accept `Idempotency-Key`** with the draft's exact semantics: replay returns the stored result; same key + different payload → 422; key still in flight → 409. Full mechanics → [[idempotency-keys]]. |

## §4 Responses

Deep reference → [[api-resources]] (the output layer).

| ID | Rule |
|---|---|
| API-401 | Every success body is produced by an **Eloquent API Resource** (`JsonResource`/`ResourceCollection`). Bare models, arrays, paginators, or raw `response()->json()` payloads are forbidden on success paths — the resource class IS the response contract, and it is what Scramble reads (§11). |
| API-402 | **Wrapping stays ON** (`data` key), fleet-wide, no exceptions. `withoutWrapping()` is forbidden: paginated responses are always wrapped regardless, so unwrapping guarantees an inconsistent envelope; and a top-level JSON object (never a bare array) is what keeps every response additively extensible (Zalando #110). Single resources and collections alike: `{"data": …}`. |
| API-403 | Field names are **snake_case** (fail-safe with Eloquent: an accidentally exposed attribute is at least *conformant*; under camelCase the same slip ships a silent violation). Applies to query parameters too. |
| API-404 | Timestamps are **RFC 3339 UTC with the `Z` suffix and fixed microsecond precision** — pin `serializeDate()` on the base model: `$date->setTimezone('UTC')->format('Y-m-d\TH:i:s.u\Z')`. Variable precision breaks snapshots and clients that parse naively. |
| API-405 | Public identifiers are **JSON strings, always** (JS loses integer precision above 2^53, and int→string later is breaking). New public resources use **UUIDv7** (`HasUuids`); internal bigint PKs stay internal. |
| API-406 | Money is **integer minor units + ISO-4217 currency** (`{"amount_minor": 1999, "currency": "USD"}`). Never a float, never a bare decimal string. |
| API-407 | **Documented nullable fields are always present with `null`** — omission is reserved for sparse-fieldset/include mechanics. Booleans and arrays are never null: absent-or-false, and `[]` for empty. This keeps OpenAPI `required` meaningful and clients free of `?? null` scar tissue. |
| API-408 | Enums serialize as strings; response enums are declared extensible (`x-extensible-enum` doctrine) and documented "clients MUST tolerate unknown values" — that is what makes adding a value non-breaking (§8). |
| API-409 | Relationship fields in resources **MUST use `whenLoaded()`** (never `$this->relation` directly — a latent N+1); counts via `whenCounted()`. Eager-loading decisions live in the controller/query layer. |
| API-410 | Status codes per action: `GET`/`PUT`/`PATCH` → 200; `POST` create → **201 + `Location`** header naming the new resource; `DELETE` → **204** empty body; queued/async work → **202** with a status pointer. `JsonResource` emits 200 by default — store() MUST set 201 explicitly (`->response()->setStatusCode(201)`). Full table + companion-header obligations → [[http-status-codes]]. |
| API-411 | PUT is full replacement and MUST NOT be offered where the server transforms the stored representation silently; partial update is **PATCH** (merge semantics: only sent fields change) and MUST be atomic (RFC 5789 §2). Method table → [[http-method-semantics]]. |

## §5 Collections — pagination, filtering, sorting

Deep reference → [[api-pagination]], [[api-filtering-sorting]].

| ID | Rule |
|---|---|
| API-501 | Unbounded collections **MUST paginate**. Default page size **25**, hard cap **100**, `per_page` validated (`integer|min:1|max:100`). No "return everything" sentinel of any kind — an uncapped list endpoint is a self-DoS. |
| API-502 | Offset pagination (`paginate()` + `?page=`) is the default; **cursor pagination** (`cursorPaginate()` + `?cursor=`) for feeds/infinite scroll and write-heavy or very large sets (offset skips/duplicates rows under concurrent writes and scans everything before the offset). Do not return totals on unbounded sets. |
| API-503 | Paginated responses use the resource-collection envelope (`data` + `links` + `meta`) and **MUST call `->withQueryString()`** — Laravel drops every filter/sort param from pagination links otherwise, silently breaking any filtered list. A `Link` header (RFC 8288 `rel="next|prev|first|last"`) SHOULD accompany it. |
| API-504 | Filtering/sorting/includes/sparse fieldsets use the **`spatie/laravel-query-builder` v7 vocabulary**: `filter[x]=`, `sort=-created_at`, `include=a.b`, `fields[type]=` — deny-by-default explicit allow-lists (v7 removed wildcards for exactly this reason). Composition honors the layer chain: repository/query-builder returns the tenant-scoped `Builder`; `QueryBuilder::for($base)` wraps it **at the HTTP edge only** (v7's `QueryBuilder` no longer extends Eloquent's `Builder` — repositories must never return one). |
| API-505 | The `include` query param belongs to query-builder (DB-layer eager loads mirrored by `whenLoaded()` in resources). laravel-data's `allowedRequestIncludes()` — which claims the same param for serialization-layer partials — is forbidden. |
| API-506 | Rejected members of the reserved query families (`InvalidFilterQuery` etc.) render as **400** problem details (§6). The `disable_invalid_*_query_exception` config flags stay `false` — silent ignoring hides client bugs. |

## §6 Errors — problem details

Deep reference → [[problem-details]] (RFC 9457 mechanics + the Laravel renderer).

| ID | Rule |
|---|---|
| API-601 | **Every** API error response is **`application/problem+json`** (RFC 9457): `type`, `title`, `status`, `detail` (corrective, never diagnostic), `instance`. Laravel's default `{message, errors}` shape is replaced by a central renderer in `bootstrap/app.php` (shipped in `standards/laravel/`). The `status` member MUST equal the actual HTTP status. |
| API-602 | `type` is a stable URI under the app's canonical host: `https://<host>/problems/<kebab-slug>`, resolving to human docs; `about:blank` MAY be used where the status code says everything. `title` is fixed per type; problem types are an immutable contract — never renamed, never re-meant. |
| API-603 | Validation failures (422) use **RFC 9457 §3's own shape**: an `errors` extension array of `{"detail": "...", "pointer": "#/field/path"}` with JSON Pointers — the spec-blessed mapping for Laravel's field errors. |
| API-604 | Domain exceptions **declare their mapping explicitly** — implement the fleet `ProblemDetails` contract (status + type slug) or carry the mapping attribute; the central renderer consumes it. Name-suffix magic MUST NOT decide status codes: an unmapped exception is a 500 and that's the correct failure mode for "I forgot to decide". |
| API-605 | Status semantics are fixed: **400** malformed syntax / bad reserved-query members · **401** missing/invalid token (+ `WWW-Authenticate: Bearer` — an RFC MUST) · **403** authenticated but denied (incl. entitlement; 402 is not used) · **404** absent or concealed · **405** (+ `Allow`, RFC MUST — Laravel emits it) · **409** state conflict · **410** sunset surface · **412** failed precondition · **415** wrong content type · **422** semantic validation failure · **428** missing required precondition · **429** throttled (+ `Retry-After`) · **503** (+ `Retry-After`). Full registry annotations → [[http-status-codes]]. |
| API-606 | Error bodies MUST NOT leak internals — no stack traces, exception classes, file/line, SQL, or allow-list dumps. (`APP_DEBUG=true` puts all of those in Laravel's JSON error bodies; prod debug-off is already mandated by [[fleet-app-specification]], and the [[problem-details]] renderer never emits them regardless.) |

## §7 Content negotiation, caching, conditional requests

Deep reference → [[content-negotiation]], [[conditional-requests-etags]].

| ID | Rule |
|---|---|
| API-701 | The fleet speaks **JSON only**. `Accept: application/json` and `*/*` are honored; any Accept that excludes JSON gets **406** (problem+json — RFC 9457 §3 explicitly blesses sending it regardless of Accept). XML and other formats are considered-and-rejected: one representation, zero negotiation surprise. |
| API-702 | The api group carries the fleet **ForceJsonResponse** middleware (sets the request's Accept to `application/json`) plus `shouldRenderJsonWhen()` covering `api/*` at the exception layer — Laravel ships no such forcing by default and HTML error pages on an API are a contract break. |
| API-703 | Responses that vary on a request header beyond method+URI send **`Vary`** accordingly (never listing `Authorization`; never `Vary: *`). |
| API-704 | **Every API response carries an explicit `Cache-Control`** — default `private, no-cache` for authenticated GETs, `no-store` where the body holds credentials/PII. Never rely on defaults: 404/405/410 are *heuristically cacheable* per RFC 9110 §15.1, so a bare API 404 can be cached by an intermediary. `public`/`s-maxage` MUST NOT appear on authenticated responses. |
| API-705 | Conditional requests are the SHOULD-tier upgrade path: where a mutable resource warrants lost-update protection, GET emits a strong `ETag`, writes require `If-Match`, missing precondition → **428**, failed → **412**, and `If-None-Match` revalidation → **304**. When adopted, the exact RFC 9110 §13 evaluation order and comparison rules apply — no partial implementations. |

## §8 Versioning and evolution

Deep reference → [[api-versioning]] (strategy trade-offs, prior art, sunset mechanics).

| ID | Rule |
|---|---|
| API-801 | Version in the **URL path only** (`/api/v1`) — greppable, curl-able, CDN-cacheable with zero `Vary` machinery. Header/date pinning (Stripe/GitHub) solves a thousands-of-anonymous-integrators problem this fleet does not have. |
| API-802 | Within a major, change is **additive-only**: new endpoints, new *optional* request fields, new response fields, new request-enum values, new declared-extensible response-enum values. **Breaking** — new required request field, remove/rename anything, narrow a type, change a status code or pagination semantics, flip nullability — means **v2**. |
| API-803 | The additive-only rule is **CI-enforced, not honor-system**: oasdiff runs against `main`'s committed spec and fails the build on breaking changes (§11). |
| API-804 | A new major **mounts alongside** the old (`/api/v1` and `/api/v2` simultaneously); no in-place upgrades. v1's observable behavior stays byte-identical after v2 ships. |
| API-805 | Retirement is the two-header sequence: **`Deprecation`** (RFC 9745 — Structured-Field Date, `@epoch`) + `Link rel="deprecation"` on every response from the superseded version, then **`Sunset`** (RFC 8594 — HTTP-date; a *different* format, deliberately) once a shutdown date exists, then **410 Gone**. Sunset MUST NOT precede Deprecation. Minimum overlap: 6 months first-party-only, 12 months if any external consumer exists. |
| API-806 | Responses echo the served version in **`X-Api-Version`** so logs and support tickets carry it unaided. |

## §9 Authentication and authorization

Deep reference → [[sanctum-token-auth]] (abilities, clamp, traps).

| ID | Rule |
|---|---|
| API-901 | Auth is **Sanctum personal access tokens, `Authorization: Bearer`**, stateless (API-104). OAuth2/Passport only if a genuine third-party-consent flow ever materializes. |
| API-902 | Token abilities are named **`resource:verb`** (`customers:read`, `quotes:send`) — groups by resource in pickers/docs/sorts, mirrors the web-plane permission atoms, and extends naturally to money verbs (`send`, `record`) beyond `read`/`write`. Shape is pinned by regex test: `^[a-z][a-z-]*:(read|write|send|record)$`. |
| API-903 | Each route names **exactly one required ability** via the **`abilities:`** (ALL-of, `CheckAbilities`) middleware. The near-identical **`ability:`** (ANY-of) alias is banned fleet-wide — two spellings apart from opposite semantics is a standing incident. One-ability-per-route makes the distinction moot *and* keeps ability→endpoint mapping trivially auditable. |
| API-904 | **Grant-time clamp:** a token can never hold an ability its minter's web-plane permissions don't cover — enforced in the mint UI *and* re-validated in the FormRequest, pinned by an exhaustive ability-catalog test. A token is a delegation of the minter's authority, not an escalation of it. |
| API-905 | Abilities gate the *token*; **policies still authorize the *user*** on every object (`can()` in FormRequest `authorize()` or the action). `tokenCan()` returns `true` unconditionally for first-party SPA sessions — abilities are never a sufficient authorization boundary alone. |
| API-906 | Tokens **expire** (`config/sanctum.php` expiration set, default 365d), `sanctum:prune-expired` scheduled, revocation surfaced in the token UI. Entitlement/paywall gates ride the route group (403 + problem type `entitlement-required`), never per-controller. |

## §10 Rate limiting

Deep reference → [[api-rate-limiting]].

| ID | Rule |
|---|---|
| API-1001 | Every app exposing an API **MUST define** `RateLimiter::for('api')` and apply `throttle:api` to the versioned group. Fleet default: `Limit::perMinute(120)->by('api:'.($user?->getAuthIdentifier() ?? $request->ip()))`. A missing limiter is an unthrottled API — a spec breach ([[fleet-app-specification]] RateLimiter row) and a live defect class. |
| API-1002 | 429 responses are problem+json with `Retry-After`; Laravel's `X-RateLimit-Limit`/`X-RateLimit-Remaining` headers ride along (the IETF `RateLimit`/`RateLimit-Policy` structured fields are additive future work, not yet adopted — the draft redesigned them in 2026 and most published guidance describes the dead version). |
| API-1003 | Expensive or abuse-prone surfaces (exports, sends, token minting) get named limiters of their own; 404-heavy lookups SHOULD use response-based counting (`->after()`) to blunt enumeration. |

## §11 Documentation and contract enforcement

Deep reference → [[openapi-scramble]] (the whole chain, config, CI wiring).

| ID | Rule |
|---|---|
| API-1101 | The OpenAPI 3.1 document is **generated from code by `dedoc/scramble`** — it reads FormRequests, JsonResources, bindings, and enums with zero annotations, which is precisely why §3/§4 mandate those primitives. Scramble is **pinned exact** (0.x: minors have carried behavior changes). Hand-maintained spec builders and annotation tools (l5-swagger et al.) are rejected: drift by construction. |
| API-1102 | The exported spec (`scramble:export` → `docs/openapi-v1.json`) is **committed**. CI re-exports and `git diff --exit-code`s it — the build fails if code and committed contract disagree, which makes every contract change a reviewable PR diff. |
| API-1103 | **oasdiff** gates the diff against `main`'s spec with `--fail-on ERR` — the mechanical enforcement of API-802's additive-only doctrine (213 breaking-change checks). oasdiff (kin-openapi) parses **OpenAPI 3.0 only** while Scramble emits 3.1, so BOTH sides of the diff pass through a deterministic 3.0 down-convert first (`type: [T, "null"]` → `nullable`, `const` → single-value `enum`) that fails loudly on unmapped constructs — reference implementation `bin/openapi-30-downconvert.mjs` in acme. Related trap: a PHP assoc decode → re-encode of the document turns empty `additionalProperties: {}` schemas into invalid `[]` arrays that strict parsers refuse; the export post-processor must restore them. |
| API-1104 | **`hotmeteor/spectator`** contract assertions run in the Pest API tests (`assertValidRequest()` / `assertValidResponse(status)`) — the independent observer that catches what Scramble's *static* inference gets wrong (`when()`/`mergeWhen()` conditionals, computed payloads, undocumented status codes). |
| API-1105 | Docs UI is Scramble's `/docs/api` (per version), gated by the `viewApiDocs` gate — never public by default. The spec document itself MAY be public (it is the contract, not a secret). |
| API-1106 | OpenAPI conventions: `operationId` camelCase `<verb><Resource>` and treated as immutable (SDK method names hang off it); tags declared top-level with descriptions; `components.securitySchemes` documents the Bearer scheme + ability strings per operation. |

## §12 Testing

Testing doctrine → [[fleet-testing-doctrine]]; API-specific reference → [[openapi-scramble]], [[sanctum-token-auth]].

| ID | Rule |
|---|---|
| API-1201 | Every endpoint has Pest feature coverage that opens with the **two standing negatives**: unauthenticated → 401, wrong-ability token → 403 (`Sanctum::actingAs($user, [...])`). |
| API-1202 | Success-path tests assert the **contract**, not just 200: Spectator request+response validation (API-1104), envelope shape, and the status-code table (201+Location, 204-empty). |
| API-1203 | The ability catalog is **pinned by test**: exhaustive `toBe([...])` on the vocabulary, the shape regex, and (where the clamp exists) every ability→permission mapping resolves. Vocabulary drift is a failing test, not a surprise. |
| API-1204 | Problem-details rendering has shape tests per class (401/403/404/422/429): `content-type: application/problem+json`, required members, no leak members (`exception`, `file`, `trace`). |
| API-1205 | Pagination guardrails are tested: `per_page` over the cap → 422, `withQueryString` link preservation, and the default page size. |

## §13 Accepted deviations

None yet. Candidates surface through your convergence tracking; a deviation lands here only with
an explicit ruling and a recorded why.

---

**Considered and rejected** (one line each, so the next debate starts from evidence):
**JSON:API envelope** — vocabulary borrowed (§5), envelope rejected: type-tagged resource
objects + compound documents tax every client for a benefit CRUD APIs rarely collect.
**HAL / OData** — hypermedia plumbing without payoff / a full query language + metadata model,
both disproportionate. **Header/date versioning** — solves anonymous-integrator pinning at the
cost of `Vary` correctness everywhere; wrong trade for first-party clients. **laravel-data as
validator or output layer** — two-step validation quirks inbound; reflection overhead +
Scramble-PRO-only inference outbound; retained solely as the typed DTO carrier.
**`ability:` ANY-of middleware** — semantic twin-name hazard (API-903). **XML negotiation** —
one representation, no surprise (API-701). **QUERY method (RFC 10008, June 2026)** — the
new safe/idempotent/cacheable "GET with a body"; watched, not adopted: no ecosystem support
yet and our `filter[...]` vocabulary fits in URLs; adoption later would be additive
(details → [[http-method-semantics]]).
