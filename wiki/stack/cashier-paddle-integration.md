---
title: Cashier + Paddle — the fleet integration
description: How the fleet wires Laravel Cashier Paddle for subscription billing — the reference implementation lives in acme. Covers the four Cashier defaults that are wrong for a multi-tenant Laravel app, the trial-column trap, and what a missing Paddle account does and does not block.
tags: [stack, billing, paddle, cashier, laravel, multi-tenant]
type: stack
status: reference
updated: 2026-08-01
related: [acme, laravel-multi-tenant, fleet-app-specification]
---

# Cashier + Paddle — the fleet integration

**Reference implementation: `acme`**, built as the fleet's exemplar
by owner ruling 2026-07-29. Copy from there; read this first for the parts that are not
obvious from the code.

Scope: **subscription billing, us charging our customers.** Not to be confused with a tenant
charging *its* customers, which is a different plane with a different merchant of record and
a different abstraction. The two must never share an interface: a merchant-of-record boundary
is a legal and tax boundary, not only a code one, and a shared abstraction quietly invites the
wrong entity onto a receipt.

## The seam

Cashier already implements subscriptions, trials, proration, dunning, webhooks and the
billing portal. **Do not re-express any of that.** The seam exists so the app can leave
Paddle later without noticing, so the rule for adding a method to it is that the *app* needs
to ask the question, not that Paddle happens to offer it. In TMP it is seven methods:
summarize, checkout, setAddon, purchasedAddons, syncSeats, paymentMethodUrl, cancelUrl.

Running two processors concurrently is rejected, not merely unbuilt: a subscription's
customer, payment method and history live in one processor and cannot be split or failed
over.

## Four Cashier defaults that are wrong here

Each of these is a default that is fine in a single-tenant app and wrong in ours.

### 1. The `customers` table name collides

Stock Cashier creates `customers`, `subscriptions`, `subscription_items`, `transactions`.
**A tenant database in a field-service app already has a `customers` table** holding the
shop's own customers. Opposite ends of the business, same word.

Prefix all four `paddle_`. Prefix all of them, not only the colliding one, so "these belong
to Paddle" is visible at a glance instead of being a puzzle about why one is different.

### 2. The models follow whatever connection is current

Cashier's models declare no connection, so under stancl they follow the tenant once tenancy
initializes. Pin them with `Stancl\Tenancy\Database\Concerns\CentralConnection` on app-local
subclasses, registered via `Cashier::useCustomerModel()` and friends **in `register()`, not
`boot()`**, so nothing can query through a stock model first.

**The subtle part, and the reason this is easy to get wrong:** reads through a central
user's relations were never at risk. Eloquent's `newRelatedInstance()` hands the parent's
connection down, so `$user->subscriptions()` works pinned or not. What breaks is the
**static** lookup — `Cashier::findBillable($paddleId)`,
`$subscriptionModel::firstWhere('paddle_id', …)` — which has no parent to inherit from and
lands on whatever is default. That is every webhook.

So a test written through relations **passes with or without the pin and proves nothing.**
Test it through a Paddle id, inside `$tenant->run()`. (TMP's first version of this test made
exactly that mistake and was rewritten after being checked against the trait removed.)

### 3. Subclassing silently breaks the item relation

Renaming `Subscription` to `PaddleSubscription` re-points every derived foreign key at
`paddle_subscription_id`, a column that does not exist — Eloquent derives relation keys from
the **class name**. Fix with `getForeignKey(): string { return 'subscription_id'; }` on the
subclass, and redeclare `items()` with an explicit key and a typed `@return HasMany<…>`
(Cashier resolves the item class from a static property, so its relation is generic-free and
every `$item->quantity` downstream reads as an undefined property at PHPStan L8).

### 4. `past_due` is treated as invalid

`Cashier::$deactivatePastDue` defaults to true, so `valid()` goes false the moment a card is
declined. If the app's own policy is that dunning nags rather than bars the door — it should
be; a card expires far more often than a customer decides to leave — call
`Cashier::keepPastDueSubscriptionsActive()`. Left mismatched, the app's access rule and
`valid()` disagree, and the symptom is not a lockout: it is **seat/quantity syncs silently
refusing for exactly the accounts whose billing is already in trouble**, because the sync
guards on `valid()`.

Also: **the webhook route carries no host constraint.** In a subdomain-per-tenant app it
answers on every customer's domain. `Cashier::ignoreRoutes()` and re-register it pinned to
the central host. Register it in a provider rather than a routes file so it stays out of the
`web` middleware group: a machine-to-machine POST has no session, and CSRF-exempting it is a
bigger statement than never opting in.

## A no-card trial is not Cashier's trial

This is the trap most likely to burn an hour.

Cashier's "generic trial" lives on **`paddle_customers.trial_ends_at`**, and reaching it
requires a Paddle customer to exist — which `createAsCustomer()` creates with an API call.
A genuine no-card trial means Paddle has never heard of the account, so there is no row and
`onGenericTrial()` returns false.

So: **keep the trial clock on your own users table**, mint the Paddle customer at the
subscribe click, and never call `$user->onTrial()` — it returns false throughout a trial
that is running perfectly, and again after subscribing, because
`handleSubscriptionCreated` nulls the column. Route every trial question through the seam.

## Model the states the app needs, not Paddle's five

Paddle reports `active`, `trialing`, `past_due`, `paused`, `canceled` and leaves the two
distinctions that actually decide access implicit:

- A subscription reads **`active` both while recurring and after a scheduled cancellation**
  (the status stays; only `ends_at` is set). Check `onGracePeriod()` *before* the
  active fallthrough or a leaving customer is indistinguishable from a retained one, which
  understates churn and aims retention copy at someone already gone.
- Nothing at all is reported for an account that **never paid**. "Trial expired" and "never
  had a trial" want opposite handling: one had its 30 days, the other is a bug to fix.

## Billing a base plus per-unit overage

Two prices on one subscription (base at quantity 1, overage at `max(0, used - included)`),
not one tiered price. Same total, but the invoice reads the way the pricing page reads, and
a bill somebody can check themselves is a support ticket that never gets opened.

Omit the overage line at zero rather than sending quantity 0 — Paddle rejects it, and "0
extra seats" is noise on a bill for someone who bought none.

For quantity changes use `swap($items)` with the full desired set, not `updateQuantity()`:
swap covers added, removed, and the overage line appearing or vanishing entirely as the
account crosses the included boundary, which `updateQuantity()` cannot do (it fails on a
line that is not already there). Compare against current items and return early when
nothing changed, so a reconcile job can call it unconditionally. Cashier's default proration
bills the difference on the next renewal rather than charging the card immediately, which is
the right default: hiring someone on a Tuesday should not produce a surprise charge.

## Gating access on a subscription

**Fail open, loudly.** If billing cannot be resolved, let them work. A free day for
one customer costs a few dollars; locking a paying customer out of their own
schedule over a database blip costs the customer. But failing open *silently* is
worse than having no gate, because a gate that fails open on every request looks
exactly like a gate that passes every request — the app just works and nobody is
ever billed. Log at error level when it happens, and write one test that proves the
gate genuinely reads the billing record rather than always allowing.

**Cache the yes, never the no.** The allowing answer is the hot path on every
request. The denying answer must not outlive the moment somebody pays you — waiting
out a TTL is the wrong experience to hand a customer who has just paid. Cashier's
subscription events are the invalidation signal for the cached yes.

**Do not gate the customer's customers.** In a B2B2C app, put the gate after
*operator* auth rather than on the whole tenant group. The end customer is not party
to your billing dispute, and breaking their emailed approval link costs your customer
the money they need in order to pay you. Do gate the token API, though: an ungated
API is the documented way around the paywall.

**`past_due` should not deny.** A card expires far more often than a customer
decides to leave. This has to agree with `Cashier::keepPastDueSubscriptionsActive()`
or the two disagree, and the visible symptom is not a lockout — it is quantity syncs
silently refusing for exactly the accounts whose billing is already in trouble.

## Dunning: a cooldown, not a transition

Paddle fires `subscription.updated` for every change, so a naive past-due check
mails on each one. The obvious fix — notify only on the transition *into* past_due —
does not work: Cashier has already saved the new status by the time the event fires,
so the old one is gone.

Use a daily cooldown instead, claimed with `Cache::add()` so two webhooks landing
together cannot both send. That is what dunning should be anyway: a periodic nudge
across the retry window rather than one email that can be missed. Clear the cooldown
when the subscription recovers, or a customer who fails, fixes it, and fails again
the same day gets silence at the moment they need telling.

Keep your own dunning mail short and calm. Paddle already retries and sends its own;
what yours adds is the sentence Paddle cannot write (nothing has been switched off)
and a link to where the card lives in *your* app.

## Add-on packages on the same subscription

Sell an add-on as its own price on the same subscription. Two rules keep it
honest, both proven in production:

- **Entitle from the subscription's items, not a column.** ResolveEntitlements
  unions add-on slugs read through the seam (price id → slug via config) with the
  administrative-grants column; a purchase writes nothing to `users.addons`, so
  grants and purchases cannot fight over one field.
- **Every swap() must carry the add-on lines.** A seat sync that rebuilds the
  item set from seat arithmetic alone silently cancels a package the shop paid
  for. Merge current add-on lines into the desired set before comparing.

Also: Cashier's `Checkout` defaults to `displayMode: inline`, which needs a
frame target; override to `overlay` in the adapter when the page has none. And
Trivy's KSV-0109 flags `PADDLE_CLIENT_SIDE_TOKEN` in a ConfigMap — the client
token is publishable by design; the documented exception lives in the k8s
repo's `.trivyignore.yaml`.

## Syncing quantities off your own data

Hook the **models**, not the actions. A per-seat quantity changes through more doors
than you will remember to update — and a door that forgets is a wrong invoice. Watch
the columns rather than the callers.

Two traps there:

- **`wasChanged()` is empty on INSERT** (see [[laravel-runtime-traps]]).
  Rows created lazily on first edit make this the common case, not the edge.
- **Check for a subscription before counting.** If counting is expensive (in a
  multi-tenant app it means opening every tenant database an account owns), the
  trialing majority should never pay that cost.

Queue the sync (`ShouldBeUnique` per account collapses bursts into one API call) and
back it with a scheduled reconcile. The reconcile is not belt-and-braces: a dropped
job or an event fired while the processor was down leaves a wrong invoice in either
direction, and neither direction is one a customer should find before you do.

## What a missing Paddle account blocks

Less than it sounds. Design, state mapping, seat arithmetic, webhook wiring and the whole
read side are all buildable and testable without one. What genuinely cannot be exercised is
the **live handshake**: a real checkout, real dunning, real proration. Build behind
`Cashier::fake()` and keep the unconfigured path honest — with no price ids the UI should
degrade to read-only rather than offer a checkout that cannot complete.

## Fleet notes

- Ships as a **production** dependency (`laravel/cashier-paddle` ^2.8, PHP ^8.3,
  Laravel ^13). First payment dependency in the fleet.
- Its migrations are publish-only, never auto-loaded, so nothing lands unless you write it.
  Prefer hand-writing one migration for all four tables over publishing four and editing
  them: they are created together and never independently useful.
- Do **not** publish `config/cashier.php`. Everything in it is env-driven; keep app-specific
  knobs (price ids, included units, trial length) in your own config file instead, so a
  Cashier upgrade is not a merge.
