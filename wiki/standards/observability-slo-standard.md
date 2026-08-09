---
title: Observability, Metrics & SLO Standard (v1 — the metrics plane, the golden set, SLOs & error budgets)
description: The normative rule set for the metrics/tracing/SLO layer that sits ABOVE the fleet's baseline telemetry — Prometheus exposition from a Valkey-backed registry with OpenTelemetry naming semantics, RED for the request-serving planes and USE left to the cluster exporters, the seven golden metrics every app MUST export, label-cardinality law (tenant id is never a label), the tracing ruling (request-id correlation + Sentry performance, full OTel deferred), per-app availability/latency SLOs with burn-rate paging, and dashboards-as-code. Logging conventions stay with [[observability]], queue metrics with [[fleet-queue-doctrine]] §5, outside-in probing with [[uptime-alerting-standard]].
tags: [ spec, standard, observability, metrics, prometheus, grafana, slo, tracing, mandate, laravel ]
type: standard
status: normative
updated: 2026-08-08
related: [ fleet-app-specification, fleet-queue-doctrine, observability, uptime-alerting-standard, incident-response-template, fleet-testing-doctrine, laravel-performance ]
---

# Observability, Metrics & SLO Standard — v1

The **requirement of record for what an app says about itself over time**: metrics, the tracing
stance, and the targets those numbers are judged against. It sits **above** the fleet's baseline
telemetry and does not restate it — structured stderr JSON, `Context` request-id correlation,
Sentry, the Discord leg and the scheduler heartbeat are owned by [[fleet-app-specification]] §5
and [[observability]]; queue age/depth is [[fleet-queue-doctrine]] §5; responding to what these
signals say is [[incident-response-template]]. Normative language per
[[fleet-app-specification]]: **MUST / SHOULD / MAY / ACCEPTED-DEVIATION**, deviations recorded
there, never silent. Values marked *recommended default* are site-specific — pick per app,
record the pick (§6).

## §1 The four laws

1. **Inside-out here, outside-in there.** This page owns what the app reports about itself from
   inside the process. Whether the app answers at all, from outside the cluster, is
   [[uptime-alerting-standard]]. The split is also the measurement contract: **availability's
   source of truth is the edge prober; latency's source of truth is the in-process histogram.**
   Never compute availability from your own metrics — a wedged pod exports nothing, and "no data"
   is not "no errors".
2. **Cardinality is the whole cost model.** Every distinct combination of label values is a
   separate stored series. Metrics are cheap only while their label sets are bounded and small;
   one unbounded label converts the metrics plane from an asset into an outage (§4).
3. **Alert on user-visible symptoms and budget burn, never on blips or resources.** CPU, memory
   and connection counts are *diagnosis* surfaces; they page nobody, and neither does a single
   bad minute.
4. **A target nobody wrote down is not an SLO.** Per-app availability and latency targets are
   recorded as config in the app's repo (§6). An unrecorded target is an opinion held during an
   incident, which is the worst possible time to form one.

## §2 The metrics plane — exposition, storage, exposure

- **Backend — MUST: Prometheus pull, with OpenTelemetry semantics as the naming vocabulary.**
  The cluster already runs Prometheus + Grafana + Loki; an app becomes observable by exposing a
  scrape endpoint, not by shipping telemetry anywhere. OTel is adopted as the *dictionary*
  (metric names, units, attribute names) without adopting its *pipeline* — see §9 for the full
  collector case and its revisit trigger.
- **Multi-process storage — MUST: a shared Valkey/Redis registry, never per-process memory.**
  A Laravel app is many short-lived PHP-FPM workers plus queue workers plus scheduled commands;
  an in-memory registry gives every scrape a different random worker's counters. The client of
  record is a Prometheus PHP client with the Valkey storage adapter
  (`promphp/prometheus_client_php`), pointed at the Valkey instance the app already runs for
  queues ([[fleet-queue-doctrine]] §2) on a **separate logical database or key prefix** so
  `queue:flush`-class operations can never wipe metrics. This is what makes the non-HTTP planes
  (workers, scheduler, console) exportable at all: they write to the registry, the web plane
  renders it.
- **Endpoint — MUST:** `GET /metrics`, Prometheus text exposition, on the app's own HTTP surface,
  and **not** on the public route surface: excluded from the ingress, reachable only on the
  internal Service, guarded by a bearer token from env (**`METRICS_TOKEN`** — **unset = the route
  is not registered**, the same inert-when-unset pattern as the heartbeat and the Discord leg),
  with a NetworkPolicy admitting only the monitoring namespace. `/metrics` **MUST be excluded
  from the RED instrumentation** (§3) — a 15-second scrape otherwise dominates the request
  stream it is supposed to measure.
- **Scrape config — MUST** ship with the app's chart (a `ServiceMonitor`/`PodMonitor` or the
  equivalent scrape annotations), so "is it being scraped?" is answerable in git. Identity labels
  — app, namespace, pod, env — come **from the scrape target, never from inside the metric
  name**: `__APP__` never appears in a metric name.
- **Sidecar exporters — MAY** where the numbers live outside PHP (Valkey, Postgres). Never
  hand-roll in PHP what a maintained exporter already publishes.
- **Testing — SHOULD:** one Feature smoke that `/metrics` renders and 404s without the token; the
  emitting seams are thin listeners/middleware, not unit-test targets
  ([[fleet-testing-doctrine]]). Asserting on registry contents in domain tests is a smell.

## §3 What to instrument

- **RED for every request-serving plane — MUST:** **R**ate, **E**rrors, **D**uration for HTTP
  requests *and* for queue-job handlers. Duration is always a **histogram**, never a
  pre-computed average or a gauge of "last request time" — a percentile you cannot recompute over
  an arbitrary window is not an SLI.
- **USE for infrastructure — MUST NOT re-implement.** Utilization/saturation/errors for nodes,
  pods, Valkey and Postgres are already published by the cluster's node, kube-state and service
  exporters. Consume them on dashboards (§7); own nothing.
- **Histogram buckets — MUST be explicit**, chosen to bracket the SLO threshold with buckets on
  both sides of it. *Recommended default (seconds):* `0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10`. A
  default bucket set that stops below your p99 makes your p99 a fiction.
- **The golden set — MUST export, every app:**

| Metric | Type | Labels | Why it is mandatory |
|---|---|---|---|
| `http_server_request_duration_seconds` | histogram | `route_class`, `method`, `status_class` | The latency SLI; rate and error-ratio derive from its `_count` by `status_class` — one metric covers all of RED for the web plane |
| `http_server_active_requests` | gauge | — | Web-plane saturation: the number that explains a latency cliff a CPU graph doesn't |
| `app_job_duration_seconds` | histogram | `job_class`, `queue`, `outcome` | RED for the queue plane — throughput, failure ratio and handler latency per job class. Queue **age/depth is not here**: it is [[fleet-queue-doctrine]] §5's exporter, unchanged |
| `app_scheduled_task_last_success_timestamp_seconds` | gauge | `task` | Per-task freshness. The heartbeat proves the *scheduler* ran; it cannot prove that one task inside it stopped succeeding |
| `app_outbound_call_duration_seconds` | histogram | `dependency`, `outcome` | Makes someone else's outage attributable in seconds instead of a bisect; pairs with the `outbound` partition |
| `app_domain_event_total` | counter | `event` (closed set) | The handful of business events whose *absence* is an incident (signups, payments, imports completing) — the signal that catches a silent break with green infra |
| `app_build_info` | gauge (=1) | `release` (git SHA) | Joins every metric shift to the deploy that caused it — the metrics twin of `SENTRY_RELEASE` ([[fleet-app-specification]] §5) and the source of deploy annotations |

- **Latency tripwires stay where they are.** `DB::whenQueryingForLongerThan` and the
  request/command lifecycle hooks are [[observability]]'s, routed through `report()`. Metrics
  answer "how often, how slow, trending which way"; the tripwires answer "here is the offending
  query, with context". Neither becomes the other.

## §4 Naming, labels, and cardinality discipline

- **Names — MUST:** OTel semantic-convention name where one exists, rendered snake_case with the
  unit suffix (`_seconds`, `_bytes`, `_total`). Fleet-specific metrics with no convention take
  the `app_` prefix. **Base units only** — seconds, not milliseconds.
- **`route_class`, never the path — MUST:** the Laravel **route name** (or a coarse grouping of
  them); unnamed routes bucket to `unnamed`. Raw URIs carry IDs, slugs and tenant subdomains, so
  a path label is an unbounded label wearing a disguise. Likewise `status_class` (`2xx`/`4xx`/
  `5xx`), not the exact status code, on the SLI histogram.
- **Forbidden labels — MUST NOT:** tenant id, user id, email, order/record id, request id, raw
  path or URL, exception message, SQL. Two independent reasons, both sufficient: **(a) cost** —
  a 5,000-tenant app crossed with route classes, status classes and histogram buckets produces
  millions of series, and Prometheus pays for every one for the whole retention window, so the
  first symptom is a monitoring outage during the incident you needed monitoring for; **(b)
  privacy** — a metric store is replicated, cached in dashboards and generally not access-
  controlled per series, so identifiers in labels are PII in the one system nobody threat-models.
- **The drill-down is Loki, not a label.** "Which tenant is slow?" is a log question: `Context`
  already carries tenant and principal identifiers per [[observability]] — correctly scoped,
  retained and searchable. Metrics tell you *that* and *how bad*; logs tell you *who*. A
  per-tenant SLO would be a contractual commitment; absent one, per-tenant series are cost
  without a consumer.
- **Budget — SHOULD:** keep each metric under ~100 series per pod, and treat any label whose value
  set is not enumerable at code-review time as a defect. A per-tenant or per-user label needs an
  ACCEPTED-DEVIATION entry, not a judgement call at 3am.
- **Exemplars — MAY** (where the cluster stores them): attach the request-id to histogram
  observations so a slow bucket is one click from its Loki line and Sentry event — the sanctioned
  way to get high-cardinality drill-down out of a low-cardinality metric.

## §5 Tracing — ruled, deliberately small

The fleet is a set of mostly-monolithic apps, not a service mesh. Tracing's payoff is
*cross-process attribution*, and inside one monolith there is almost nothing to attribute.

- **The default — MUST, and it already exists:** request-id `Context` correlation across logs and
  queued jobs, with the request-id mirrored into Sentry tags so the two planes join
  ([[observability]]). For a monolith this answers the question tracing is usually bought for:
  "what else happened during this request, including the jobs it spawned?"
- **In-request breakdown — MAY, and this is the app spec's APM dial:** Sentry performance tracing
  (`SENTRY_TRACES_SAMPLE_RATE` above zero, capped at `0.1` by [[fleet-app-specification]] §5,
  profiles off) gives per-request DB/HTTP/view spans. Enable per app **on a measured need**, not
  by default: it is billed per event and it samples, so it is a *diagnosis* tool and **MUST NOT**
  be the source of an SLI (§1 law 4 — sample-rate-dependent numbers cannot carry a target).
- **Full OpenTelemetry tracing — MAY, deferred.** Revisit trigger: a genuine multi-service call
  chain (a user-facing request crossing three or more independently deployed services), or a
  fan-out whose latency cannot be attributed from `app_job_duration_seconds` plus request-id
  correlation. Until one exists, a tracing backend is infrastructure to run for questions nobody
  is asking. When it comes, it layers **behind** `Context`, not instead of it.

## §6 SLOs and error budgets

- **Every app records two SLOs minimum — MUST:** availability and latency. *Recommended
  defaults:* **99.5% monthly availability**, measured **outside-in** by the edge prober
  ([[uptime-alerting-standard]] is the availability source of truth — §1 law 1), and
  **p95 < 500 ms / p99 < 1.5 s over 30 days** on the interactive `route_class`es of
  `http_server_request_duration_seconds`. Long-running exports and other known-slow route
  classes are excluded by class, explicitly, rather than by quietly widening the target.
- **Where targets live — MUST:** as config in the app's own repo, beside the alert rules that
  read them (§7), so the target, the rule and the dashboard cannot disagree. A target weaker than
  the recommended default is an **ACCEPTED-DEVIATION** entry in [[fleet-app-specification]] §7,
  never a silent edit.
- **Error budget framing.** Budget = `1 − SLO` over the window; 99.5% monthly is **216 minutes**.
  It is a spending allowance, not a failure count: a spent budget says stop shipping risk and fix
  reliability, and a budget untouched every month says the target is too loose to inform anything.
- **Paging rule — MUST: burn rate, multi-window.** Burn rate is the observed bad-event ratio
  divided by the budget ratio. *Recommended defaults:* **page** at burn rate ≥ **14.4 sustained
  over 1 hour** (2% of a monthly budget in an hour) confirmed by a 5-minute short window;
  **ticket** at ≥ **6 over 6 hours** or ≥ **1 over 3 days** (the slow leak that never trips a
  threshold and eats the month). Instantaneous-threshold paging is **MUST NOT** for SLOs — it is
  retained only where the symptom is binary and immediate: edge probe down
  ([[uptime-alerting-standard]]) and oldest-job age ([[fleet-queue-doctrine]] §5).
- **Not SLOs — MUST NOT page on:** CPU, memory, replica counts, cache hit ratio, queue *depth*.
  They are causes, and paging on causes is how a team learns to ignore its pager.
- **SHOULD, where the app has them:** queue timeliness (oldest-job age under its partition
  threshold for 99% of samples) and scheduled-task freshness (every critical task's last success
  within 2× its interval).

## §7 Dashboards and alerts as code

- **MUST: Grafana dashboards and alert rules are versioned in the app's repo** and provisioned
  from there. The Grafana UI is an **editor, not a store** — a panel built in the UI cannot be
  reviewed, diffed, or restored after a cluster rebuild. A UI edit is a draft; it lands in git or
  it did not happen.
- **The standard per-app dashboard skeleton — MUST**, one dashboard per app, these rows in this
  order, so any app's dashboard is legible to someone who has never seen that app: (1) **SLO
  header** — availability, latency percentiles, burn rate, budget remaining; (2) **HTTP RED** —
  rate, error ratio, p50/p95/p99 by `route_class`; (3) **Queue plane** — oldest-job age and depth
  per partition ([[fleet-queue-doctrine]] §5) plus `app_job_duration_seconds` by outcome;
  (4) **Dependencies** — `app_outbound_call_duration_seconds` by `dependency`/`outcome`;
  (5) **Scheduled work** — per-task freshness, heartbeat state; (6) **Errors & context** — Loki
  error-rate panel, link out to Sentry, and `app_build_info` as deploy annotations on every
  time-series panel.
- **Naming — SHOULD:** alert rules `<app>-<slo>-burn-<window>`, dashboards `<app> — Service
  Overview`, so an alert's name says which target it defends. **Alert routing** belongs to
  [[uptime-alerting-standard]] and the Discord leg ([[fleet-app-specification]] §5) — this page
  decides *what fires*, not *who is woken*.

## §8 Troubleshooting — symptom → cause → fix

| Symptom | Likely causes, in order | Fix |
|---|---|---|
| `/metrics` returns 200 but Grafana has no series | No scrape config shipped; NetworkPolicy blocks the monitoring namespace; scraper not sending the bearer token | Check Prometheus' target list **first** (it names the failure), then policy, then token |
| Counters sawtooth on deploys, or consecutive scrapes disagree | Per-process in-memory registry — each scrape hits a different PHP-FPM worker; pod churn | Valkey-backed registry (§2). `rate()`/`increase()` survive honest process restarts; they cannot survive per-worker registries |
| Prometheus slow, OOMing, queries timing out | An unbounded label — usually raw path, tenant, or an id | Find the offender by series count per metric; drop the label; drill down in Loki (§4) |
| Latency dashboard green, users report slowness | Averaging instead of percentiles; one high-volume fast route class swamping the aggregate | Percentiles per `route_class`, never a global mean (§3) |
| p99 pinned at a bucket edge or absent | Top bucket below the real tail — everything lands in `+Inf` | Explicit buckets bracketing the SLO threshold (§3) |
| Alert storm during every deploy | Rules on instantaneous error rate; restart-window blips | Burn-rate windows (§6); `app_build_info` deploy annotations to read the correlation |
| Heartbeat green, but a task silently stopped succeeding | The heartbeat proves the scheduler ran, not that each task worked | `app_scheduled_task_last_success_timestamp_seconds` per task (§3) |
| "Availability" metric disagrees with what users saw | Availability computed from in-process metrics — a dead pod exports nothing | Availability is outside-in only (§1 law 1, [[uptime-alerting-standard]]) |
| Error budget never moves | Target set below observed baseline; SLI counting the wrong events (`/metrics`, health probes, bots) | Retighten the target; exclude non-user traffic from the SLI stream (§2) |

## §9 Considered and rejected

- **Full OpenTelemetry collector pipeline** (app → OTLP → collector → backends) — the OTel
  *semantics* are adopted (§4); the *pipeline* is not. It adds a collector fleet to run and
  upgrade, plus a second delivery path for three signals that already have working ones (Loki,
  Sentry, scrape), while the PHP SDK pays a per-request export cost the pull model does not.
  **Revisit trigger:** §5's multi-service call chain, or a consumer that speaks only OTLP.
- **Prometheus Pushgateway** — built for batch jobs, but its series persist after the pusher dies
  (stale until deleted by hand), so "did the nightly job run?" becomes unanswerable exactly when
  the answer is no. The Valkey registry (§2) covers short-lived processes with correct lifecycle.
- **StatsD/DogStatsD sidecar** — UDP fire-and-forget, no exemplars, no histogram fidelity, one
  more container per pod, all to solve what the shared registry already solves.
- **Laravel Pulse / Nightwatch** — already ruled at [[observability]]; nothing here changes it.
- **Per-tenant metrics and dashboards** — §4's cardinality bomb, serving log and analytics
  questions, against SLOs nobody has contracted.
- **Instantaneous-threshold alerting as the primary SLO rule** — precisely what burn-rate paging
  replaces (§6); kept only for the two binary symptoms named there. Likewise **the Grafana UI as
  dashboard of record** (undiffable, unrestorable — §7) and **APM as an SLI source** (sampled
  traces cannot carry a target — §5; they diagnose what the histograms detect).
