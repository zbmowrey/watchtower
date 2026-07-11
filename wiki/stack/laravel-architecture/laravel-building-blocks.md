---
title: The Building Blocks
description: The vocabulary of a well-architected Laravel app — controllers, form requests, actions, services, DTOs, repositories, models, and the supporting types. Each block has a narrow job, a naming convention, and an arch test that guards it.
tags: [laravel, architecture, building-blocks]
type: stack
updated: 2026-07-04
related: [laravel-architecture-manual, controllers, form-requests, actions, services, data-transfer-objects, repositories, query-builders, models, supporting-building-blocks, dependency-rules]
---

# The Building Blocks

This is the vocabulary of a well-architected Laravel app. **Each block has a narrow
job, a naming convention, and an arch test that guards it** — the third column is
what makes the architecture self-defending (see [[pest-architecture-testing]]).

| Block                                                                   | One-line job                                                                                         |
|-------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| [[controllers]]                                                         | Translate an HTTP request into a business-layer call, then a response. Nothing more.                 |
| [[form-requests]]                                                       | Own validation + authorization at the boundary; assemble a DTO.                                      |
| [[actions]]                                                             | One business operation, as a single invokable class.                                                 |
| [[services]]                                                            | Stateless orchestration across multiple entities / external systems.                                 |
| DTOs                                         | Typed, immutable data carried across boundaries.                                                     |
| [[repositories]]                                                        | Own the queries behind an interface; return DTOs/collections, not builders.                          |
| [[query-builders]]                                                      | Hold a reusable, scoped base query so the scope is defined once and enforced on every call.          |
| [[models]]                                                              | Entities + entity-local behavior (relationships, scopes, casts).                                     |
| Enums / VOs / Events / Jobs / Resources | The supporting cast — fixed sets, value types, decoupled side effects, async work, response shaping. |

How they relate to one another by allowed dependency direction is the subject of
[[dependency-rules]]; how they should be physically arranged is
[[laravel-app-structure]].
