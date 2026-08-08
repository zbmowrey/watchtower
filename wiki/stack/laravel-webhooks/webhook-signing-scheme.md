---
title: Webhook Signing Scheme — HMAC Construction, Rotation, Verification
description: The normative signing scheme for fleet outbound webhooks — the single effect-bound, newline-delimited HMAC-SHA256 construction every request signs ({timestamp}\n{METHOD}\n{request_target}\n{raw_body}, the body segment empty for bodyless verbs), the X-Webhook-Signature header grammar (t= and v1= elements), the per-Target secret lifecycle (server-generated, shown once, encrypted at rest, never retrievable), rotation with its 0–24-hour overlap parameter and the overlap-zero compromise procedure, the additional per-Target auth options, and the receiver-side verification requirements. Every signature fact in the webhook corpus lives here as the single normative owner; the republished receiver guide carries a complete inline restatement for its external audience, kept consistent with this page — every change here is mirrored there.
tags: [stack, webhooks, laravel, security, signing, hmac, secrets]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-receiver-guide, webhook-egress-guards, webhook-threat-model, webhook-delivery-model, webhook-management-surface]
---

# Webhook Signing Scheme — HMAC Construction, Rotation, Verification

Fleet norms → [[fleet-webhook-specification]] §4. This page owns the signature: what is signed,
how the header is built, how secrets live and rotate, and what a correct receiver does. Worked
verification code in the customer's hands is [[webhook-receiver-guide]]'s job — and because
its republished audience cannot open wiki pages, that guide deliberately carries a **complete
inline restatement** of the construction, header grammar, tolerance, and rotation behavior.
This page remains the single normative owner: every change to the construction, header
grammar, tolerance, or rotation semantics here MUST be mirrored into
[[webhook-receiver-guide]]. The `t=`/`v1=` grammar deliberately mirrors
Stripe's — the explicit DX bar for this system — so receivers arrive pre-trained; the signed
material deliberately does not (the Stripe-exact recipe is recorded as considered-and-rejected
in [[fleet-webhook-specification]]).

## The signed material

Every delivery attempt is signed with **HMAC-SHA256** over **one construction, for every verb**:

```text
{t}\n{METHOD}\n{request_target}\n{raw_body}
```

Four segments, joined by single newlines — each `\n` above is one literal LF byte (0x0A), and
receivers build the string with a single join on `"\n"`:

- **`t`** — the attempt's Unix-seconds timestamp.
- **`METHOD`** — the HTTP method, uppercase.
- **`request_target`** — the request target exactly as sent: the absolute path plus the literal
  query string including its `?` when one is present, with no normalization.
- **`raw_body`** — the exact body bytes as they leave the wire (post-template render, no
  re-encoding, no trailing-newline massage). For bodyless requests (GET, DELETE) the segment is
  **empty**: the signed material ends with its third newline.

The construction is **effect-bound**: the method and the addressed resource sit inside the
MAC. Cross-verb and cross-path replay are closed outright — a captured signature can never
verify as a different method or against a different request target. The newline join makes
the construction **injective**: `t` is decimal digits, `METHOD` is uppercase letters, and a
request target cannot contain a raw CR or LF (RFC 3986 forbids control characters in a
request target), so none of the three leading fields can contain the delimiter — and
`raw_body`, the only segment free to contain newlines, is the final field. Distinct
(timestamp, method, target, body) tuples therefore always produce distinct signed strings;
no field-boundary splice exists. And it is **one namespace**: a single construction for
bodied and bodyless requests alike leaves no cross-construction ambiguity for an attacker to
steer a receiver into.

The HMAC key is the ASCII bytes of the secret exactly as displayed (see lifecycle below) — no
decoding step, because every decode step is a receiver bug waiting to happen. The output is
**lowercase hex**.

Binding `t` inside the MAC (rather than sending it as a mere header) means an attacker cannot
graft a captured signature onto a fresh timestamp; the signature and its timestamp stand or fall
together. Each **Attempt is signed independently at send time** with a fresh timestamp — a retry
hours into the schedule (→ [[webhook-delivery-model]]) carries a new `t` and a new signature, so
receiver timestamp tolerance never rejects a legitimate retry.

Headers are **outside the signed material** — including the test-fire and replay marker headers
(→ [[webhook-delivery-model]]). Their integrity rides TLS ([[webhook-egress-guards]]), not the
HMAC: the signature authenticates the sender and the request's effect — method, target, body —
never its headers.

## The header

```
X-Webhook-Signature: t=1786197787,v1=f4f248713918e3f6226093e1a56f12a20b3957eec9a25b24c2aa906bf0df46e9
```

Grammar: comma-separated `key=value` elements, no whitespace. `t` appears exactly once and
first; `v1` appears **once per currently-signing secret** — one in steady state, two during a
rotation overlap (newest first):

```
X-Webhook-Signature: t=1786197787,v1=<sig-with-new-secret>,v1=<sig-with-old-secret>
```

`v1` names the scheme itself — HMAC-SHA256 over the material defined above. A future scheme
change ships as a new element prefix (`v2=`) sent alongside `v1`; `v1` is retired only as a
breaking, announced change to webhook owners. Receivers **MUST ignore elements they do not
recognize**; that forward-compatibility rule is what makes a scheme upgrade non-breaking.

## Secrets — scope and lifecycle

- **Scope: per Target.** All Webhooks under a Target sign with the Target's secret. The receiver
  is the Target — one endpoint owner installs one secret and rotates once, not once per
  subscription. (Entity definitions → [[webhook-data-model]].)
- **Generation is server-side only** — `random_bytes(32)`, never user-supplied, never derived.
  User-supplied secrets import the user's entropy habits; 32 CSPRNG bytes import none.
- **Presentation:** the secret is displayed as `whsec_` followed by the base64url encoding of the
  32 bytes, and the HMAC key is that full displayed string's ASCII bytes. The prefix makes leaked
  secrets greppable by secret scanners and instantly recognizable to anyone who has integrated
  Stripe.
- **Shown once** — at creation and at each rotation. After that moment no surface returns it:
  no API field, no UI reveal, no support path. The two responses that do carry it are
  `Cache-Control: no-store` and excluded from body logging and APM capture
  (→ [[webhook-management-surface]]). The management surface shows possession metadata
  (created/last-rotated timestamps) only, and attempt drill-downs mask auth-sourced header
  values (the inventory, below). Non-retrievability caps the blast radius of a
  leaked management credential at *rotate* — a loud, audited action — never *read*.
- **Storage:** Laravel `encrypted` cast on the Target row. Key custody and secrets law are
  [[fleet-app-specification]]'s domain; nothing here weakens it.

## Rotation

Rotation is an **explicit action** on the Target (API + UI → [[webhook-management-surface]]),
never automatic and never silent:

1. The replacement secret is generated and **shown once**.
2. For the **overlap window** — an optional parameter on the rotate action, **0–24 hours,
   default 24** ([[webhook-management-surface]] carries the API surface) — both secrets sign
   every attempt: the header carries two `v1` elements, newest first. The receiver installs the
   new secret at any point in the window with zero dropped deliveries, because verification
   accepts *any* matching `v1`.
3. When the overlap expires the old secret is deleted and its `v1` disappears from the header.
4. Rotating again while an overlap is still open retires the oldest secret **immediately** — at
   most two secrets ever sign at once.

Every rotation lands in the audit trail (structured log + actor attribution →
[[webhook-management-surface]]). **On suspected compromise the procedure is rotation with
overlap 0** — the documented compromise response: the old secret expires immediately, nothing
signs with it again, and deliveries fail verification at the receiver until the new secret is
installed. That trade is the point — the compromised-key window closes at the cost of a
coordinated update instead of a leisurely one. The default 24-hour overlap is for routine
hygiene; a receiver that wants to slam the door from its own side can also delete the old
secret from its own config immediately.

## Additional per-Target auth

Signing is always on; these are **additive** options for receivers that gate traffic at a proxy,
gateway, or WAF before any signature-verifying code runs. Configured per Target, all values
stored with the same `encrypted` cast and masked in history:

- **Static bearer token** — sent as `Authorization: Bearer <value>`.
- **Basic auth** — username + password, sent as `Authorization: Basic <base64>`.
- **Custom secret header** — a user-chosen header name carrying a secret value.

None of these substitutes for signature verification: a static credential proves possession at
config time, not authorship of this request. mTLS and OAuth2 client-credentials are **deferred**,
not rejected — scope ruling in [[fleet-webhook-specification]].

## Masked-value inventory

The values masked (`***`) at write time in attempt history and every surface reading it —
drill-downs, exports, the `/control` plane ([[webhook-management-surface]]; storage rules
[[webhook-data-model]]):

- the `Authorization` header value under the static-bearer option;
- the `Authorization` header value under the basic-auth option;
- the custom secret header's value.

The `X-Webhook-Signature` header is **expressly excluded**: an HMAC digest is derived, not
reversible, and stays visible in full — seeing it never yields the secret.

The inventory is deliberately scoped to **auth-sourced values**. A capability URL stored as a
Target's base path — a Slack or Discord incoming-webhook URL — is a bearer credential the
inventory does *not* cover: `target_url` displays unmasked to every `webhooks:read` holder and
to `/control` support ([[webhook-threat-model]] I-6). A secret that must stay masked belongs
in the custom-secret-header option above, never in the URL.

## Receiver-side verification requirements

The normative checklist — [[webhook-receiver-guide]] turns it into runnable code:

1. **Capture the raw body bytes** before any framework parsing. A re-serialized parse of the
   JSON is not the signed material; one reordered key or re-escaped character fails the MAC.
2. Require `X-Webhook-Signature`; treat a missing or unparseable header as a rejected request.
3. **Enforce timestamp tolerance:** reject when `|now − t|` exceeds **5 minutes**. This bounds
   the replay window for a captured request.
4. Build the expected material **using the header's `t`**, not the local clock:
   `{t}\n{METHOD}\n{request_target}\n{raw_body}` — one join on `"\n"` — with the body segment
   empty for GET/DELETE: the material then ends with its third newline. The request target is
   compared byte-for-byte as received: capture it ahead of any gateway or framework rewriting.
5. Compute HMAC-SHA256 with each secret on file and compare against each `v1` using a
   **constant-time comparison** — `hash_equals()` in PHP. Accept when any pair matches. Ordinary
   string comparison short-circuits at the first differing byte and leaks a timing oracle.
6. Derive **no authenticity decision from headers** — they are outside the signed material.
   That includes the test/replay markers and `X-Webhook-Id`: treat them as advisory
   (the receiver-facing caveat is spelled out in [[webhook-receiver-guide]]).
7. Verify **before** doing any work, then dedupe by envelope `id` (envelope shape →
   [[webhook-event-catalog]]; dedupe and respond-fast advice → [[webhook-receiver-guide]]).
   Test-fire and replay deliveries verify identically — markers change nothing about the
   signature.

## Enforcement

Signature generation is covered by bootless, branch-complete unit tests — the construction
across every verb (rendered body and empty body segment alike), the rotation dual-sign, the
overlap-zero immediate expiry, header rendering — per the testing obligations in
[[fleet-webhook-specification]] and [[fleet-testing-doctrine]]. The signer and a reference PHP
verifier land in [`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle,
future pass). The threats this scheme answers, and the layers that back it, are mapped in
[[webhook-threat-model]].
