---
title: Arch Expectations — Naming & Casing
description: Expectations that assert naming and casing conventions — file-name suffix/prefix, PSR-4 casing correctness, and suspicious/confusable characters.
tags: [pest, arch-testing, expectations, naming, casing]
type: stack
updated: 2026-06-17
related: [pest-arch-expectations, controllers, framework-conventions-first, arch-expectations-file-type]
---

# Arch Expectations — Naming & Casing

Assert that names follow the conventions the framework and your teammates rely on
(see [[framework-conventions-first]]).

| Expectation                    | Asserts…                                                                     |
|--------------------------------|------------------------------------------------------------------------------|
| `toHaveSuffix('Controller')`   | every file name ends with the given suffix.                                  |
| `toHavePrefix('Helper')`       | every file name starts with the given prefix (often used with `not->`).      |
| `toBeCasedCorrectly()`         | class names match file/directory casing (PSR-4 compliance).                  |
| `toHaveSuspiciousCharacters()` | flags suspicious/confusable characters (**needs `intl`**). Use with `not->`. |

## Where these land in the manual

- `toHaveSuffix('Controller')` → [[controllers]] (also covered by the
  [[pest-arch-presets|`laravel()` preset]]). The same pattern enforces `Service`,
  `Request`, `Job`, etc. suffixes for the other [[laravel-building-blocks|building
  blocks]].
- `toBeCasedCorrectly()` → PSR-4 hygiene across the whole app.
- `not->toHaveSuspiciousCharacters()` → guards against homoglyph/confusable
  characters sneaking into identifiers (one of the `intl`-dependent rules — see
  [[pest-arch-pitfalls]]).
