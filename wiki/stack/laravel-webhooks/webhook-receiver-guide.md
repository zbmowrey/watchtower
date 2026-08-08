---
title: Webhook Receiver Guide — Verifying and Handling Deliveries
description: The customer-facing integration guide for receiving webhooks from a fleet app, written to the external developer at the Stripe-docs bar — what a delivery looks like on the wire, step-by-step signature verification with a complete worked PHP example and a Node sketch, respond-fast-then-process and dedupe-by-event-id guidance, retry behavior from the receiver's seat, test-fire and ping expectations, and a troubleshooting table. Shows worked examples only; the normative signature construction is owned by webhook-signing-scheme and the normative delivery numbers by webhook-delivery-model. Apps republish this text, branded, through their generated public webhook docs.
tags: [stack, webhooks, laravel, receiver, integration, security]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-signing-scheme, webhook-delivery-model, webhook-event-catalog, webhook-egress-guards]
---

# Webhook Receiver Guide — Verifying and Handling Deliveries

> **Wiki note (maintainers only — not part of the republished text).** This page is the fleet's
> canonical receiver-facing text, written to the external developer ("you") with `acme` standing
> in for the sending app. Apps republish it, branded, through their generated webhook docs
> ([[webhook-management-surface]]). Because the republished audience cannot open wiki pages, the
> reader-facing text below is self-sufficient — it inlines every fact a receiver needs and
> carries no internal links. The normative owners it is kept consistent with: signature
> construction → [[webhook-signing-scheme]]; delivery numbers and retry behavior →
> [[webhook-delivery-model]]; retention → [[webhook-data-model]]; envelope and versioning →
> [[webhook-event-catalog]]; egress rules → [[webhook-egress-guards]].

When something happens in acme — an invoice is paid, a service request is created — we send your
endpoint an HTTP request describing the event. This guide covers everything you need to receive
those requests safely: what arrives on the wire, how to verify it came from us, how to respond,
and what our retry machinery does when you don't.

## What a delivery looks like

Unless your webhook was configured with a custom template, a delivery is an HTTPS `POST` with a
JSON body — the **event envelope**:

```http
POST /webhooks/acme HTTP/1.1
Host: example.com
Content-Type: application/json
X-Webhook-Id: 019fd67b-2578-73c1-9f4d-3b8a12e90d55
X-Webhook-Signature: t=1786197787,v1=f4f248713918e3f6226093e1a56f12a20b3957eec9a25b24c2aa906bf0df46e9
```

```json
{
  "id": "019fd67b-2578-73c1-9f4d-3b8a12e90d55",
  "type": "invoice.paid",
  "schema_version": 1,
  "occurred_at": "2026-08-08T14:03:07.123456Z",
  "data": {
    "invoice": {
      "id": "019fd679-b1e2-7f60-8a3d-55c2b7e01f9a",
      "number": "INV-2041",
      "status": "paid",
      "amount_minor": 4999,
      "currency": "USD",
      "paid_at": "2026-08-08T14:03:06.998877Z"
    }
  }
}
```

The envelope fields:

- **`id`** — a unique, stable identifier for the event (UUIDv7, so ids sort by creation time).
  Retries and replays of the same event carry the **same** `id`; it is your deduplication key.
- **`type`** — the event name in `entity.verb` form: `invoice.paid`, `service_request.created`.
  The full catalog for your integration, with payload schemas and sample payloads, is published
  in the sending app's webhook docs.
- **`schema_version`** — the global envelope schema version this event was emitted under, an
  integer. Additive payload changes (new fields)
  never bump it; you must tolerate unknown fields. A bump marks a breaking change — rare,
  deliberate, and announced to webhook owners. Compare each envelope's value against the version
  documented when your webhook was configured; a higher number tells you the shape may have
  changed out from under your parser.
- **`occurred_at`** — when the fact happened, RFC 3339 UTC with a `Z` suffix. The payload is a
  snapshot taken at that moment, not a live read: a retry delivered a day later still describes
  the world as it was when the event occurred.
- **`data`** — the event payload.

One header arrives on **every** delivery, and two markers appear in specific situations (their
absence means a normal delivery):

- **`X-Webhook-Id`** — the envelope `id`, present regardless of how the webhook is configured.
  If a custom template omits the `id` from the body, or the delivery has no body at all, this
  header still carries your dedupe key.
- **`X-Webhook-Test: true`** — a test fire triggered by hand from the sender's dashboard. The
  `type` is the real event type; the payload may be a sample.
- **`X-Webhook-Replay: true`** — a deliberate re-send of an earlier event, same `id`.

These headers are **not covered by the signature** — their integrity rides TLS only. Treat them
as advisory context, never as an authentication input (more under "Test fires and pings").

Not every integration is JSON. A webhook configured with a template may deliver
`application/x-www-form-urlencoded` or raw text instead, and webhooks configured with `GET` or
`DELETE` send no body at all — the event data can ride in the path and query string, as
configured by the sender. One signature construction covers all of these; a bodyless delivery
simply signs an empty body segment (shown below).

## Verify the signature

Every delivery is signed with **HMAC-SHA256** using your endpoint's signing secret. The secret is
generated when your receiving system (the *Target*) is registered, shown exactly once, and never
retrievable again — store it in your secret manager. If you lose it, rotate.

Your secret looks like `whsec_…`. Use the **entire displayed string — including the `whsec_`
prefix — as the HMAC key exactly as shown**; do not strip the prefix and do not base64-decode
any part of it. The signatures you compare against are lowercase hex.

The `X-Webhook-Signature` header carries a Unix timestamp and one or more hex signatures:

```text
X-Webhook-Signature: t=1786197787,v1=f4f24871…46e9
X-Webhook-Signature: t=1786197787,v1=f4f24871…46e9,v1=ba20d7ac…3554   ← during secret rotation
```

Verification is four steps — the complete recipe.

1. **Parse the header.** Extract `t` and every `v1` value. Ignore any elements you do not
   recognize — future scheme versions add new prefixes (e.g. `v2=`) alongside `v1`, and your
   parser must not treat them as errors.
2. **Check the timestamp.** Reject if `t` is more than 5 minutes from your clock, in either
   direction. This bounds replay of captured requests. Every attempt — including a retry hours
   or days into the schedule — is signed at send time with a fresh timestamp, so this
   tolerance never rejects a legitimate retry; do not widen it to accommodate retries.
3. **Rebuild the signed string.** The same four newline-joined segments for every delivery:
   `{t}\n{METHOD}\n{request_target}\n{raw_body}` — the header's timestamp, the uppercase HTTP
   method, the request target exactly as received (path plus query string, details below), and
   the raw request bytes exactly as received, never a parsed-and-re-serialized body, joined by
   single `\n` (LF) bytes — one join on `"\n"`. For `GET` and `DELETE` deliveries the body
   segment is empty, so the string ends with a trailing newline.
4. **Compare in constant time.** Compute HMAC-SHA256 of the signed string with your secret and
   compare the lowercase-hex digest against **each** `v1` value using a constant-time
   comparison. Accept if any one matches.

One nuance before the code: a `4xx` rejection other than `429` is **never retried** (see the
retry section below). If you want transiently-failing verifications — clock skew, for
instance — to be
retried, respond `5xx` for timestamp-tolerance failures and reserve `400` for structurally
invalid signatures. The examples below return `400` for both, the simple posture.

### PHP — complete worked example

```php
<?php

declare(strict_types=1);

/**
 * Verify an acme webhook delivery.
 *
 * @param string $method          The HTTP method of the request.
 * @param string $requestTarget   Path + query string, byte-for-byte as requested.
 * @param string $rawBody         Request body, byte-for-byte as received ('' when bodyless).
 * @param string $signatureHeader The X-Webhook-Signature header value.
 * @param string $secret          Your signing secret for this endpoint.
 */
function verify_webhook(
    string $method,
    string $requestTarget,
    string $rawBody,
    string $signatureHeader,
    string $secret,
    int $tolerance = 300,
): bool {
    $timestamp = null;
    $candidates = [];

    foreach (explode(',', $signatureHeader) as $pair) {
        [$key, $value] = array_pad(explode('=', trim($pair), 2), 2, '');

        if ($key === 't') {
            $timestamp = (int) $value;
        }

        if ($key === 'v1' && $value !== '') {
            $candidates[] = $value;
        }
    }

    if ($timestamp === null || $candidates === []) {
        return false; // Malformed header.
    }

    if (abs(time() - $timestamp) > $tolerance) {
        return false; // Outside the ±5-minute window: possible replayed capture.
    }

    $signedPayload = implode("\n", [$timestamp, strtoupper($method), $requestTarget, $rawBody]);
    $expected = hash_hmac('sha256', $signedPayload, $secret);

    foreach ($candidates as $candidate) {
        if (hash_equals($expected, $candidate)) {
            return true; // Current secret, or the previous one during rotation.
        }
    }

    return false;
}

// Wiring. Two raw values are the whole game: the body before anything parses it,
// and the request target before anything rewrites it.
$method = $_SERVER['REQUEST_METHOD'];
$requestTarget = $_SERVER['REQUEST_URI'];    // Path + query, exactly as requested.
$rawBody = file_get_contents('php://input'); // '' on GET/DELETE — exactly what was signed.
$header = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$secret = $_ENV['ACME_WEBHOOK_SECRET']; // From your secret store, never hardcoded.

if (! verify_webhook($method, $requestTarget, $rawBody, $header, $secret)) {
    http_response_code(400);
    exit;
}

// GET/DELETE deliveries carry no body to decode — event data rides in path/query as configured.
$event = $rawBody === '' ? null : json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);

// Acknowledge now, process later — see "Respond fast, then process".
enqueue_for_processing($event); // Your queue, your worker.
http_response_code(200);
```

If your receiver is a Laravel app, `$request->getContent()` returns the raw body and
`$request->getRequestUri()` the raw request target; exclude the webhook route from CSRF
verification and run your signature check in middleware, before any `FormRequest` touches the
input.

### Node.js — sketch

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhook(method, requestTarget, rawBody, signatureHeader, secret, tolerance = 300) {
  let timestamp = null;
  const candidates = [];

  for (const pair of signatureHeader.split(",")) {
    const [key, value] = pair.trim().split("=", 2);
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) candidates.push(value);
  }

  if (!Number.isInteger(timestamp) || candidates.length === 0) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > tolerance) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}\n${method.toUpperCase()}\n${requestTarget}\n`)
    .update(rawBody) // rawBody: the exact bytes (Buffer or string) — empty for GET/DELETE — hashed directly, never re-encoded.
    .digest();

  return candidates.some((candidate) => {
    const provided = Buffer.from(candidate, "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}
```

In Express, mount the raw-body parser on the webhook route so `req.body` is a `Buffer`, pass
`req.originalUrl` (the un-rewritten path + query) as the request target, and verify before you
`JSON.parse`. Two wiring details matter: register the route for the verb your webhook is
configured to send — `app.post` below; use `app.delete`, `app.get`, or `app.all` for other
verbs — and normalize `req.body` before verifying, because on a request with no body
`express.raw` leaves `req.body` as `{}`, not a `Buffer`:

```js
app.post("/webhooks/acme", express.raw({ type: "*/*", limit: "10mb" }), (req, res) => {
  // Bodyless deliveries leave req.body as {} — normalize to the empty Buffer, which is what was signed.
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!verifyWebhook(req.method, req.originalUrl, body, req.get("X-Webhook-Signature") ?? "", secret)) {
    return res.sendStatus(400);
  }
  const event = body.length ? JSON.parse(body) : null; // No body to parse on GET/DELETE deliveries.
  enqueueForProcessing(event);
  res.sendStatus(200);
});
```

Note the `limit`: body-parser's default is 100kb. Payloads have no size cap on our side — raise
your body-size limit accordingly, because a `413` is a terminal `4xx` and the delivery will not
be retried.

### The request target, byte for byte

The signed request target is the absolute path plus the literal query string, and the `?`
appears only when a query string exists. Compare **byte-for-byte** — no percent-decoding, no
normalization. The raw request target is `$_SERVER['REQUEST_URI']` in PHP and `req.originalUrl`
in Express. Beware of proxies: the request target is signed on **every** delivery, so anything
that rewrites it before your handler sees it breaks verification for every verb — path
rewriting, but just as fatally query-string reordering, re-encoding of reserved characters, and
parameters added or stripped by load balancers, API gateways, and WAFs. Capture the raw request
target ahead of any gateway normalization, and if you must sit behind a rewriting layer, verify
against the target as it arrived at your edge, not as your framework re-assembled it.

### Bodyless deliveries (GET and DELETE)

A webhook configured with `GET` or `DELETE` sends no body, and there is no separate recipe: the
signed string is the same four segments with an empty final segment, so it ends with a trailing
newline. Written with visible `\n` escapes — each is one literal LF byte:

```text
1786197787\nGET\n/inventory/sync?sku=WIDGET-1&event=019fd67b-2578-73c1-9f4d-3b8a12e90d55\n
```

In PHP the recipe above handles this with no extra code — `php://input` reads as the empty
string, which is exactly what was signed. In Express, mind the normalization already shown in
the wiring: `express.raw` yields an empty `Buffer` only when the request carries
`Content-Length: 0` — a bodyless `GET`/`DELETE` normally carries no body headers at all, so
`req.body` stays `{}`, and hashing that throws; the one-line `Buffer.isBuffer` normalization
turns it into the empty `Buffer` that was signed. Remember also to register the route for the
verb your webhook sends (`app.get`, `app.delete`, or `app.all`) — a handler mounted only with
`app.post` never sees a `GET` or `DELETE` delivery.

### Secret rotation

When the sender rotates your secret, both the old and the new secret sign every delivery for an
overlap window — up to 24 hours, and 24 by default — which is why the header can carry two `v1`
values. Because the recipes above accept a match against **any** `v1`, rotation needs nothing
special from you beyond updating your stored secret promptly: during the overlap the old secret
still matches, and after you switch, the new one does. If the overlap lapses before you update,
every delivery starts failing verification — rotate again and update immediately. One case is
deliberately abrupt: a rotation performed in response to a suspected compromise carries **no
overlap** — the old secret stops working the moment the new one is issued, so expect failures
until you install it.

## Respond fast, then process

Return a `2xx` as soon as you have verified and durably captured the event, and do the real work
afterward, on your own queue. Any `2xx` counts as success; the status code and body are recorded
in the sender's delivery history (bodies truncated for storage) but otherwise ignored.

Our patience is bounded: the connection and the total request each have a hard timeout budget —
5 seconds to connect, 15 seconds end to end.
An endpoint that parses, verifies, writes one row, and returns `200` fits comfortably. An
endpoint that calls three downstream services inline does not, and every timeout counts as a
failed attempt against your webhook's health.

The decision matrix for your response:

| You want | Respond with |
|---|---|
| Accepted — never send this delivery again | Any `2xx` |
| Transient problem — retry later | `5xx`, or `429` if you are shedding load |
| Permanent rejection — do not retry this delivery | Any `4xx` except `429` |

## Deduplicate by event id

Delivery is **at least once**. You will occasionally receive the same event twice: a retry after
your `2xx` was lost in transit, or a deliberate replay from the sender's dashboard. Both carry
the same envelope `id`, so idempotent processing is one uniqueness check away:

1. Before processing, insert the event `id` into a dedupe store with a unique constraint (a
   database table or a set in your cache).
2. If the insert conflicts, acknowledge with `2xx` and stop — you have already processed it.

The `id` reaches you two ways. Prefer it from the **signed material** — the envelope body by
default, or wherever the sender's configuration placed it: body, path, or query string, all of
which sit inside the signature on every delivery. A signed copy always exists; the sender's
platform refuses to save a webhook configuration without one. The `X-Webhook-Id` header is the
always-present convenience copy: it carries the same id on every delivery, but like all headers
it sits outside the signature, so its integrity rides TLS rather than the HMAC.

Keep dedupe entries at least as long as the sender retains events, since a replay can arrive well
after the original delivery — 30 days by default.

Ordering is likewise not guaranteed: two events emitted close together can arrive in either
order, and a retried event arrives long after its successors. Use `occurred_at` (and the
time-ordered `id`) to decide staleness, and treat each payload as a snapshot of the moment the
event occurred rather than the latest state.

## Our retry behavior, from your seat

When a normal delivery to your endpoint fails, we retry — up to 8 attempts spread over roughly
1.7 days (approximately 0s, 30s, 2m, 10m, 1h, 4h, 12h, 24h, with jitter). The schedule is
fixed — a `Retry-After` header on your `429` is recorded in delivery history but does not
change when we retry. Each retry is signed afresh at send time, so its timestamp is always
current (see "Check the timestamp" above).
Test fires and verification pings are the exception: single attempts, never retried (below).
What triggers a retry:

- **Retried:** `429`, any `5xx`, connection failures, and timeouts.
- **Terminal, no retry:** any other `4xx` — we take `400`, `401`, `404`, `410`, `422` and kin as
  "this delivery will never succeed."
- **Terminal, no retry:** any `3xx`. **Redirects are never followed.** If your endpoint moves,
  update the webhook's URL in the sender's dashboard; a `301` kills the delivery.

Sustained failure eventually disables the webhook: after 20 consecutive failed deliveries or
3 days in which everything failed, it flips to
`disabled` and the owner is notified by email. Nothing is lost — events continue to be recorded
while the webhook is disabled. To recover: fix your endpoint, re-enable the webhook in the
dashboard, then replay the gap from delivery history. Re-enabling is always a manual, deliberate
act; we never silently resume.

## Test fires and pings

- **Verification ping.** Before any webhook on a newly registered Target can activate, a `ping`
  event must succeed against it once. The verification ping is a signed `POST` of the ping
  envelope to your Target's **base URL** (scheme + host + base path, without any per-webhook
  path extension) — that URL must answer `2xx`. Verification can also be satisfied by a
  successful ping test-fire through a configured webhook, which uses that webhook's method and
  path. `ping` is a real, signed delivery with an (essentially empty) payload; answer it with a
  `2xx` like anything else. `ping` exists in every event catalog, so you can also use it any
  time as a connectivity check.
- **Test fires.** Anyone configuring the webhook can hand-fire a subscribed event type from the
  sender's dashboard, optionally editing the sample payload first. Test fires are real HTTP
  deliveries — signed, templated, and recorded in history — distinguished only by the
  `X-Webhook-Test: true` header. The `type` is **not** rewritten, so your normal handler path
  runs. Verify the signature exactly as usual. A caution on the marker: `X-Webhook-Test` is not
  covered by the signature (its integrity rides TLS only), so treat it as advisory — if you
  suppress side effects on test deliveries, understand that a stripped or injected marker
  changes your behavior; the safe pattern is processing every verified delivery on the
  identical code path. Either way, return a `2xx` so the person testing sees a green check.
- **No retries.** Test fires and verification pings are single attempts and are never retried —
  if one fails, fix the endpoint and fire again.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every signature fails | You are verifying a parsed-then-re-serialized body. Key order, whitespace, and unicode escaping all change the bytes, and the signature covers the bytes. | Verify against the raw request body, captured before any body parser runs. |
| Every signature fails, raw body is correct | You decoded or truncated the secret. | Use the whole `whsec_…` string — prefix included — as the HMAC key; never base64-decode or trim any part of it. |
| Signatures fail in one framework only | Middleware mutated the body before you read it: body parsers, gzip decompression, charset re-encoding, trailing-newline trims. | Capture the raw body ahead of the parser (`php://input`, `$request->getContent()`, `express.raw`). |
| Computed digest never matches anything | Wrong string construction: a missing segment, wrong order, a lowercased method, or a trailing newline dropped on a `GET`/`DELETE` delivery. | Every delivery signs `{t}\n{METHOD}\n{request_target}\n{raw_body}` — four newline-joined segments, method uppercase, raw request target, exact body bytes; when the body is empty the string still ends with its third `\n`. |
| Signatures fail intermittently or only in one environment | A load balancer, API gateway, or WAF is normalizing the request target: rewriting the path, reordering or re-encoding the query string, or adding/stripping parameters. The request target is signed on every delivery, so this breaks every verb. | Capture the raw request target ahead of the gateway's normalization and verify those bytes; exempt the webhook route from rewrite rules. |
| Signatures started failing at a known moment | Your stored secret is stale. Rotation signs with both secrets for the overlap window — 24 hours by default, none at all when the sender rotates in response to a compromise — then the old secret stops working. | Update to the new secret when it is issued; verify against every `v1` value in the header. |
| Signatures fail intermittently, digest is correct | Server clock skew pushing valid timestamps outside the ±5-minute tolerance. | Run NTP; check the gap between `t` and your clock when rejecting — and note that deliveries you rejected during the skew window were terminally failed (a `400` is never retried): replay them from the sender's dashboard after fixing NTP. |
| One endpoint works, another rejects everything | Wrong secret: secrets are per Target, and a secret copied from another Target (or pasted with whitespace) will never match. | Use the secret issued for this Target; if it was lost, rotate to get a fresh one. |
| Deliveries time out | Your handler does the work inline and blows the 15-second total budget. | Return `2xx` immediately after verify-and-persist; process on a queue. |
| Connection timeouts | Slow DNS, slow TLS handshakes, or cold starts against the 5-second connect budget. | Keep the endpoint warm; fix DNS; terminate TLS near the edge. |
| Deliveries stopped arriving entirely | The webhook auto-disabled after sustained failure and the owner was emailed. | Fix the endpoint, re-enable in the dashboard, replay the gap — events are still recorded while disabled. |
| Duplicate events | At-least-once delivery: a retry after a lost acknowledgment, or a deliberate replay. | Idempotent processing keyed on envelope `id` (see above). |
| Deliveries die after you moved the endpoint | Redirects are never followed; a `3xx` is terminal. | Update the webhook URL in the sender's dashboard instead of redirecting. |
| Endpoint can never be reached during setup | Production egress is HTTPS to public hostnames on port 443 only: plain HTTP, raw IPs, and private-network addresses are refused. | Serve HTTPS on 443 at a publicly resolvable hostname; use a tunnel for local development. |

## Endpoint checklist

- Serve HTTPS on port 443 at a public hostname; never answer with a redirect.
- Verify every delivery: raw body and raw request target, timestamp within tolerance,
  constant-time compare, accept any `v1`.
- Return `2xx` fast; queue the real work.
- Deduplicate by envelope `id`; tolerate out-of-order arrival and unknown payload fields.
- Answer `ping` and test fires with `2xx`.
- Watch your own error and latency rates so a retry storm or auto-disable never surprises you.
