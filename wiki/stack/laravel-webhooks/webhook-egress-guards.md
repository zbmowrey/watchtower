---
title: Webhook Egress Guards — the SSRF Defense Set
description: The complete SSRF guard set for the outbound webhook engine — HTTPS-only in production, the global-unicast-only destination rule with the full blocked-range table (private, loopback, link-local, cloud metadata, and kin), DNS-resolution pinning, redirect refusal, the port allow-list, raw-IP denial, and userinfo/fragment rejection — each with the reason it exists, plus the enforcement points and the single config-gated local-dev carve-out with its webhooks.egress.local_ports list (default [80, 443], never consulted in production). This page owns the guard list; the threat mapping lives in the threat model.
tags: [stack, webhooks, laravel, security, ssrf, egress]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-threat-model, webhook-signing-scheme, webhook-delivery-model, defense-in-depth-model]
---

# Webhook Egress Guards — the SSRF Defense Set

Fleet norms → [[fleet-webhook-specification]] §4. A webhook engine is a server that makes HTTP
requests to URLs its users typed in — in most SSRF write-ups the attacker-controlled URL is an
incidental input bug; here it is the product. The posture is therefore **relax nothing**: every
guard below applies to every attempt, and the only softening anywhere is the single, config-gated,
production-inert local-dev carve-out at the end. The STRIDE view of what these guards defeat is
[[webhook-threat-model]]; this page owns the guard list itself.

## The guard set

| Guard | Rule | Why |
|---|---|---|
| HTTPS only | `https://` is the only scheme in production; TLS certificate verification is never disabled, anywhere. | Payloads are business data and per-Target credentials ride in headers that the signature does not cover ([[webhook-signing-scheme]]); server authentication is what stops a hijacked route from impersonating the receiver. |
| Global unicast only | Every resolved address must be globally routable public unicast; anything else is denied. Full table below. | The engine must be able to reach the internet and nothing but the internet — not the pod network, not the VPC, not the cloud metadata service. |
| DNS pinning | Resolve at send time, validate every returned address, connect to a validated address literal. | Closes the resolve-then-connect gap that DNS rebinding attacks with low-TTL records. |
| No redirects | 3xx responses are never followed. | A redirect is a second request to a URL that never passed validation — the classic guard bypass — and an `https→http` downgrade vector besides. |
| Port allow-list | 443 only in production; under the local-dev carve-out (`webhooks.egress.allow_local`, below) the allowed ports are the `webhooks.egress.local_ports` list (default `[80, 443]`) — a key never consulted in production. | Denies use of the engine as a port scanner or a cross-protocol cannon against non-HTTP services listening on odd ports. |
| No raw-IP hosts | The Target host must be a DNS name, never an IP literal. | IP literals arrive in dozens of encodings that parsers disagree on, and public CAs do not issue for them in practice; real receivers have names. |
| No userinfo, no fragments | A Target URL whose authority contains userinfo (any `@` before the host) or that carries a fragment is rejected at save time and send time. | The `@` authority differential is the classic SSRF parser bypass — two parsers disagreeing about which host precedes the `@` — and embedded credentials would spray unmasked through the denormalized `target_url` in history rows and every audit log line (the CSV export reduces the URL to `target_host`). |

### HTTPS only

HTTP in production is forbidden outright — not discouraged, not warning-labeled. A webhook body
frequently contains exactly the data a tenant considers most sensitive, and the additional
per-Target auth options put static credentials into request headers; both travel in cleartext
the moment a plain-HTTP Target exists. Certificate verification stays on in every environment:
there is no debugging scenario that justifies teaching the codebase a `verify => false` path.

### Global unicast only — the blocked ranges

The rule is an **allow, not a deny**: an address survives only if it is globally routable public
unicast. The table documents the notable families that rule excludes, because knowing *why* each
is dangerous is what keeps the list from being trimmed in a refactor:

| Range | What it is | Why it is blocked |
|---|---|---|
| `10.0.0.0/8` · `172.16.0.0/12` · `192.168.0.0/16` | RFC 1918 private | The internal network: databases, queue dashboards, admin panels, Kubernetes service CIDRs — everything that trusts its callers because "only we can reach it". |
| `127.0.0.0/8` · `::1/128` | Loopback | The app itself and every sidecar bound "safely" to localhost. |
| `169.254.0.0/16` · `fe80::/10` | Link-local | Contains **169.254.169.254** — the AWS/GCP/Azure metadata service. Metadata answers with live cloud credentials; this single address is the highest-value SSRF target on the internet. |
| `100.64.0.0/10` | Carrier-grade NAT | Cloud providers use it as internal fabric; Alibaba's metadata service sits at `100.100.100.200` inside it. |
| `fc00::/7` | IPv6 unique-local | The private fabric in IPv6 clothing — and AWS's IPv6 metadata twin `fd00:ec2::254`. |
| `::ffff:0:0/96` · `64:ff9b::/96` · `2002::/16` | IPv4-mapped, NAT64, 6to4 | Each embeds an IPv4 address inside an IPv6 one; skip extracting and validating the embedded address and the attacker tunnels straight past the IPv4 rules. |
| `0.0.0.0/8` · `240.0.0.0/4` · `255.255.255.255/32` · `::/128` · `100::/64` | "This network", reserved, broadcast, unspecified, discard | No legitimate receiver can live there; several are historical stack-confusion bypasses (`0.0.0.0` reaching loopback). |
| `192.0.0.0/24` · `192.0.2.0/24` · `198.51.100.0/24` · `203.0.113.0/24` · `198.18.0.0/15` · `2001:db8::/32` | Protocol, documentation, benchmark | Never routable; a Target pointing here is a mistake or a probe. |
| `224.0.0.0/4` · `ff00::/8` | Multicast | Not a unicast receiver. |

Hostname aliases of blocked infrastructure (`metadata.google.internal` and friends) need no
special-casing — validation happens on the *resolved addresses*, so whatever a name resolves to
is what gets judged.

### DNS-resolution pinning

The naive sequence — validate the URL, then hand it to an HTTP client that resolves again — is a
time-of-check/time-of-use hole: a rebinding attacker serves a clean public address to the
validation lookup and a private one to the connect lookup, using a near-zero TTL. The guard
therefore resolves **once per attempt**, validates **every** A and AAAA record returned (one
blocked address fails the whole set — the client may connect to any of them, so all must pass),
and then connects to a validated address literal so the connect step cannot re-resolve. TLS
SNI and the `Host` header still carry the hostname, so certificate validation is unaffected.

### No redirects

Redirect refusal is absolute: the redirect target never passed — and will never pass — the
guards above, so following it re-opens every hole they close, and a 301 to `http://` silently
downgrades transport besides. The delivery engine treats 3xx as a terminal outcome; the retry
classification lives in [[webhook-delivery-model]].

### Port allow-list

Range-blocking already denies internal hosts, but public hosts forward odd ports to internal
services often enough that ports are guarded independently — one control per assumption, per
[[defense-in-depth-model]]. Restricting production egress to 443 also makes the engine useless
as a scanning or cross-protocol tool against anyone, internal or not.

### No raw-IP hosts

`http://2130706433/`, `http://017700000001/`, `http://0x7f.1/`, `http://[::ffff:127.0.0.1]/` —
all loopback, all parsed differently by different URL libraries. Denying IP literals at the host
position removes the entire parser-differential class instead of enumerating it, costs nothing
(real receivers have DNS names, and HTTPS certificates require them in practice), and keeps the
name→address step where the pinning guard can see it.

### No userinfo, no fragments — one parser

`https://trusted.example@169.254.169.254/` reads as a trusted host to any parser that stops at
the `@` and as the metadata service to the one that connects — the authority/userinfo
differential is the most common SSRF URL-parser bypass in the wild. Fragments have no meaning
in a request URL and only exist to confuse a second parser. Both are rejected outright, at save
time and at send time. Beyond the parser differential, embedded credentials have a second blast
radius here: `target_url` is denormalized into history rows and every audit log line
([[webhook-data-model]]), where a `user:pass@` would be sprayed unmasked (the CSV export
deliberately reduces the URL to `target_host` — [[webhook-management-surface]]). Structurally,
the host is extracted **once**, by a single hardened parser, and resolved-address validation
runs against exactly that host — no component of the guard chain re-parses the URL.

## Enforcement points

The guards run **twice**:

- **At save time** — Target create/update validation rejects a non-conforming URL immediately.
  This is feedback, not security: it catches typos while the user is looking.
- **At send time, every attempt** — the authoritative check, because DNS answers change between
  save and send, and that change *is* the attack. Hostnames are IDN/punycode-normalized before
  resolution; a guard violation fails the attempt — a full Attempt row is written with
  `error_class` naming the stage, and a retryable denial consumes its schedule slot
  (classification → [[webhook-delivery-model]]).

The guard is **fail-closed**: resolution failure, an empty answer, or any blocked address in the
answer all deny the attempt. The deny outcomes classify differently: resolution failure or an
empty answer is retryable `network` (DNS wobbles heal), while a resolved-but-blocked address is
terminal `egress` — the taxonomy is [[webhook-delivery-model]]'s. Guard logic ships with
bootless, branch-complete unit tests — every
range family, the embedded-IPv4 extractions, raw-IP encodings, userinfo and fragment
rejection, redirect refusal — per the testing
obligations in [[fleet-webhook-specification]] and [[fleet-testing-doctrine]]. The implementation
lands in [`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle, future
pass).

## The local-dev carve-out

One gate, in the config layer per fleet secrets law ([[fleet-app-specification]]):
`webhooks.egress.allow_local`, fed by a `WEBHOOKS_EGRESS_ALLOW_LOCAL` env fragment, **false when
blank**. The guard code additionally ignores the flag whenever the environment is production —
the carve-out is unreachable in production by code, not by configuration discipline.

When enabled in local/dev it permits exactly what a Sail-style loop needs: the plain `http://`
scheme, the ports named in **`webhooks.egress.local_ports`** (default `[80, 443]` — extend the
list for a local receiver on `:8080` or `:3000`), and loopback plus RFC 1918 destinations
(raw-IP hosts allowed for those local addresses only), so a companion container or a local
receiver on `127.0.0.1` can catch deliveries without a tunnel. `local_ports` is honored **only
while the carve-out flag is on**: the flag is already unreachable in production by code, and
the port list rides inside it — production port policy never reads the key.

**Never relaxed, in any environment:** the cloud-metadata addresses (`169.254.169.254`,
`fd00:ec2::254`, `100.100.100.200`, and kin), DNS pinning, redirect refusal, and certificate
verification wherever HTTPS is used. There is no legitimate local-dev reason to call a metadata
service through the webhook engine.

## Beside the guard

Per [[defense-in-depth-model]], no single control gets to be load-bearing. The application-layer
guard set above is backed at the Cluster / IaC layer by an egress network policy pinning worker
pods to 443, and at the cloud layer by metadata hardening (IMDSv2-required, hop limit 1). Those
controls are fleet posture, not webhook code — but the day the guard has a bug is the day they
earn their keep. The full mapping is [[webhook-threat-model]].
