---
title: Validate at the Boundary
description: All input from user-land MUST be validated at the edge of the system — in Form Request classes — so that by the time data reaches a service or action it is clean and normalized.
tags: [laravel, architecture, principles, validation]
type: stack
updated: 2026-06-17
related: [laravel-first-principles, form-requests, data-transfer-objects, services, actions, transport-layer-boundary]
---

# Validate at the Boundary

All input coming from "user land" **MUST** be validated, and that validation
belongs **at the edge of the system** — in [[form-requests|Form Request]] classes
— not scattered through controllers.

By the time data reaches a [[services|service]] or [[actions|action]], it should
be **validated and normalized**; the business layer assumes clean input. This is
what lets the same operation run from a controller, a console command, or a queued
job without re-validating at each call site.

The natural next step after validation is to assemble a typed
[[data-transfer-objects|DTO]] from the validated input (a `toData()` method on the
Form Request), so the business layer receives a clean, typed structure rather than
a raw array.

This principle is the input-side of the [[transport-layer-boundary|transport
boundary]]: validation is a transport concern that the domain should never have to
repeat.

**Enforcement.** The boundary is guarded structurally: Form Requests are
final/extend `FormRequest`, and the domain layer is forbidden from reaching back
into HTTP (`->not->toUse(['request', 'Illuminate\Http'])`) — see
[[arch-expectations-dependencies]] and [[transport-layer-boundary]].
