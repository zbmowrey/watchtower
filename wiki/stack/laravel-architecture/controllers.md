---
title: Controllers
description: A controller has exactly one responsibility — translate an HTTP request into a business-layer call, then translate the result into an HTTP response. No business rules, no query construction.
tags: [laravel, architecture, building-blocks, controllers, http]
type: stack
updated: 2026-07-04
related: [laravel-building-blocks, fat-models-skinny-controllers, form-requests, actions, repositories, query-builders, transport-layer-boundary, arch-expectations-naming]
---

# Controllers

A controller has **exactly one responsibility**: translate an HTTP request into a
call to the business layer, then translate the result into an HTTP response. It
should **not** contain business rules, query construction, or formatting beyond
choosing a [[supporting-building-blocks|Resource]] or view. This is
[[fat-models-skinny-controllers|skinny controllers]] in practice.

**Conventions:**

- Suffix every controller with `Controller`.
- Restrict resource controllers to the seven RESTful actions (`index`, `show`,
  `create`, `store`, `edit`, `update`, `destroy`).
- Prefer **single-action invokable** controllers for one-off endpoints.

```php
final class PublishPostController extends Controller
{
    public function __invoke(PublishPostRequest $request, Post $post): RedirectResponse
    {
        PublishPost::run($post, $request->toData());

        return to_route('posts.show', $post);
    }
}
```

Note the shape: a [[form-requests|Form Request]] handles validation and assembles a
[[data-transfer-objects|DTO]]; an [[actions|Action]] does the work; the controller
just wires them and returns a response.

## Inertia rendering: route helper vs controller

`Route::inertia('dashboard', 'dashboard')` is the right tool for **exactly one case**:
a page whose props are **compile-time constants**. It is a shorthand controller with
no access to the request, the authenticated user, or the database, so it is ideal for
marketing and static pages (`welcome`, `pricing`, an industry page keyed only on a
slug literal), where it stays a clean one-liner and remains `route:cache`-friendly.

The moment a page needs **per-request data** — the current user's records, a
permission-gated count — `Route::inertia` is mechanically off the table, and the rule
is:

> Per-request data gets a **transport-only controller + an [[actions|action]]**.
> Never a closure route (`fn () => Inertia::render(...)` breaks `route:cache`, which
> the hardened prod image relies on, and is untestable and invisible to the arch
> suite). Never inline queries in the controller. Query logic follows the data-access
> chain: controller → action → [[repositories|repository]] →
> [[query-builders|query builder]].

`Route::inertia` is the degenerate-case optimization, not a competitor to the
controller pattern. A page graduates from one to the other the moment it stops being
constant. For a widget whose query is genuinely expensive, reach for Inertia's
**deferred props** (`Inertia::defer`), which layers on top of the controller, not
instead of it.

**Enforcement.**

- `expect('App\Http\Controllers')->toHaveSuffix('Controller')` —
  [[arch-expectations-naming]].
- `expect('App\Models')->not->toBeUsedIn('App\Http\Controllers')` — no direct DB
  access ([[arch-expectations-dependencies]]).
- The [[pest-arch-presets|`laravel()` preset]] enforces the RESTful-method
  convention. See the [[pest-arch-example-suite|annotated suite]].
