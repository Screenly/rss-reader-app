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
  const ACE =
    'https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/50a9/live/ece0.jpg'
  const aceAt = (size: number) =>
    `https://ichef.bbci.co.uk/ace/standard/${size}/cpsprodpb/50a9/live/ece0.jpg`
  const NEWS = 'https://ichef.bbci.co.uk/news/240/cpsprodpb/50a9/live/ece0.jpg'
  const newsAt = (size: number) =>
    `https://ichef.bbci.co.uk/news/${size}/cpsprodpb/50a9/live/ece0.jpg`
  const IC = 'https://ichef.bbci.co.uk/images/ic/240x135/p0l7jnbt.jpg'
  const icAt = (size: string) =>
    `https://ichef.bbci.co.uk/images/ic/${size}/p0l7jnbt.jpg`

  test('rounds /ace/ URLs up to a width the CDN serves', () => {
    // 1080 itself is a 404 on the CDN
    expect(resizeImageUrl(ACE, 1080)).toBe(aceAt(1280))
    expect(resizeImageUrl(ACE, 480)).toBe(aceAt(480))
    expect(resizeImageUrl(ACE, 270)).toBe(aceAt(480))
    expect(resizeImageUrl(ACE, 120)).toBe(aceAt(240))
    expect(resizeImageUrl(ACE, 4096)).toBe(aceAt(2048))
  })

  test('skips the widths /news/ URLs do not serve', () => {
    // 1280 is a 404 on this shape
    expect(resizeImageUrl(NEWS, 1080)).toBe(newsAt(1536))
    expect(resizeImageUrl(NEWS, 270)).toBe(newsAt(480))
    expect(resizeImageUrl(NEWS, 4096)).toBe(newsAt(2048))
  })

  test('resizes /images/ic/ URLs by their width-by-height segment', () => {
    expect(resizeImageUrl(IC, 1080)).toBe(icAt('1280x720'))
    expect(resizeImageUrl(IC, 270)).toBe(icAt('480x270'))
    // 2048x1152 is a 403, so this shape tops out lower
    expect(resizeImageUrl(IC, 4096)).toBe(icAt('1920x1080'))
  })

  test('leaves other feeds untouched', () => {
    const nyt = 'https://static01.nyt.com/images/2026/11/03/240/photo.jpg'
    expect(resizeImageUrl(nyt, 1080)).toBe(nyt)
    const otherBbc = 'https://ichef.bbci.co.uk/onesport/cps/240/photo.jpg'
    expect(resizeImageUrl(otherBbc, 1080)).toBe(otherBbc)
    expect(resizeImageUrl('', 1080)).toBe('')
  })
})
