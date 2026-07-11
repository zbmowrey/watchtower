---
name: copywriting
description: The fleet-wide standard for any public-facing writing. Use this whenever you write or edit words an outside reader will see: landing pages, marketing and brand copy, taglines, value propositions, headlines, CTAs, blog posts, READMEs, release notes, changelogs, announcements, onboarding and email copy, social posts, docs intros, app microcopy. Also use when defining a brand's voice or tone, reviewing copy for AI-writing tells, scrubbing em-dashes, or tightening prose. Trigger even when the user doesn't say "copywriting" or "voice." If the words will be read by a customer, user, or the public, this skill applies. It is self-contained and project-agnostic; a brand's own voice guidelines layer on top of it. It does not govern internal-only artifacts (code comments, commit messages, wiki notes) unless they are going public.
---

# copywriting

The standard for anything a reader outside the team will see, across every project in the fleet.
Self-contained and project-agnostic. The goal is plain: copy that is clear, persuades by being
true and specific, and reads like a sharp human wrote it, not an LLM. It combines a default house
voice, the durable craft of advertising and conversion writing, and a catalog of AI tells to
scrub.

## How to use this

- **Writing or editing any public copy:** write toward the voice and craft below, then run the
  pre-ship checklist before it ships.
- **If the project has its own brand voice** (a brand voice card, a brand-voice doc), load it and
  let it sit on top. The brand card sets *personality* and the lines that brand will and will not
  cross. This skill sets the *floor* that holds for every brand: clarity, craft, and the hard
  bans. When a card and this skill disagree on personality, the card wins; on clarity, craft, and
  the hard bans, this skill holds.
- **Two reference files carry the depth** (read them when you need the detail or the sources):
    - `references/copywriting-frameworks.md`: the persuasion and structure catalog (awareness
      stages, AIDA/PAS, value propositions, headlines, CTAs, proof, web/UX writing, and brand-voice
      frameworks), with sources.
    - `references/ai-tells.md`: the grep checklist for scrubbing AI tells.

## The default voice

The fleet default, unless a brand card adjusts the personality on top. Write like someone who
already had the argument and is telling you the conclusion: open on something concrete, state the
point early and plain, then earn it. The moves that make copy sound human and land:

- **Cold open on a concrete thing** (a number, an artifact, a scene). No throat-clearing, no "In
  this post I will," no thesis road-map sentence.
- **Say the point early and plainly.** State a claim as strongly as is true, and no stronger.
  "Usually a mistake for teams under 30" is strong and defensible; "always wrong" is false;
  "may sometimes not be ideal" is true and useless. Never hedge the central claim. Make it or cut
  it.
- **Long then short.** A dense, loaded sentence sets up a short one that lands like a closed fist.
  Varying sentence length hard also kills the metronomic "reads like AI" rhythm.
- **The reframe: "X is not Y. It is Z,"** where Z is a colder, more accurate label and the
  contrast is real. This is the opposite of the banned "it's not just X, it's Y," which stages a
  fake X to topple and inflate. Here Z replaces a comfortable label with a truer, concrete one.
- **Numbers as rhetoric.** A specific figure out-persuades any adjective. Ogilvy: "I gave nothing
  but facts. No adjectives."
- **Plain, concrete, Anglo-Saxon verbs** carry the load (build, ship, run, books, sends). No
  management-speak except to mock it. When you want to prop a verb up with an adverb, pick a
  better verb instead.
- **Specifics over abstractions. Get the name of the dog.** Replace adjectives with facts,
  numbers, mechanisms.
- **An honest-limits beat** where the argument has real edges. It builds the credibility that
  makes a strong claim trustworthy.
- **End by widening the lens, not recapping**, on a hard line worth quoting.
- **Humor, if any, is dry and rides a concrete metaphor** ("an echo chamber with commit access").
  Edge comes from precision, not slang or volume.

Calibration (the pattern to feel: a long set-up, then a short, cold reframe):

- "Speed without control is not velocity. It is drift with a confident smile."
- "A pipeline without an adversary is a pipeline that agrees with itself. That is not quality.
  That is an echo chamber with commit access."
- "The auditor doesn't want a meeting. The auditor wants evidence."

## The hard bans (house style: a single hit fails)

These are a style choice, not a forensic argument, so they are absolute. The em-dash as an
"AI tell" is actually weak evidence; it is banned anyway because it is house style.

- **No em-dashes (`—`) in prose.** The single most important rule. Replace each one *by context*,
  in this order of preference: parentheses, then comma, then colon, then semicolon, then period.
  En-dashes (`–`) are fine only in numeric ranges (`2014–2024`). Never bulk-swap one substitute
  for all of them; choose per sentence.
- **No LLM phrase tells.** "It's not just X, it's Y" / "This isn't about X, it's about Y"; "Not
  only... but also"; "At its core"; "At the end of the day"; "Ultimately," as an opener or closer;
  "That said," / "With that being said,"; "Indeed," / "Certainly," as openers; "Moreover /
  Furthermore / Additionally"; "Whether you're an X or a Y"; "In this post I will / In this
  article we'll." The full grep list is in `references/ai-tells.md`.
- **Straight quotes**, matching the file. No model-inserted smart quotes.
- **Sentence-case headings**, matching the doc's convention. Not Title Case On Every Word.
- **No emoji** in content unless explicitly asked.
- **No mid-sentence bold** for emphasis. Bold is for headers, deliberate callouts, and the lead
  phrase of a list item. Never sprinkled into a paragraph.

## Speaking as a brand

Voice is the brand's constant personality. Tone is how that personality flexes by context and by
the reader's emotional state. You hold one voice and pick the tone per piece.

- **Clarity and trust come first.** NN/g's research found trustworthiness drives about half of how
  desirable copy feels; friendliness adds under a tenth, and a too-playful tone can actively erode
  credibility. Spend personality carefully, and never at the cost of being understood or believed.
- **Set tone on four dials** (NN/g): formal vs casual, serious vs funny, respectful vs irreverent,
  enthusiastic vs matter-of-fact. Decide where each piece sits instead of writing by vibe.
- **Flex tone to the reader's state.** Patient and prescriptive when they are new; calm and
  blame-free in errors (say what happened and the fix); brief and warm at success; plain and exact
  for billing or legal. The voice stays constant; the tone moves.
- **Define a voice as a few attributes, each with its opposite and do/don't examples**: "we are X,
  not Y." Naming the lines you will not cross matters as much as the positives. Brand archetypes
  (the twelve Jungian archetypes) are a fine way to seed a personality, but treat them as a
  heuristic, not proof.

### Brand voice card (fill one per project)

A brand's own card sits on top of this skill and is what the user means by "guidelines we will
craft." The durable shape:

```
BRAND: ____________   Reading level: ~grade 7-8   POV: second person ("you")
ARCHETYPE (seed, not gospel): ____________

VOICE ATTRIBUTES (3-5, constant)
  1. We are ______ / not ______    Do: ______   Don't: ______
  2. We are ______ / not ______    Do: ______   Don't: ______
  3. We are ______ / not ______    Do: ______   Don't: ______

TONE DEFAULTS (the 4 dials): formal|casual · serious|funny · respectful|irreverent · enthusiastic|matter-of-fact
TONE BY CONTEXT: onboarding (patient) · error (calm, blame-free, give the fix) · success (brief, warm) · billing/legal (plain, exact)

NON-NEGOTIABLES: plain words; active voice; verb-first CTAs; clarity over cleverness; the hard bans hold.
SAMPLE REWRITES (before -> after): ______
```

## The craft: persuade by being true

Borrow the structure and mechanics of good advertising; keep the plain voice. The *register* of
old direct-response (superlatives, manufactured urgency, exclamation hype) is exactly what the
hard bans forbid, but its *principles* almost never conflict. Reconcile it the way Hopkins did a
century ago: specifics beat superlatives, and only real scarcity is honest. Full catalog and
sources: `references/copywriting-frameworks.md`.

- **Match the message to the reader's awareness.** A reader who already knows you and is ready
  gets a headline and a button. A reader who does not feel the problem yet needs the problem named
  first. Length is set by what the reader needs to decide, never by a word count. (Schwartz's five
  states of awareness.)
- **When the category is crowded and every claim sounds the same, lead with a named, true
  mechanism** (how it actually works), not a louder claim. A real mechanism is specificity, not
  hype. (Schwartz's market sophistication.)
- **Sell the outcome, keep the specific.** Run every feature through "so that...": the part after
  is usually the real line. But do not launder a concrete fact into vague benefit-speak. "Backs up
  every 5 minutes" beats "peace of mind"; best is to keep the number and name the payoff.
- **One of everything per page:** one reader, one big idea, one promise, one primary call to
  action. Cut whatever serves a second idea.
- **Make the reader the hero and the brand the guide**, not the other way around. Speak to the job
  they are hiring the product to do and the progress they want, not their demographic.
- **The headline does the heaviest lifting** (far more people read it than the body). Clear before
  clever, specific over superlative, lead with the reader's benefit. A useful test: useful,
  urgent, unique, ultra-specific. Ultra-specific is the lever for a plain voice: swap an adjective
  for a number.
- **Calls to action name the action and its value, and lower friction.** "Get my free audit," not
  "Submit." Put the risk-reducer next to the button ("No card required").
- **Prove it with specifics and honest social proof:** named, numbered, relevant. "45.6M learners"
  beats "trusted by millions"; a real number beats any adjective. Use only the scarcity and
  urgency that are true.
- **Surface the reader's top objections and answer them** in the copy, before they harden.

## Writing for the screen (people scan, they do not read)

- **Front-load the benefit.** Put the most important words first: first in the headline, first in
  the sentence, first in the link. Readers scan in an F-shape and decide in seconds.
- **Inverted pyramid:** conclusion first, detail after. Interest fades down the page.
- **Be succinct.** Draft, then cut. Krug's drill: get rid of half the words, then half of what is
  left. Plan for roughly half the words you would use in print.
- **Make it scannable:** real headings, short paragraphs, a few bold keywords, bullets only for
  genuinely enumerable content.
- **Microcontent stands alone.** A heading, link, button, or subject line is read out of context,
  so it must make sense by itself. No "click here," no bare "learn more."
- **Plain language by default:** short sentences, common words, active voice, "you" for the
  reader, around a grade 7 to 8 reading level for broad audiences.
- **Microcopy:** button labels are a verb plus the outcome; error messages are plain and
  blame-free and say how to fix it; empty states explain what goes here and give one next action.

## The reconciliation (when a framework fights the voice)

The ad canon's principles transfer; its register does not. Keep specificity, reason-why,
you-focus, awareness-matching, the pull from one line to the next, and honest proof. Drop the
superlatives, the fake urgency, the exclamation hype. Clarity outranks cleverness; trust outranks
friendliness; a true, concrete, surprising claim outranks all of it. When a framework (AIDA, PAS,
StoryBrand, the 4 U's) helps you structure a page, use it as a scaffold, not a cage, and let
specificity and real proof do the actual persuading.

## Pre-ship checklist

1. **One idea:** one reader, one promise, one primary CTA.
2. **Claim or value proposition** clear in the first lines, as strong as is true.
3. **Awareness-matched:** length and lead fit what this reader needs to decide.
4. **Benefit front-loaded:** the first words carry the point.
5. **Specifics over adjectives:** facts, numbers, mechanisms, honest proof.
6. **Outcome named, specific kept:** no feature-dump, no vague benefit-speak.
7. **Strong verbs, varied sentence length.**
8. **Scannable:** headings, short paragraphs, microcontent that stands alone.
9. **CTA clear:** action plus value, friction reduced, top objections answered.
10. **Read aloud:** sounds like a sharp human, not a 2024 chatbot.
11. **Cut and close:** the unnecessary is gone; it ends on a hard line, not a recap.
12. **Clean:** zero em-dashes, zero hard-ban tells, straight quotes, sentence-case, no stray bold
    or emoji. Grep `references/ai-tells.md`.

## Doing a scrub (cleaning existing copy)

When asked to clean copy or "make this sound less like AI": grep the draft against
`references/ai-tells.md`. Quote each hit and rule on it. Em-dashes and the other hard bans go,
every one, replaced by context. The SCRUTINY vocabulary (delve, robust, seamless, leverage,
testament, "plays a crucial role," "it's worth noting") is judged by **density, not instance**.
One "robust retry policy" is fine; "robust" next to "seamless" and "comprehensive" in two
paragraphs is the tell. Then read it aloud.

One discipline: this catalog is for **revising our own prose, never for convicting someone
else's.** AI detectors are not evidence (their false-positive rates on plain and non-native human
writing are severe). The ear is the detector.
