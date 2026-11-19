# status-pane

A pane beside your Claude Code session that shows where the session stands.

```
Activity ─────────────────────────────────────────────────────
last      1m ago · Claude replied

Model ────────────────────────────────────────────────────────
model     Opus 5.5 effort medium
context   ███░░░░░░░░░░░░░░░░░░░░░░░░░  10% 102k / 1.0M
cost      $0.94 est.

Weekly · 7d cap ──────────────────────────────────────────────
used      █████████████░░░░░░░░░░░░░░░  45%
elapsed   █████████████░░░░░░░░░░░░░░░  45%
resets    Mon 05:00 in 3d 20h
trend     on track ~97% used at reset

Workspace ────────────────────────────────────────────────────
repo      watchtower
pwd       ~/code/watchtower
branch    ⑂ feature/ABC-123-cache
focus     Caching API Calls for Efficiency

Task ─────────────────────────────────────────────────────────
ticket    ABC-123
pr        #482 merged ✓6
          Cache API calls
```

## Install

At the prompt of a terminal session:

```
/plugin install status-pane --marketplace zbmowrey/watchtower
```

Answer `y` to add the marketplace, then pick a scope. The pane opens when a session starts.
`/status-pane` opens it again after you close it.

The pane docks on the right in the fullscreen layout once the terminal is wide enough. In a
narrower terminal, or outside fullscreen, it sits above the prompt.

## What each line reads

| Line | Source |
|---|---|
| `last` / `now` | Time since Claude's last reply, or how long the current turn has run. Turns amber after 30 minutes of waiting on you. |
| `used` | The weekly usage window your plan reports. Empty until the first reply of a session, and off a subscription. |
| `elapsed`, `resets` | How far through the week you are, and when it resets, in your machine's time zone. |
| `trend` | Weekly usage carried forward at the rate used so far. See the next section. |
| `repo`, `pwd`, `branch` | Read from the session and `git`, refreshed every 30 seconds and after each shell command. |
| `focus` | Set by Claude. See below. |
| `ticket` | Set by Claude, or an id like `ABC-123` found in the branch name. |
| `pr` | Number, state, passing and failing checks, and title from `gh pr view`, for the pull request Claude named or else the current branch's. Needs the GitHub CLI signed in. |
| `model` | The session's model and the effort of its last request. |
| `context` | Tokens in the context window against its size. |
| `cost` | Claude Code's own estimate for the session. It is an estimate, and on a subscription it is no charge. |

## Bar colour

The `used` bar is coloured by where the week is heading, not by how full it is. The pane
carries your usage forward at the rate used so far and asks whether the limit lasts to the reset.

| Colour | Meaning | `trend` reads |
|---|---|---|
| Green | Something is left at the reset. | `under pace` or `on track`, with the share projected at reset |
| Yellow | The limit runs out before the reset, by no more than the warning zone. | `tight`, with when it runs out and how early |
| Red | The limit runs out earlier than that, or is already reached. | `over cap` or `limit reached` |

The warning zone is 720 minutes (12 hours) by default. Change it with the plugin's
`warnMinutes` option. In the first few hours of a week there is too little to project from, so
the bar stays green and `trend` says so. The `context` bar has no pace and is always green.

## Focus, ticket and pull request

Claude keeps these three lines current. The mod registers one tool, `set_status`, and adds a
short section to the system prompt saying when to call it:

- `focus` is the general purpose of the session in two to six words, such as "Caching API Calls
  for Efficiency". It is set once the purpose is clear and changes only when the purpose does,
  not at each step of the same task.
- `ticket` is the issue the work belongs to, as an identifier or a path.
- `pr` is the pull request, as a number or URL. Left unset, the pane uses the current branch's.

Nothing is written into the chat. The tool call needs no permission prompt, since it only
changes the pane's own values, and its row is hidden from the conversation. The full transcript
view still shows it.

Until a focus is set, each prompt you type carries a one-line reminder to Claude that the pane
is waiting for one. The values are saved per session, so a resumed session opens with its own.
`/clear` resets them.

## Development

```
claude plugin validate plugins/status-pane
claude plugin test plugins/status-pane
claude --plugin-dir plugins/status-pane
```

The API this is built on is in early access and changes between Claude Code releases. Built
against 2.1.328.
