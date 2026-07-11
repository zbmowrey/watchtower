---
title: Form Requests — Validation at the Boundary
description: Move all validation out of controllers into Form Request classes. They own validation rules and authorization for the request, and are the natural place to assemble a DTO from validated input.
tags: [laravel, architecture, building-blocks, validation, http]
type: stack
updated: 2026-06-17
related: [laravel-building-blocks, validate-at-the-boundary, controllers, data-transfer-objects, actions]
---

# Form Requests — Validation at the Boundary

Move **all** validation out of [[controllers]] into Form Request classes. This is
the concrete home for the [[validate-at-the-boundary|validate-at-the-boundary]]
principle. A Form Request owns:

1. the **validation rules** for the request,
2. the **authorization** for the request, and
3. (idiomatically) the assembly of a typed [[data-transfer-objects|DTO]] from the
   validated input.

```php
final class StorePostRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title'      => ['required', 'string', 'max:255', 'unique:posts'],
            'body'       => ['required', 'string'],
            'publish_at' => ['nullable', 'date'],
        ];
    }

    public function toData(): CreatePostData
    {
        return new CreatePostData(
            title: $this->string('title'),
            body: $this->string('body'),
            publishAt: $this->date('publish_at'),
        );
    }
}
```

The `toData()` method is the handoff from the transport edge to the
transport-agnostic business layer: the [[actions|Action]] or [[services|Service]]
downstream receives a clean, typed `CreatePostData`, never a raw request array.

**Enforcement.** Form Requests are kept final and extending `FormRequest`
(`toExtend('Illuminate\Foundation\Http\FormRequest')`), and the domain is forbidden
from reaching back into the request (`->not->toUse(['request', 'Illuminate\Http'])`
— see [[transport-layer-boundary]] and [[arch-expectations-dependencies]]).
