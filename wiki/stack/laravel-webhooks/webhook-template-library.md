---
title: Webhook Template Library — Code-Defined Starting Points
description: The code-defined template library for outbound webhooks — the normative WebhookTemplate interface (name, description, verb, headers, body, content type, applicable event types, required token slots, overrideable target suggestions), reflection discovery and production caching mirroring the event registry, copy-not-link application semantics, and the three generic templates the fleet bundle ships (Slack incoming-webhook, Discord, generic JSON) with their full bodies as worked examples. Sister pages, webhook-templating owns the token language the bodies are written in and webhook-management-surface owns the picker and apply flow. Depth behind the WH-3xx rows of fleet-webhook-specification.
tags: [stack, webhooks, laravel, templates, integrations]
type: stack
status: reference
updated: 2026-08-08
related: [fleet-webhook-specification, webhook-templating, webhook-event-catalog, webhook-management-surface, webhook-data-model]
---

# Webhook Template Library — Code-Defined Starting Points

A template class is a code-defined starting point for a Webhook: a named, described bundle of
verb, headers, body template, content type, and hints that a user applies in the management UI
instead of authoring a template from a blank editor. This page owns the template interface, the
discovery/registration model, the copy-not-link application semantics, required token slots,
target suggestions, and the generic templates the fleet ships. The token language the bodies are
written in is owned by [[webhook-templating]]; the picker and apply flow are UI requirements
owned by [[webhook-management-surface]]; the rule rows are the WH-3xx section of
[[fleet-webhook-specification]]. The interface, its value objects, and the three generic
templates land in [`standards/laravel/webhooks/`](../../../standards/laravel/webhooks/) (bundle,
future pass); each app adds its own integration-specific classes beside them.

This is the interface-driven webhook class family: an abstract contract in the fleet bundle,
concrete configuration classes per integration, discovered — never hand-registered.

## The interface

The normative surface. Namespaces are deliberately unspecified — the spec names capabilities and
class surfaces, never layouts (A-04, [[fleet-app-specification]]). `WebhookVerb` and
`WebhookContentType` are the same string-backed enums the Webhook entity uses
([[webhook-data-model]]).

```php
interface WebhookTemplate
{
    /** Stable registry key: kebab-case, unique per app. Treat as identity — pinned by test. */
    public function name(): string;

    /** One or two sentences of picker copy. */
    public function description(): string;

    /** Must satisfy the verb/body matrix together with body(). */
    public function verb(): WebhookVerb;

    /** @return array<string, string> Header name => value template. Names are static;
     *  values may carry tokens. Reserved X-Webhook-* names are rejected at registry build. */
    public function headers(): array;

    /** Body template source in the webhook-templating language (slot markers allowed),
     *  or null to stamp no template — the standard-envelope default. */
    public function body(): ?string;

    /** Ignored when body() is null: the envelope default is always JSON. */
    public function contentType(): WebhookContentType;

    /** @return list<string> Wire types and/or wildcards this template suits; ['*'] = any.
     *  Filters the picker; the save-time validator remains the real gate. */
    public function eventTypes(): array;

    /** @return array<string, string> Slot name => human description. Every slot must be
     *  bound at apply time. Slot names match [a-z0-9_]+. */
    public function requiredTokens(): array;

    /** @return list<TargetSuggestion> Hints only — never enforced, always overrideable. */
    public function targetSuggestions(): array;
}
```

```php
final readonly class TargetSuggestion
{
    public function __construct(
        public string $host,          // e.g. 'hooks.slack.com'
        public ?string $note = null,  // one line shown beside the hint
    ) {}
}
```

Concrete template classes are `final` and implement the interface — enforced by arch test, the
same enforcement family that pins the `Event` suffix ([[fleet-testing-doctrine]], testing
section of [[fleet-webhook-specification]]).

## Discovery and registration

Registration mirrors the event registry: concrete classes implementing `WebhookTemplate` are
discovered by reflection scan and cached for production by an artisan command following the
event-registry pattern — [[webhook-event-catalog]] owns the discovery and caching mechanics; the
template registry rides the same pipeline. Nothing is hand-registered in a service provider;
dropping a class into the codebase is registration.

The registry build validates every class and fails loudly on: a duplicate `name()`; a body on a
bodyless verb or any verb outside the matrix ([[webhook-templating]]); a header using a reserved
`X-Webhook-*` name; a syntactically invalid wire type or wildcard in `eventTypes()`; a body that
does not parse under the template grammar (slot markers permitted at this stage); a slot marker
in the body that `requiredTokens()` does not declare, or a declared slot the body never uses —
both directions, so typos die in CI, not in a picker.

The registry is **pinned by a unit test**: an exhaustive `toBe([...])` on the template name list,
exactly as the event registry is pinned. A template appearing or vanishing is a failing test,
never a surprise.

## Applying a template is a copy, never a link

Application stamps the template's verb, content type, headers, and body (after slot binding)
into the Webhook form as initial values, and preselects compatible event types. The user edits
anything before saving; the stored Webhook keeps **no reference** to the template class.
Consequences, all deliberate:

- A later change to the template class never mutates existing Webhooks. Templates evolve;
  silently rewriting a deployed integration behind its owner's back is a reliability hazard the
  copy model makes structurally impossible.
- Deleting a template class from code strands nothing — existing Webhooks are self-contained
  copies and keep delivering.
- "Upgrading" to a newer template revision is an explicit act: re-apply the template and re-save.

The apply flow ([[webhook-management-surface]] owns the UI requirements): pick a template
(picker filtered by `eventTypes()` compatibility with the current event selection), bind each
required slot, review the stamped values, edit freely, save. The save runs the full save-time
validation of [[webhook-templating]] on the result — an applied template gets no validation
shortcut.

## Required token slots

A generic template cannot know an app's payload paths — the Slack template needs "the line to
post" without knowing whether that line comes from `data.invoice.number` or
`data.service_request.title`. Slots are the seam. A template body references a slot as
`{{ @slot_name }}`; `requiredTokens()` declares each slot with a human description; at apply
time the user binds every slot to a fragment of ordinary template text — most often a single
token, sometimes a short phrase with tokens embedded
(`Invoice {{ data.invoice.number }} was paid`). The library substitutes each fragment for its
marker textually, producing a plain template that then passes through normal save-time
validation against the selected event types.

The `@` marker is not part of the runtime token grammar ([[webhook-templating]] rejects it at
save), so an unbound slot is structurally incapable of reaching a stored Webhook: either the
apply flow bound it, or the save fails.

## Target suggestions

A template may hint at where its receiver lives — `hooks.slack.com` for Slack incoming
webhooks. The UI uses the hint to surface matching existing Targets first and to prefill the
new-Target form. Suggestions are **hints only and always overrideable**: they never restrict
which Target a Webhook may attach to, and they relax nothing — whatever Target the user picks
still passes verification and the egress guards ([[webhook-data-model]],
[[webhook-egress-guards]]).

## Shipped generic templates

The fleet bundle ships three. Apps add integration-specific templates (their CRM, their
accounting sync) as their own classes beside these; discovery treats them identically.

| `name()` | Verb | Content type | Event types | Slots | Target hint |
|---|---|---|---|---|---|
| `slack-incoming-webhook` | POST | JSON | `*` | `headline`, `summary` | `hooks.slack.com` |
| `discord-webhook` | POST | JSON | `*` | `headline`, `summary` | `discord.com` |
| `generic-json` | POST | JSON | `*` | none | none |

### slack-incoming-webhook

Posts a Block Kit message to a Slack incoming-webhook URL. Body template:

```json
{
  "text": "{{ @headline }}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*{{ type }}*  {{ @summary }}"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "{{ occurred_at | date:'Y-m-d H:i' }} UTC · event {{ id }}"
        }
      ]
    }
  ]
}
```

Slots: `headline` — the one-line notification text Slack shows in toasts and unfurls;
`summary` — the mrkdwn line rendered in the message body. Target suggestion:
`hooks.slack.com`, note "Create an incoming webhook in your Slack app's settings; the generated
URL is the Target base path." No extra headers — the engine sets `Content-Type` from the content
type. Note how the envelope tokens (`type`, `occurred_at`, `id`) work for every event type,
which is what lets `eventTypes()` stay `['*']` while the payload-specific text arrives through
slots. The class body's fixed tokens are envelope-level, but after slot binding the stored
body typically carries `data.*` tokens; a `ping` test-fire renders through it under the
ping-only relaxed resolution ([[webhook-delivery-model]]) — structurally absent `data.*` paths
resolve as null — so Slack still receives a message-shaped body where the bare base-URL ping
would be rejected, which is how a Slack Target verifies. One caveat travels with the pattern: the
incoming-webhook URL is a **bearer credential**, and as a Target base path it is stored and
displayed unmasked — readable by every `webhooks:read` holder and by `/control` support
([[webhook-threat-model]] I-6). Acceptable for a channel-posting URL; it does not generalize —
a secret that must stay masked belongs in the Target's custom-secret-header auth option
([[webhook-signing-scheme]]).

The class, as the worked example of the interface:

```php
final class SlackIncomingWebhookTemplate implements WebhookTemplate
{
    public function name(): string { return 'slack-incoming-webhook'; }

    public function description(): string
    {
        return 'Posts a Block Kit message to a Slack incoming-webhook URL.';
    }

    public function verb(): WebhookVerb { return WebhookVerb::Post; }

    public function headers(): array { return []; }

    public function contentType(): WebhookContentType { return WebhookContentType::Json; }

    public function body(): ?string
    {
        return <<<'JSON'
        {
          "text": "{{ @headline }}",
          "blocks": [
            {
              "type": "section",
              "text": { "type": "mrkdwn", "text": "*{{ type }}*  {{ @summary }}" }
            },
            {
              "type": "context",
              "elements": [
                { "type": "mrkdwn", "text": "{{ occurred_at | date:'Y-m-d H:i' }} UTC · event {{ id }}" }
              ]
            }
          ]
        }
        JSON;
    }

    public function eventTypes(): array { return ['*']; }

    public function requiredTokens(): array
    {
        return [
            'headline' => 'One-line notification text shown in Slack toasts and unfurls.',
            'summary'  => 'The mrkdwn line rendered in the message body.',
        ];
    }

    public function targetSuggestions(): array
    {
        return [new TargetSuggestion(
            host: 'hooks.slack.com',
            note: 'Create an incoming webhook in your Slack app settings; the generated URL is the Target base path.',
        )];
    }
}
```

### discord-webhook

Posts an embed to a Discord channel webhook URL. Body template:

```json
{
  "content": "{{ @headline }}",
  "embeds": [
    {
      "title": "{{ type }}",
      "description": "{{ @summary }}",
      "timestamp": "{{ occurred_at }}",
      "footer": { "text": "event {{ id }}" }
    }
  ]
}
```

Slots as in the Slack template. Target suggestion: `discord.com`, note "Channel settings →
Integrations → Webhooks; the generated URL is the Target base path." As with Slack,
verification runs through the template path: a `ping` test-fire renders an embed Discord
accepts where the bare base-URL ping would be rejected ([[webhook-delivery-model]]), and the
same capability-URL caveat applies: the Discord webhook URL is a bearer credential, stored and
displayed unmasked as the Target base path ([[webhook-threat-model]] I-6). Discord accepts the
envelope's RFC 3339 `occurred_at` directly in the embed `timestamp` field — no formatter needed.
Discord caps `content` at 2000 characters: when the bound `headline` fragment can run long, bind
it with a truncation, e.g. `{{ data.note | truncate:1900 }}` ([[webhook-templating]] owns the
formatter semantics).

### generic-json

The zero-opinion starting point for users who want the envelope shape but intend to reshape it.
No slots, no target suggestion, POST, JSON. Body template:

```json
{
  "id": "{{ id }}",
  "type": "{{ type }}",
  "schema_version": {{ schema_version }},
  "occurred_at": "{{ occurred_at }}",
  "data": {{ data }}
}
```

This template exists for the editor experience, not the wire: with no body template at all, a
bodied Webhook already sends the standard envelope ([[webhook-templating]]), and that zero-config
default is the right choice when the envelope is wanted as-is. Applying `generic-json` instead
stamps an explicit, editable rendition of the same shape so each field can be renamed, pruned, or
nested to match a receiver's expectations. It is also a two-line demonstration of native value
injection: `{{ schema_version }}` and `{{ data }}` sit in JSON value position, so the rendered
output carries a real number and a real object — no quoting, no escaping gymnastics.
