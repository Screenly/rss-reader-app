import '@screenly/edge-apps/test'
import { describe, expect, test } from 'bun:test'
import { DEFAULT_MODE, resolveMode } from './mode'

describe('resolveMode', () => {
  test('returns known modes exactly', () => {
    expect(resolveMode('headlines')).toBe('headlines')
    expect(resolveMode('list')).toBe('list')
  })

  test('normalises casing and whitespace', () => {
    expect(resolveMode('  List ')).toBe('list')
    expect(resolveMode('HEADLINES')).toBe('headlines')
  })

  test('falls back to the default for unknown values', () => {
    expect(resolveMode('grid')).toBe(DEFAULT_MODE)
    expect(resolveMode('')).toBe(DEFAULT_MODE)
    expect(resolveMode(undefined)).toBe(DEFAULT_MODE)
  })
})
