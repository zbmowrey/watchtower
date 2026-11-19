import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const HOUR = 3_600_000
const NOW = 1_800_000_000_000
const TOOL = 'mcp__status-pane__set_status'
const START = { cwd: '/', surface: 'terminal', isInteractive: true } as const

const PANE = {
  plugin: 'status-pane',
  component: 'Pane',
  requestId: 'status-pane',
  props: {
    title: 'Status',
    isFocused: false,
    bodyColumns: 62,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const PULL = JSON.stringify({
  number: 482,
  state: 'MERGED',
  isDraft: false,
  title: 'Cache API calls',
  statusCheckRollup: [
    { conclusion: 'SUCCESS' },
    { conclusion: 'SUCCESS' },
    { state: 'SUCCESS' },
    { conclusion: 'FAILURE' },
    { conclusion: 'SKIPPED' },
  ],
})

type World = { percentUsed?: number; stored?: Record<string, unknown> }

// Nothing sits beneath the plugin in a test: these stand for the engine.
function world(on: On, { percentUsed = 44, stored = {} }: World = {}) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME: '/Users/me' })
  mock.store(on, stored)

  on('command.register', () => ({ value: { command: 'status-pane' } }))
  on('tool.register', () => ({ value: { tool: TOOL } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.cwd', () => ({ value: '/Users/me/code/app' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.repo', () => ({
    value: {
      root: '/Users/me/code/app',
      remote: null,
      internal: false,
      name: null,
    },
  }))
  on('session.usage', () => ({
    value: {
      startedAt: NOW,
      context: { tokens: 128_000, window: 1_000_000, percent: 13 },
      rateLimits: [
        {
          kind: 'seven_day',
          percentUsed,
          // A minute past, so the reset still reads 3d 20h once the clock ticks.
          resetsAt: new Date(NOW + 92 * HOUR + 60_000).toISOString(),
        },
      ],
      cost: { usd: 1.35 },
    },
  }))
  on('process.run', (_, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv[0] === 'git' ? 'feature/ABC-123-cache\n' : PULL,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  return clock
}

test('the pane shows every section, on every surface', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  // The workspace is read without holding the session up; let it land.
  await clock.advance(30_000)
  await $.tool.call({ tool: TOOL, focus: 'Caching API Calls' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const has = async (text: RegExp) =>
      expect(await ui.find({ type: 'Text', text })).toBeDefined()

    await has(/session started/)
    await has(/^Weekly$/)
    await has(/^  44%$/)
    await has(/^  45%$/)
    await has(/in 3d 20h/)
    await has(/^on track$/)
    await has(/~97% used at reset/)
    await has(/^app$/)
    await has(/^~\/code\/app$/)
    await has(/^⑂ feature\/ABC-123-cache$/)
    await has(/^Caching API Calls$/)
    await has(/^ABC-123$/)
    await has(/^#482$/)
    await has(/^ merged$/)
    await has(/^ ✓3$/)
    await has(/^ ✗1$/)
    await has(/^Cache API calls$/)
    await has(/^Opus 5\.5$/)
    await has(/^  13%$/)
    await has(/128k \/ 1\.0M/)
    await has(/^\$1\.35$/)
    await ui.unmount()
  }
})

test('the idle timer moves with the clock', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.advance(105 * 60_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^1h45m ago$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /not set yet/ })).toBeDefined()
  await ui.unmount()
})

test('usage burning past the warning zone reads over cap', async ($, on) => {
  // 80% used with 45% of the week gone runs out days early.
  const clock = world(on, { percentUsed: 80 })

  await $.session.start(START)
  await clock.advance(30_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^over cap$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /runs out ~/ })).toBeDefined()
  await ui.unmount()
})

test('Claude sets focus and ticket through the tool', async ($, on) => {
  const clock = world(on)

  await $.session.start(START)
  await clock.advance(30_000)

  const answered = await $.tool.call({
    tool: TOOL,
    focus: 'Updating Insecure Dependencies',
    ticket: 'wiki/todos/app-todos.md',
  })

  expect(answered.result).toBe('Status pane updated.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(
    await ui.find({ type: 'Text', text: /^Updating Insecure Dependencies$/ }),
  ).toBeDefined()
  expect(
    await ui.find({ type: 'Text', text: /^wiki\/todos\/app-todos\.md$/ }),
  ).toBeDefined()
  await ui.unmount()

  // A value left out stays; an empty string clears, back to the branch's id.
  await $.tool.call({ tool: TOOL, ticket: '' })

  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(
    await again.find({ type: 'Text', text: /^Updating Insecure Dependencies$/ }),
  ).toBeDefined()
  expect(await again.find({ type: 'Text', text: /^ABC-123$/ })).toBeDefined()
  await again.unmount()
})

test('a resumed session opens with the notes it had', async ($, on) => {
  const clock = world(on, {
    stored: {
      sessions: {
        'session-1': {
          focus: 'Troubleshooting Email Server',
          ticket: '',
          pr: '',
          at: 1,
        },
      },
    },
  })

  await $.session.start(START)
  await clock.advance(30_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(
    await ui.find({ type: 'Text', text: /^Troubleshooting Email Server$/ }),
  ).toBeDefined()
  await ui.unmount()
})

test("the tool's row stays out of the chat", async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>row</Text>
  })

  const row = {
    plugin: 'status-pane',
    component: 'ToolUse',
    requestId: 't1',
    surface: 'terminal',
  } as const
  const props = {
    tool_use_id: 't1',
    input: {},
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  }

  const hidden = await $.ui.mount({ ...row, props: { ...props, tool: TOOL } })

  expect(await hidden.find({ type: 'Text', text: /row/ })).toBeUndefined()
  await hidden.unmount()

  const shown = await $.ui.mount({ ...row, props: { ...props, tool: 'Bash' } })

  expect(await shown.find({ type: 'Text', text: /row/ })).toBeDefined()
  await shown.unmount()
})
