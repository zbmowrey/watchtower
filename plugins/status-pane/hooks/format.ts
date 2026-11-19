// Pure helpers: everything the pane prints is computed here, so it is tested
// without a session.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
export const WEEK = 7 * DAY

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** `45s`, `12m`, `1h45m`, `5h`, `3d 20h`: two units at most. */
export function span(ms: number): string {
  const safe = Math.max(0, ms)

  if (safe < MINUTE) {
    return `${Math.floor(safe / 1000)}s`
  }

  if (safe < HOUR) {
    return `${Math.floor(safe / MINUTE)}m`
  }

  if (safe < DAY) {
    const minutes = Math.floor((safe % HOUR) / MINUTE)
    const hours = `${Math.floor(safe / HOUR)}h`

    return minutes === 0 ? hours : `${hours}${String(minutes).padStart(2, '0')}m`
  }

  return `${Math.floor(safe / DAY)}d ${Math.floor((safe % DAY) / HOUR)}h`
}

/** `Mon 05:00`, in the machine's own time zone. */
export function clockTime(at: number): string {
  const date = new Date(at)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${DAYS[date.getDay()] ?? ''} ${hours}:${minutes}`
}

/** `128k`, `1.0M`. */
export function tokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }

  if (count >= 1000) {
    return `${Math.round(count / 1000)}k`
  }

  return String(count)
}

/** How many of `width` cells a bar fills for `percent`, never past either end. */
export function filled(percent: number, width: number): number {
  const clamped = Math.min(100, Math.max(0, percent))
  const cells = Math.round((clamped / 100) * width)

  // Anything above zero shows at least one cell; only a full bar is full.
  if (clamped > 0 && cells === 0) {
    return 1
  }

  if (clamped < 100 && cells === width) {
    return Math.max(0, width - 1)
  }

  return cells
}

export type Pace = {
  /** How far through the window we are, 0 to 100. */
  elapsedPercent: number
  resetsAt: number
  /**
   * `safe`: something is left at the reset. `tight`: the limit is hit shortly
   * before it. `over`: well before it. `unknown`: too early to project.
   */
  tone: 'safe' | 'tight' | 'over' | 'unknown'
  /** The verdict, drawn in the tone's color. */
  head: string
  /** What backs it, drawn plain. */
  rest: string
}

/**
 * Where the window's usage is heading: the share used so far, carried forward
 * at the same rate. `warnMs` is how close to the reset running out still
 * counts as only tight.
 */
export function trend(
  percentUsed: number,
  resetsAt: number,
  now: number,
  warnMs: number,
  windowMs: number = WEEK,
): Pace {
  const remaining = Math.min(windowMs, Math.max(0, resetsAt - now))
  const elapsed = windowMs - remaining
  const elapsedPercent = (elapsed / windowMs) * 100
  const base = { elapsedPercent, resetsAt }

  if (percentUsed >= 100) {
    return { ...base, tone: 'over', head: 'limit reached', rest: '' }
  }

  // Early in a window one long turn swings the projection wildly.
  if (elapsedPercent < 2 || percentUsed <= 0) {
    return { ...base, tone: 'unknown', head: 'too early to tell', rest: '' }
  }

  const projected = Math.round((percentUsed / elapsedPercent) * 100)
  // How long the rest of the budget lasts at the rate used so far.
  const lastsFor = ((100 - percentUsed) * elapsed) / percentUsed
  const short = remaining - lastsFor

  if (short <= 0) {
    return {
      ...base,
      tone: 'safe',
      head: projected >= 85 ? 'on track' : 'under pace',
      rest: `~${projected}% used at reset`,
    }
  }

  return {
    ...base,
    tone: short <= warnMs ? 'tight' : 'over',
    head: short <= warnMs ? 'tight' : 'over cap',
    rest: `runs out ~${clockTime(now + lastsFor)}, ${span(short)} early`,
  }
}

/** `claude-opus-5-5[1m]` as `Opus 5.5`; a name already readable stays. */
export function modelName(model: string): string {
  const id = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{6,})?(?:\[.*\])?$/i.exec(
    model.trim(),
  )

  if (id === null) {
    return model.replace(/\s*\[.*\]$/, '').trim()
  }

  const family = id[1] ?? ''
  const version = id[3] === undefined ? id[2] : `${id[2]}.${id[3]}`

  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version}`
}

/** A ticket id a branch name carries, as `feature/ABC-123-thing` does. */
export function ticketOf(branch: string): string | null {
  return /(?:^|[/_-])([A-Z][A-Z0-9]+-\d+)(?:$|[/_-])/.exec(branch)?.[1] ?? null
}

/** A pull request as Claude named it, `482`, `#482` or its URL, as `#482`. */
export function pullLabel(reference: string): string {
  const number = /(?:^#?|\/pull\/)(\d+)\/?$/.exec(reference.trim())?.[1]

  return number === undefined ? reference.trim() : `#${number}`
}

/** The path under the home directory as `~/...`. */
export function tilde(path: string, home: string | undefined): string {
  if (home === undefined || home === '') {
    return path
  }

  if (path === home) {
    return '~'
  }

  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

/** The last segment of a path. */
export function baseName(path: string): string {
  const parts = path.split('/').filter(part => part !== '')

  return parts[parts.length - 1] ?? path
}
