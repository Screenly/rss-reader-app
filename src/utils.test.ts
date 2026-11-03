import { describe, test, expect, beforeEach } from 'bun:test'
import {
  getTitleSizeClass,
  loadCache,
  resizeImageUrl,
  saveCache,
  stripHtml,
} from './utils'
import type { RssEntry } from './utils'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
  }
})()

global.localStorage = localStorageMock as unknown as Storage

const ENTRIES: RssEntry[] = [
  {
    title: 'Title 1',
    source: 'BBC News',
    content: 'Content 1',
    formattedDate: 'Mon, Dec 8, 2025',
    imageUrl: 'https://example.com/image-1.jpg',
  },
  {
    title: 'Title 2',
    source: 'BBC News',
    content: 'Content 2',
    formattedDate: 'Mon, Dec 8, 2025',
    imageUrl: '',
  },
]

describe('stripHtml', () => {
  test('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  test('collapses whitespace', () => {
    expect(stripHtml('<p>  foo   bar  </p>')).toBe('foo bar')
  })

  test('returns plain text unchanged', () => {
    expect(stripHtml('plain text')).toBe('plain text')
  })

  test('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('')
  })
})

describe('loadCache / saveCache', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  test('returns empty array when cache is empty', () => {
    expect(loadCache()).toEqual([])
  })

  test('returns saved entries', () => {
    saveCache(ENTRIES)
    expect(loadCache()).toEqual(ENTRIES)
  })

  test('overwrites previous cache', () => {
    saveCache(ENTRIES)
    saveCache([ENTRIES[0]])
    expect(loadCache()).toEqual([ENTRIES[0]])
  })

  test('returns empty array for malformed cache', () => {
    localStorage.setItem('rssStore', 'not-json')
    expect(loadCache()).toEqual([])
  })
})

describe('getTitleSizeClass', () => {
  test('returns no class for a short title', () => {
    expect(getTitleSizeClass('Markets rally')).toBe('')
  })

  test('returns is-long past 70 characters', () => {
    expect(getTitleSizeClass('a'.repeat(71))).toBe('is-long')
  })

  test('returns is-very-long past 130 characters', () => {
    expect(getTitleSizeClass('a'.repeat(131))).toBe('is-very-long')
  })

  test('treats the thresholds as exclusive', () => {
    expect(getTitleSizeClass('a'.repeat(70))).toBe('')
    expect(getTitleSizeClass('a'.repeat(130))).toBe('is-long')
  })
})

describe('resizeImageUrl', () => {
  const BBC =
    'https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/50a9/live/ece0.jpg'
  const bbcAt = (width: number) =>
    `https://ichef.bbci.co.uk/ace/standard/${width}/cpsprodpb/50a9/live/ece0.jpg`

  test('rounds up to a width the BBC image CDN serves', () => {
    // 1080 itself is a 404 on the CDN
    expect(resizeImageUrl(BBC, 1080)).toBe(bbcAt(1280))
    expect(resizeImageUrl(BBC, 480)).toBe(bbcAt(480))
    expect(resizeImageUrl(BBC, 270)).toBe(bbcAt(480))
    expect(resizeImageUrl(BBC, 120)).toBe(bbcAt(240))
  })

  test('caps at the largest served width', () => {
    expect(resizeImageUrl(BBC, 4096)).toBe(bbcAt(2048))
  })

  test('leaves other feeds untouched', () => {
    const nyt = 'https://static01.nyt.com/images/2026/11/03/240/photo.jpg'
    expect(resizeImageUrl(nyt, 1080)).toBe(nyt)
    expect(resizeImageUrl('', 1080)).toBe('')
  })
})
