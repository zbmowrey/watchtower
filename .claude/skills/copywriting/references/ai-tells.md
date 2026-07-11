# AI-tell grep checklist

The operational checklist for a compliance scrub. Load it when cleaning copy or running the
pre-ship check in `SKILL.md`. It merges house-style bans with the external research on AI-writing
tells (the excess-vocabulary studies and structural-tell surveys cited at the foot of this file).

**How to read it.** No single word or mark proves AI authorship. LLMs learned these habits from
humans, and careful or non-native writers trip them constantly. The signal is **density and
co-occurrence**: several stacked in one short passage. Use this to **revise our own prose, never
to convict someone else's.** Detectors are not evidence.

Two handling levels:

- **HARD BAN:** any hit fails. House style, independent of the forensic debate.
- **SCRUTINY:** not auto-fail. Quote each hit, rule in context (the contrast/term may be real),
  fail only on a genuine tell or a cluster.

## HARD BAN (fail on any hit)

```
—                       em-dash, anywhere (en-dash – only in numeric ranges)
‘ ’ “ ”                 smart quotes when the file uses straight quotes
it's not just ... it's   / isn't about ... it's about      (negation-elevation)
not only ... but also
at its core
at the end of the day
ultimately,              as an opener or closer
that said, / that being said, / with that being said,
indeed, / certainly,     as a sentence opener
moreover / furthermore / additionally,
whether you're a ... or a
in this post I will / in this article we'll / in this article, we will
```

Mechanics that are also hard bans: Title Case On Every Heading (when the doc is sentence case),
mid-paragraph bold for emphasis, emoji in content (unless asked).

## SCRUTINY (flag, quote, rule in context: judge density)

```
# Excess-vocabulary words (rare words that spiked post-2023; one or two is meaningful)
delve / delves / delving, underscore(s), showcase / showcasing, boasts (inanimate subject),
tapestry, realm, testament, landscape (as metaphor), meticulous(ly), pivotal, intricate,
robust, seamless, comprehensive, crucial, vibrant, elevate, foster, leverage

# Stock significance / puffery phrases
a testament to / stands as a testament to / serves as a testament to
plays a (crucial / vital / pivotal / key) role
it's worth noting / it should be noted / it bears mentioning
in today's (fast-paced world / digital age / landscape)
navigate the complexities of / complex landscape
when it comes to
a (diverse array / wide range) of
rich cultural heritage / enduring legacy / indelible mark
nestled in / in the heart of / vibrant community

# Unsourced authority appeals (we cite instead, or cut)
studies show / experts agree / research indicates / it is widely (known / regarded)

# Structural signposting (narrating your own structure)
in conclusion / in summary / to sum up
let's dive in / dive into / let's explore
it's important to note / it is important to note
on one hand ... on the other hand
```

A SCRUTINY word is not contraband. "A robust retry policy" is fine. "Robust" three times in two
paragraphs next to "seamless" and "comprehensive" is the tell.

## Structural tells (above the sentence: what makes prose "feel" AI)

1. **Negation-elevation** ("it's not just X, it's Y"): the most reliable fingerprint. If Y is the
   real claim, state Y and delete the fake X. (House exception: the real "X is not Y. It is Z."
   reframe is legitimate when Z is a colder, more accurate label and the contrast is real.)
2. **Tricolon saturation**: one rule-of-three is elegant; three in a row is a failure of taste.
   One precise adjective beats three generic ones.
3. **Rhetorical signposting**: "In conclusion," "Let's dive in." Cut the scaffolding; start on
   the substance.
4. **Recapping conclusion**: re-litigates everything. End on the sharpest single thought instead.
5. **False balance / reflexive hedging**: "While X has benefits, it also carries risks." Take the
   position the evidence supports.
6. **Chronic over-qualification**: "might be worth considering," "could potentially suggest."
   Make the claim or cut it.
7. **Epiphany flourish**: paragraphs that resolve into "...and that changes everything" on a fixed
   schedule.
8. **Manufactured warmth**: prefab empathy with no specific observer behind it.
9. **Low burstiness**: uniform 14-to-22-word sentences. Vary length hard; drop a fragment after a
   long clause-heavy sentence.
10. **Section symmetry / list overuse / heavy mechanical transitions**: template, not thought.
    Let structure follow the argument's weight; default to prose; cut "moreover/furthermore."

## The em-dash replacement ladder

Replace each one by context, in this order of preference. Do not bulk-swap one form for all.

1. **Parentheses:** a non-essential aside or appositive.
2. **Comma:** a short parenthetical clause that reads smoothly inline.
3. **Colon:** when the second clause defines, expands, or lists the first.
4. **Semicolon:** two closely related independent clauses.
5. **Period:** when the thought warrants its own sentence.

## Sources

Lexical signal: Kobak et al., "Delving into LLM-assisted writing... excess vocabulary"
(*Science Advances*, 2025; arXiv 2406.07016); Wikipedia "Signs of AI writing" (WikiProject AI
Cleanup). Detection limits (why this is for revising, never convicting): Liang et al., "GPT
Detectors Are Biased Against Non-Native English Writers" (*Patterns*, 2023); Sadasivan et al.,
"Can AI-Generated Text Be Reliably Detected?" (arXiv 2303.11156). The hard bans are house style,
independent of this research.
