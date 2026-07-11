---
title: Common Arch-Testing Pitfalls
description: The traps that erode an arch suite — over-ignoring, treating the framework as a dependency, writing rules you won't follow, intl-dependent rules in CI, and strict-equality breakage from mixed == / ===.
tags: [pest, arch-testing, pitfalls, ci, intl]
type: stack
updated: 2026-06-17
related: [pest-arch-rollout, pest-arch-modifiers, pest-arch-presets, type-safety-and-strictness, arch-expectations-structure-hygiene]
---

# Common Arch-Testing Pitfalls

- **Over-ignoring.** Every `ignoring()` is a *documented exception*, not a place to
  hide debt. Review them periodically; a rule that's mostly ignores is telling you
  the convention is wrong. See [[pest-arch-modifiers]].
- **Treating the framework as a dependency.** Add the global `ignore(['Illuminate'])`
  so rules focus on **your** code, not Laravel's internals (the
  [[pest-arch-modifiers|global ignore]]).
- **Writing rules you don't intend to follow.** As the community puts it: *you
  can't implement rules you don't intend to follow.* Decide the convention first,
  then encode it — the philosophy behind the whole [[laravel-architecture-manual|manual]].
- **`intl`-dependent rules in CI.** The [[pest-arch-presets|`php()` preset]] and a
  few expectations (e.g. `toHaveSuspiciousCharacters()`) require the **`intl`
  extension** — make sure your CI image has it.
- **Forgetting strict types breaks some rules.** Mixing `==` and `===` across the
  codebase will trip `toUseStrictEquality()`; adopt a formatter/Rector pass
  alongside the rules. See [[type-safety-and-strictness]] and
  [[arch-expectations-structure-hygiene]].

These are the operational counterpart to [[pest-arch-rollout|incremental
adoption]] — most show up exactly when you start tightening.
