import { expect, test } from 'claude-code/testing'

import {
  WEEK,
  filled,
  modelName,
  pullLabel,
  span,
  ticketOf,
  tilde,
  tokens,
  trend,
} from '../hooks/format'

const HOUR = 3_600_000
const NOW = 1_800_000_000_000
const WARN = 12 * HOUR

test('a span reads in two units at most', async () => {
  expect(span(45_000)).toBe('45s')
  expect(span(12 * 60_000)).toBe('12m')
  expect(span(105 * 60_000)).toBe('1h45m')
  expect(span(92 * HOUR)).toBe('3d 20h')
  expect(span(-5)).toBe('0s')
})

test('token counts shorten', async () => {
  expect(tokens(128_000)).toBe('128k')
  expect(tokens(1_000_000)).toBe('1.0M')
  expect(tokens(640)).toBe('640')
})

test('a bar is empty only at zero and full only at a hundred', async () => {
  expect(filled(0, 20)).toBe(0)
  expect(filled(1, 20)).toBe(1)
  expect(filled(50, 20)).toBe(10)
  expect(filled(99, 20)).toBe(19)
  expect(filled(100, 20)).toBe(20)
  expect(filled(140, 20)).toBe(20)
})

test('usage level with the week is safe and on track', async () => {
  // 3d 20h left of 7 days: 45% of the week gone, 44% used.
  const going = trend(44, NOW + 92 * HOUR, NOW, WARN)

  expect(Math.round(going.elapsedPercent)).toBe(45)
  expect(going.tone).toBe('safe')
  expect(going.head).toBe('on track')
  expect(going.rest).toBe('~97% used at reset')
})

test('usage behind the week is safe and under pace', async () => {
  const going = trend(20, NOW + WEEK / 2, NOW, WARN)

  expect(going.tone).toBe('safe')
  expect(going.head).toBe('under pace')
  expect(going.rest).toBe('~40% used at reset')
})

test('running out inside the warning zone is tight', async () => {
  // Half the week gone, 53% used: the rest lasts 74.5h of the 84h left.
  const going = trend(53, NOW + WEEK / 2, NOW, WARN)

  expect(going.tone).toBe('tight')
  expect(going.head).toBe('tight')
  expect(going.rest.startsWith('runs out ~')).toBe(true)
  expect(going.rest.endsWith(', 9h30m early')).toBe(true)
})

test('running out sooner than the warning zone is over', async () => {
  expect(trend(80, NOW + WEEK / 2, NOW, WARN).tone).toBe('over')
  expect(trend(80, NOW + WEEK / 2, NOW, WARN).head).toBe('over cap')
  // With no warning zone, any shortfall is over.
  expect(trend(53, NOW + WEEK / 2, NOW, 0).tone).toBe('over')
})

test('the first hours of a week make no projection', async () => {
  expect(trend(3, NOW + WEEK - HOUR, NOW, WARN).tone).toBe('unknown')
  expect(trend(3, NOW + WEEK - HOUR, NOW, WARN).head).toBe('too early to tell')
  expect(trend(100, NOW + HOUR, NOW, WARN).head).toBe('limit reached')
  expect(trend(100, NOW + HOUR, NOW, WARN).tone).toBe('over')
})

test('a model id reads as a name', async () => {
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-fable-5-2[1m]')).toBe('Fable 5.2')
  expect(modelName('claude-haiku-5-5-20260101')).toBe('Haiku 5.5')
  expect(modelName('Opus 5.5 (1M context)')).toBe('Opus 5.5 (1M context)')
})

test('a ticket is read off a branch, a path shortened to home', async () => {
  expect(ticketOf('feature/ABC-123-cache')).toBe('ABC-123')
  expect(ticketOf('main')).toBe(null)
  expect(tilde('/Users/me/code/app', '/Users/me')).toBe('~/code/app')
  expect(tilde('/srv/app', '/Users/me')).toBe('/srv/app')
})

test('a pull request reads as its number however it was named', async () => {
  expect(pullLabel('482')).toBe('#482')
  expect(pullLabel('#482')).toBe('#482')
  expect(pullLabel('https://git.example.com/acme/app/pull/482')).toBe('#482')
  expect(pullLabel('the cache one')).toBe('the cache one')
})
