import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register } from 'claude-code'

import type {
  StatusPaneActivity,
  StatusPaneLimit,
  StatusPaneNotes,
  StatusPanePull,
} from '../types'
import {
  baseName,
  clockTime,
  filled,
  modelName,
  pullLabel,
  span,
  ticketOf,
  tilde,
  tokens,
  trend,
} from './format'
import type { Pace } from './format'

const PANE = 'status-pane'
const TOOL = 'mcp__status-pane__set_status'
const TICK_MS = 30_000
const LABEL_WIDTH = 10
const PANE_COLUMNS = 62
const NONE = '—'
const DEFAULT_WARN_MINUTES = 720
const KEPT_SESSIONS = 50

const ORANGE = '#cf8a6b'
const GREEN = '#6abf69'
const AMBER = '#d9a441'
const RED = '#e06c75'
const PURPLE = '#a68ad8'

type Shade = { fill: Color; track: Color }

const SHADES = {
  used: { fill: GREEN, track: '#33473a' },
  warm: { fill: AMBER, track: '#4a4130' },
  high: { fill: RED, track: '#4a3336' },
  elapsed: { fill: '#5c5f62', track: '#33363a' },
} satisfies Record<string, Shade>

// The usage bar takes its colour from where the week is heading, not from how
// full it is.
const PACE_SHADE: Record<Pace['tone'], Shade> = {
  safe: SHADES.used,
  unknown: SHADES.used,
  tight: SHADES.warm,
  over: SHADES.high,
}
const PACE_COLOR: Record<Pace['tone'], Color> = {
  safe: GREEN,
  unknown: 'inactive',
  tight: AMBER,
  over: RED,
}

const STATES: Record<string, Color> = {
  open: GREEN,
  merged: PURPLE,
  closed: RED,
  draft: 'inactive',
}

const UNSET: StatusPaneNotes = { focus: '', ticket: '', pr: '' }

// A tag changes when its value's fields do: a value an earlier version of
// this code stored outlives a reload, and reads as the initial under a new tag.
const now = atom({ plugin: 'status-pane', key: 'now' } as const, 0)
const notes = atom({ plugin: 'status-pane', key: 'notes' } as const, UNSET, {
  shape: 'notes-1',
})
const activity = atom(
  { plugin: 'status-pane', key: 'activity' } as const,
  { kind: 'started', at: 0 },
  { shape: 'activity-1' },
)
const week = atom({ plugin: 'status-pane', key: 'week' } as const, null, {
  shape: 'week-2',
})
const workspace = atom(
  { plugin: 'status-pane', key: 'workspace' } as const,
  { repo: null, cwd: '', branch: null, pr: null },
  { shape: 'workspace-2' },
)
const model = atom(
  { plugin: 'status-pane', key: 'model' } as const,
  {
    model: '',
    effort: null,
    tokens: null,
    window: null,
    percent: null,
    costUsd: null,
  },
  { shape: 'model-1' },
)

const STATUS_SECTION = [
  `The person keeps a status pane beside this chat, and you keep three of its lines current by calling the \`${TOOL}\` tool. Never write these values into a reply, and never mention the pane or the tool: the call is invisible to the person and needs no comment.`,
  '`focus`: a short description of the general purpose this session is working toward, two to six words in title case, such as `Caching API Calls for Efficiency`, `Troubleshooting Email Server` or `Updating Insecure Dependencies`. Set it once the purpose is clear, and again only when the overall purpose changes. Steps of one task share one focus: opening a pull request and then editing its body is no change.',
  '`ticket`: the issue or ticket the work belongs to, as an identifier or a path. Set it when you learn it.',
  '`pr`: the pull request the work belongs to, as a number or URL. Set it when you open one or are pointed at one. Left unset, the pane finds the pull request of the current branch by itself.',
  'Pass only the values that changed; an empty string clears one. Make the call alongside the other tool calls of a turn when there are any, and do not repeat a value that still holds.',
].join('\n')

const FOCUS_NUDGE = `status-pane: no focus is set for this session yet. Once the purpose of the work is clear, set it with the \`${TOOL}\` tool (two to six words), without mentioning it.`

// A pull-request lookup is a network call, so it runs when the branch changes
// or a command may have changed the answer, never on the timer.
const PR_COMMAND = /\bgh\s+pr\b|\bgit\s+(?:push|checkout|switch|worktree)\b/

const PASSED = new Set(['SUCCESS'])
const FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED'])

type Engine = EngineInterface

async function run(
  $: Engine,
  argv: readonly string[],
  cwd: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const ran = await $.process.run(argv, { cwd, timeoutMs })

    return ran.exitCode === 0 ? ran.stdout.trim() : null
  } catch {
    // Not installed, or still running at the timeout: there is no answer.
    return null
  }
}

/** The pull request Claude named, or with no name the current branch's. */
async function pullRequest(
  $: Engine,
  cwd: string,
  reference: string,
): Promise<StatusPanePull | null> {
  const out = await run(
    $,
    [
      'gh',
      'pr',
      'view',
      ...(reference === '' ? [] : [reference]),
      '--json',
      'number,state,isDraft,title,statusCheckRollup',
    ],
    cwd,
    10_000,
  )

  if (out === null || out === '') {
    return null
  }

  try {
    const found = JSON.parse(out) as {
      number?: number
      state?: string
      isDraft?: boolean
      title?: string
      statusCheckRollup?: readonly { conclusion?: string; state?: string }[]
    }

    if (typeof found.number !== 'number') {
      return null
    }

    const checks = (found.statusCheckRollup ?? []).map(
      check => check.conclusion || check.state || '',
    )

    return {
      number: `#${found.number}`,
      state: found.isDraft === true ? 'draft' : (found.state ?? '').toLowerCase(),
      title: found.title ?? '',
      passed: checks.filter(check => PASSED.has(check)).length,
      failed: checks.filter(check => FAILED.has(check)).length,
    }
  } catch {
    return null
  }
}

async function refreshWorkspace($: Engine, isPrStale: boolean): Promise<void> {
  const cwd = await $.session.cwd()
  const repo = await $.session.repo()
  const branch =
    repo === null
      ? null
      : await run($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd, 5000)
  const reference = (await read($, notes)).pr
  const before = await read($, workspace)
  const hasMoved = before.branch !== branch || before.repo !== (repo?.root ?? null)

  await update($, workspace, was => ({
    repo: repo?.root ?? null,
    cwd,
    branch,
    // A named pull request does not move with the branch.
    pr: hasMoved && reference === '' ? null : was.pr,
  }))

  if ((branch === null && reference === '') || !(hasMoved || isPrStale)) {
    return
  }

  const pr = await pullRequest($, cwd, reference)

  // The branch or the named pull request may have changed while this ran.
  const named = (await read($, notes)).pr

  await update($, workspace, was =>
    was.branch === branch && named === reference ? { ...was, pr } : was,
  )
}

async function refreshUsage($: Engine): Promise<void> {
  const usage = await $.session.usage()
  const name = await $.session.model()
  const sevenDay = usage.rateLimits.find(limit => limit.kind === 'seven_day')
  const reading: StatusPaneLimit =
    sevenDay === undefined
      ? null
      : {
          percentUsed: sevenDay.percentUsed,
          resetsAt: sevenDay.resetsAt ?? null,
        }

  await update($, week, () => reading)
  await update($, model, was => ({
    ...was,
    model: name,
    tokens: usage.context.tokens ?? null,
    window: usage.context.window,
    percent: usage.context.percent ?? null,
    costUsd: usage.cost?.usd ?? null,
  }))
}

type Kept = Record<string, StatusPaneNotes & { at: number }>

async function kept($: Engine): Promise<Kept> {
  const stored = await $.store.get('sessions')

  return typeof stored === 'object' && stored !== null ? (stored as Kept) : {}
}

/** Notes outlive the process, so a resumed session opens with its own. */
async function keep($: Engine, value: StatusPaneNotes): Promise<void> {
  const id = await $.session.id()
  const at = await $.clock.now()
  const rows = Object.entries({ ...(await kept($)), [id]: { ...value, at } })
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEPT_SESSIONS)

  await $.store.set('sessions', Object.fromEntries(rows))
}

async function restore($: Engine): Promise<void> {
  const current = await read($, notes)

  if (current.focus !== '' || current.ticket !== '' || current.pr !== '') {
    return
  }

  const was = (await kept($))[await $.session.id()]

  if (was !== undefined) {
    await update($, notes, () => ({
      focus: String(was.focus ?? ''),
      ticket: String(was.ticket ?? ''),
      pr: String(was.pr ?? ''),
    }))
  }
}

export const register: Register = (on, options) => {
  const warnMinutes =
    typeof options.warnMinutes === 'number'
      ? options.warnMinutes
      : DEFAULT_WARN_MINUTES
  const warnMs = Math.max(0, warnMinutes) * 60_000

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'status-pane',
      description: 'Show the status pane',
    })
    await $.tool.register({
      name: 'set_status',
      description:
        "Sets the focus, ticket and pull request shown in the person's status pane. Pass only the values that changed; an empty string clears one. The call is invisible to the person: never mention it.",
      inputSchema: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            description:
              'The general purpose of the session, two to six words in title case.',
          },
          ticket: {
            type: 'string',
            description: 'The issue or ticket, as an identifier or a path.',
          },
          pr: {
            type: 'string',
            description: 'The pull request, as a number or URL.',
          },
        },
        additionalProperties: false,
      },
      isDeferred: false,
    })

    const at = await $.clock.now()
    const started: StatusPaneActivity = { kind: 'started', at }

    await update($, now, () => at)
    await update($, activity, was => (was.at === 0 ? started : was))
    await restore($).catch(() => undefined)
    await refreshUsage($)
    // The pull-request lookup is slow and the first prompt does not wait on it.
    void refreshWorkspace($, true).catch(() => undefined)

    $.clock.every(TICK_MS, () => {
      void (async () => {
        const tick = await $.clock.now()
        await update($, now, () => tick)
        await refreshWorkspace($, false)
      })().catch(() => undefined)
    })

    void $.ui.open({ id: PANE, title: 'Status', columns: PANE_COLUMNS })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, notes, () => UNSET)
    }

    return next(e)
  })

  on('command.run', { command: 'status-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Status', columns: PANE_COLUMNS })

    return { text: 'Status pane opened.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    return {
      sections: [
        ...composed.sections,
        { id: 'status-pane:status', text: STATUS_SECTION, scope: 'session' },
      ],
    }
  })

  on('prompt.submit', async ($, e, next) => {
    const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'bridge'

    if (!isTyped || e.command !== undefined || (await read($, notes)).focus !== '') {
      return next(e)
    }

    return next({ ...e, context: [...(e.context ?? []), FOCUS_NUDGE] })
  })

  // Answered here, ahead of the permission check: the call only writes the
  // pane's own values, so it never asks.
  on('tool.call', { tool: TOOL }, async ($, e) => {
    const before = await read($, notes)
    const pick = (key: keyof StatusPaneNotes) => {
      const value: unknown = e[key]

      return typeof value === 'string' ? value.trim().slice(0, 200) : before[key]
    }
    const after: StatusPaneNotes = {
      focus: pick('focus'),
      ticket: pick('ticket'),
      pr: pick('pr'),
    }

    await update($, notes, () => after)
    await keep($, after).catch(() => undefined)

    if (after.pr !== before.pr) {
      await update($, workspace, was => ({ ...was, pr: null }))
      void refreshWorkspace($, true).catch(() => undefined)
    }

    return { result: 'Status pane updated.' }
  })

  // The call is bookkeeping, so its row stays out of the chat. The full
  // transcript (ctrl+o) still shows it.
  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    if (e.props.tool !== TOOL || e.props.isExpanded === true) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box display="none" />
  })

  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.props.tool !== TOOL || e.props.isExpanded === true) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box display="none" />
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      const working: StatusPaneActivity = { kind: 'working', at }

      await update($, now, () => at)
      await update($, activity, () => working)
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? null : String(e.effort)

      void update($, model, was => ({ ...was, effort })).catch(() => undefined)
    }

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      const ended: StatusPaneActivity = {
        kind: e.isAborted ? 'stopped' : 'replied',
        at,
      }

      await update($, now, () => at)
      await update($, activity, () => ended)
      await refreshUsage($)
      void refreshWorkspace($, false).catch(() => undefined)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refreshUsage($)

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)

    if (e.agentId === undefined) {
      void refreshWorkspace($, PR_COMMAND.test(e.command)).catch(() => undefined)
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const columns = Math.max(30, e.props.bodyColumns)
    const room = columns - LABEL_WIDTH
    const barWidth = Math.max(8, Math.min(28, room - 18))

    const at = await read($, now)
    const did = await read($, activity)
    const used = await read($, week)
    const where = await read($, workspace)
    const runs = await read($, model)
    const noted = await read($, notes)
    const home = await $.env.get('HOME')

    const heading = (title: string, note?: string) => {
      const taken = title.length + (note === undefined ? 0 : note.length + 3) + 1

      return (
        <Box marginTop={1}>
          <Text bold color={ORANGE}>
            {title}
          </Text>
          {note !== undefined && <Text dimColor>{` · ${note}`}</Text>}
          <Text dimColor>{` ${'─'.repeat(Math.max(0, columns - taken))}`}</Text>
        </Box>
      )
    }

    const label = (name: string) => <Text dimColor>{name.padEnd(LABEL_WIDTH)}</Text>

    const plain = (name: string, value: string, color?: Color) => (
      <Box>
        {label(name)}
        <Text color={color} wrap="truncate-end">
          {value}
        </Text>
      </Box>
    )

    const muted = (name: string, value: string) => (
      <Box>
        {label(name)}
        <Text dimColor wrap="truncate-end">
          {value}
        </Text>
      </Box>
    )

    const percentOf = (percent: number) => `${Math.round(percent)}%`.padStart(4)

    const bar = (name: string, percent: number, shade: Shade, detail?: string) => {
      const cells = filled(percent, barWidth)

      return (
        <Box>
          {label(name)}
          <Text backgroundColor={shade.fill}>{' '.repeat(cells)}</Text>
          <Text backgroundColor={shade.track}>{' '.repeat(barWidth - cells)}</Text>
          <Text bold>{` ${percentOf(percent)}`}</Text>
          {detail !== undefined && (
            <Text dimColor wrap="truncate-end">{` ${detail}`}</Text>
          )}
        </Box>
      )
    }

    const WHAT: Record<StatusPaneActivity['kind'], string> = {
      started: 'session started',
      working: 'Claude is working',
      replied: 'Claude replied',
      stopped: 'you stopped the turn',
    }
    const waited = span(at - did.at)
    const isWaiting = did.kind === 'replied' || did.kind === 'stopped'
    const isLong = isWaiting && at - did.at >= 30 * 60_000

    const resetsAt = used?.resetsAt == null ? NaN : Date.parse(used.resetsAt)
    const going =
      used === null || Number.isNaN(resetsAt)
        ? null
        : trend(used.percentUsed, resetsAt, at, warnMs)

    const tail = (path: string) =>
      path.length > room ? `…${path.slice(path.length - room + 1)}` : path

    const issue = noted.ticket !== '' ? noted.ticket : ticketOf(where.branch ?? '')
    // A pull request Claude named shows by its label until the lookup lands.
    const pull: StatusPanePull | null =
      where.pr ??
      (noted.pr === ''
        ? null
        : {
            number: pullLabel(noted.pr),
            state: '',
            title: '',
            passed: 0,
            failed: 0,
          })

    return (
      <Box flexDirection="column">
        {heading('Activity')}
        <Box>
          {label(did.kind === 'working' ? 'now' : 'last')}
          <Text bold color={isLong ? AMBER : undefined}>
            {did.kind === 'working' ? waited : `${waited} ago`}
          </Text>
          <Text dimColor wrap="truncate-end">{` · ${WHAT[did.kind]}`}</Text>
        </Box>

        {heading('Model')}
        {runs.model === '' ? (
          muted('model', NONE)
        ) : (
          <Box>
            {label('model')}
            <Text bold>{modelName(runs.model)}</Text>
            {runs.effort !== null && <Text dimColor>{` effort ${runs.effort}`}</Text>}
          </Box>
        )}
        {runs.percent === null || runs.tokens === null || runs.window === null
          ? muted('context', 'no reading yet')
          : bar(
              'context',
              runs.percent,
              SHADES.used,
              `${tokens(runs.tokens)} / ${tokens(runs.window)}`,
            )}
        {runs.costUsd === null ? (
          muted('cost', NONE)
        ) : (
          <Box>
            {label('cost')}
            <Text>{`$${runs.costUsd.toFixed(2)}`}</Text>
            <Text dimColor> est.</Text>
          </Box>
        )}

        {heading('Weekly', '7d cap')}
        {used === null
          ? muted('used', 'no reading yet')
          : bar('used', used.percentUsed, PACE_SHADE[going?.tone ?? 'unknown'])}
        {going !== null && bar('elapsed', going.elapsedPercent, SHADES.elapsed)}
        {going !== null && (
          <Box>
            {label('resets')}
            <Text>{clockTime(going.resetsAt)}</Text>
            <Text dimColor>{` in ${span(going.resetsAt - at)}`}</Text>
          </Box>
        )}
        {going !== null && (
          <Box>
            {label('trend')}
            <Text bold color={PACE_COLOR[going.tone]}>
              {going.head}
            </Text>
            {going.rest !== '' && (
              <Text dimColor wrap="truncate-end">{` ${going.rest}`}</Text>
            )}
          </Box>
        )}

        {heading('Workspace')}
        {where.repo === null
          ? muted('repo', 'N/A')
          : plain('repo', baseName(where.repo), GREEN)}
        {plain('pwd', where.cwd === '' ? NONE : tail(tilde(where.cwd, home)))}
        {where.branch === null
          ? muted('branch', 'N/A')
          : plain('branch', `⑂ ${where.branch}`, GREEN)}
        {noted.focus === ''
          ? muted('focus', 'not set yet')
          : plain('focus', noted.focus)}

        {heading('Task')}
        {issue === null ? (
          muted('ticket', NONE)
        ) : (
          <Box>
            {label('ticket')}
            <Text bold underline wrap="truncate-end">
              {issue}
            </Text>
          </Box>
        )}
        {pull === null ? (
          muted('pr', NONE)
        ) : (
          <Box>
            {label('pr')}
            <Text bold underline>
              {pull.number}
            </Text>
            {pull.state !== '' && (
              <Text color={STATES[pull.state] ?? 'inactive'}>{` ${pull.state}`}</Text>
            )}
            {pull.passed > 0 && <Text color={GREEN}>{` ✓${pull.passed}`}</Text>}
            {pull.failed > 0 && <Text color={RED}>{` ✗${pull.failed}`}</Text>}
          </Box>
        )}
        {pull !== null && pull.title !== '' && muted('', pull.title)}
      </Box>
    )
  })
}
