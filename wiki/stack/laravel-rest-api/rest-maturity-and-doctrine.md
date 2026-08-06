---
title: REST Maturity & the Fleet Doctrine
description: What REST formally requires (Fielding, HATEOAS) vs what shipping APIs actually do (Richardson Level 2), and the honest position the fleet takes — Level 2 + RFC-correct semantics + a published OpenAPI contract, statelessness kept as a hard rule.
tags: [stack, api, rest, doctrine, architecture]
type: stack
status: reference
updated: 2026-07-30
related: [fleet-api-specification, http-method-semantics, openapi-scramble]
---

# REST Maturity & the Fleet Doctrine

**Fielding's REST** is a set of architectural constraints: client–server, **statelessness**,
cacheability, layered system, and the uniform interface — whose fourth sub-constraint is
**HATEOAS** (hypermedia as the engine of application state). By Fielding's own standard,
almost nothing the industry calls a "REST API" is one.

**The Richardson Maturity Model** grades pragmatically: L0 = one endpoint, HTTP as an RPC
tunnel; L1 = resources get URIs; **L2 = verbs and status codes used as HTTP intends**;
L3 = hypermedia controls drive the client. Fowler is explicit the RMM is not a definition of
REST — and that L3 is a *precondition* of REST proper.

**The honest position — the one the fleet takes:** Stripe, GitHub, and virtually every
high-quality commercial API sit at **RMM Level 2 with documented URI templates and an
out-of-band OpenAPI contract, deliberately without HATEOAS**. GitHub's pagination is the
tell: navigation lives in the `Link` *header* (a transport affordance), not as hypermedia in
resource bodies. We say this plainly rather than cosplay Level 3:

1. **Level 2, RFC-correct.** Correct method semantics ([[http-method-semantics]]), correct
   status codes + companion headers ([[http-status-codes]]), problem details
   ([[problem-details]]), conditional requests where warranted
   ([[conditional-requests-etags]]).
2. **Statelessness is kept as a real REST constraint** — token per request, no server-side
   session on the API plane ([[sanctum-token-auth]]).
3. **The contract is OpenAPI, generated from code** ([[openapi-scramble]]) — the
   machine-readable substitute for the discovery hypermedia would have provided.
4. **Tolerant reader, conservative writer** (Zalando #108/#109): clients ignore unknown
   fields; the server only ever adds ([[api-versioning]]).

**Considered and rejected** (details in the spec's tail): the JSON:API envelope (vocabulary
borrowed, envelope refused), HAL (hypermedia plumbing without payoff), OData (a full query
language + metadata model, disproportionate). Norms → [[fleet-api-specification]] §0.
