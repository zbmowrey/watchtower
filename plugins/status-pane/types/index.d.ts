export type StatusPaneActivity = {
  kind: 'started' | 'working' | 'replied' | 'stopped'
  at: number
}

export type StatusPaneLimit = {
  percentUsed: number
  resetsAt: string | null
} | null

export type StatusPanePull = {
  number: string
  state: string
  title: string
  passed: number
  failed: number
}

export type StatusPaneWorkspace = {
  repo: string | null
  cwd: string
  branch: string | null
  pr: StatusPanePull | null
}

export type StatusPaneModel = {
  model: string
  effort: string | null
  tokens: number | null
  window: number | null
  percent: number | null
  costUsd: number | null
}

/** What Claude sets through the mod's tool; an empty string is unset. */
export type StatusPaneNotes = {
  focus: string
  ticket: string
  pr: string
}

declare module 'claude-code' {
  // The mod's own tool, so a hook on it and a test's call are typed.
  interface McpToolInputs {
    'mcp__status-pane__set_status': Partial<StatusPaneNotes>
  }

  interface PluginState {
    'status-pane': {
      now: number
      notes: Shaped<StatusPaneNotes>
      activity: Shaped<StatusPaneActivity>
      week: Shaped<StatusPaneLimit>
      workspace: Shaped<StatusPaneWorkspace>
      model: Shaped<StatusPaneModel>
    }
  }
}
