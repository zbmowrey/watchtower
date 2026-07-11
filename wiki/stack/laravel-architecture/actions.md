---
title: Actions — Single-Purpose Business Operations
description: An Action encapsulates one business operation as a single-method, invokable class. Actions keep controllers thin and make each operation independently testable and reusable from controllers, jobs, and commands.
tags: [laravel, architecture, building-blocks, actions]
type: stack
updated: 2026-06-17
related: [laravel-building-blocks, services, controllers, data-transfer-objects, supporting-building-blocks, single-responsibility-principle, arch-expectations-file-type]
---

# Actions — Single-Purpose Business Operations

An Action encapsulates **one** business operation ("publish a post," "register a
user") as a single-method, invokable class. Actions keep [[controllers]] thin and
make each operation independently testable and reusable from controllers,
[[supporting-building-blocks|jobs]], and commands alike. They are
[[single-responsibility-principle|SRP]] made concrete: one class, one reason to
change.

A common convention is a single `execute()`, `handle()`, or `__invoke()` entry
point.

```php
final class PublishPost
{
    public function __construct(private readonly Clock $clock) {}

    public function execute(Post $post, CreatePostData $data): Post
    {
        $post->fill($data->toArray());
        $post->published_at = $this->clock->now();
        $post->save();

        PostPublished::dispatch($post);

        return $post;
    }
}
```

> **Actions vs. Services.** An [[actions|Action]] does **one** thing; a
> [[services|Service]] groups several related operations behind one cohesive class.
> Many teams use only Actions; others use Services for read/write coordination and
> Actions for discrete commands. **Pick one vocabulary and enforce its suffix.**

Actions take input as a [[data-transfer-objects|DTO]] (clean, validated by the
[[form-requests|Form Request]]) and decouple side effects through
[[supporting-building-blocks|events]] — note the `PostPublished::dispatch()` above.

**Enforcement.** `expect('App\Actions')->toBeInvokable()` — one public entry point
([[arch-expectations-file-type]]). Dependency direction (Actions may use services,
models, DTOs, events — not HTTP) is in [[dependency-rules]].
