import { describe, test, expect, beforeEach } from 'bun:test'
import {
  CACHE_MAX_AGE_MS,
  getRefreshIntervalMs,
  getTitleSizeClass,
  loadCache,
  resizeImageUrl,
  saveCache,
  stripHtml,
} from './utils'
import type { RssEntry } from './utils'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  let quota = Infinity
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      if (!(key in store) && Object.keys(store).length >= quota) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      store[key] = value
    },
    setQuota: (keys: number) => {
      quota = keys
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
    clear: () => {
      store = {}
      quota = Infinity
    },
    keys: () => Object.keys(store),
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

const BBC = 'http://feeds.bbci.co.uk/news/rss.xml'
const NPR = 'https://feeds.npr.org/1004/rss.xml'
const NOW = 1_800_000_000_000

describe('loadCache / saveCache', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  test('returns empty array when cache is empty', () => {
    expect(loadCache(BBC, NOW)).toEqual([])
  })

  test('returns saved entries for the same feed', () => {
    saveCache(BBC, ENTRIES, NOW)
    expect(loadCache(BBC, NOW)).toEqual(ENTRIES)
  })

  test('overwrites previous cache for the same feed', () => {
    saveCache(BBC, ENTRIES, NOW)
    saveCache(BBC, [ENTRIES[0]], NOW)
    expect(loadCache(BBC, NOW)).toEqual([ENTRIES[0]])
  })

  test("never returns another feed's stories", () => {
    // e.g. rss_url changed and the first fetch of the new feed failed
    saveCache(BBC, ENTRIES, NOW)
    expect(loadCache(NPR, NOW)).toEqual([])
  })

  test('keeps separate caches per feed', () => {
    saveCache(BBC, ENTRIES, NOW)
    saveCache(NPR, [ENTRIES[1]], NOW)
    expect(loadCache(BBC, NOW)).toEqual(ENTRIES)
    expect(loadCache(NPR, NOW)).toEqual([ENTRIES[1]])
  })

  test('expires after CACHE_MAX_AGE_MS', () => {
    saveCache(BBC, ENTRIES, NOW)
    expect(loadCache(BBC, NOW + CACHE_MAX_AGE_MS)).toEqual(ENTRIES)
    expect(loadCache(BBC, NOW + CACHE_MAX_AGE_MS + 1)).toEqual([])
  })

  test('ignores the legacy shared cache and removes it on save', () => {
    localStorage.setItem(
      'rssStore',
      JSON.stringify({ entries: ENTRIES, timestamp: NOW }),
    )
    expect(loadCache(BBC, NOW)).toEqual([])
    saveCache(BBC, [ENTRIES[0]], NOW)
    expect(localStorageMock.keys()).not.toContain('rssStore')
  })

  test("prunes other feeds' expired caches on save, keeps fresh ones", () => {
    saveCache(NPR, ENTRIES, NOW)
    saveCache(BBC, ENTRIES, NOW + 1000)
    expect(loadCache(NPR, NOW + 1000)).toEqual(ENTRIES)

    saveCache(BBC, ENTRIES, NOW + CACHE_MAX_AGE_MS + 1)
    expect(localStorageMock.keys()).toEqual([`rssStore:${BBC}`])
  })
})

describe('cache recovery and validation', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  test('recovers when storage is full of expired caches', () => {
    saveCache(NPR, ENTRIES, NOW)
    localStorageMock.setQuota(1)
    saveCache(BBC, ENTRIES, NOW + CACHE_MAX_AGE_MS + 1)
    expect(loadCache(BBC, NOW + CACHE_MAX_AGE_MS + 1)).toEqual(ENTRIES)
  })

  test('treats a cache saved in the future as stale', () => {
    // e.g. saved while the player's clock was ahead, before it synced
    saveCache(BBC, ENTRIES, NOW + 60_000)
    expect(loadCache(BBC, NOW)).toEqual([])
  })

  test('rejects a cache with any malformed entry', () => {
    const store = (entries: unknown) =>
      localStorage.setItem(
        `rssStore:${BBC}`,
        JSON.stringify({ feedUrl: BBC, timestamp: NOW, entries }),
      )
    store([null])
    expect(loadCache(BBC, NOW)).toEqual([])
    store([ENTRIES[0], { content: 'no title' }])
    expect(loadCache(BBC, NOW)).toEqual([])
    store(['just a string'])
    expect(loadCache(BBC, NOW)).toEqual([])
  })

  test('fills in missing optional fields of a cached entry', () => {
    localStorage.setItem(
      `rssStore:${BBC}`,
      JSON.stringify({
        feedUrl: BBC,
        timestamp: NOW,
        entries: [{ title: 'T' }],
      }),
    )
    expect(loadCache(BBC, NOW)).toEqual([
      { title: 'T', content: '', formattedDate: '', imageUrl: '', source: '' },
    ])
  })

  test('returns empty array for malformed cache', () => {
    localStorage.setItem(`rssStore:${BBC}`, 'not-json')
    expect(loadCache(BBC, NOW)).toEqual([])
    localStorage.setItem(`rssStore:${BBC}`, JSON.stringify({ feedUrl: BBC }))
    expect(loadCache(BBC, NOW)).toEqual([])
    localStorage.setItem(`rssStore:${BBC}`, 'null')
    expect(loadCache(BBC, NOW)).toEqual([])
  })
})

describe('getRefreshIntervalMs', () => {
  test('uses a normal value as is', () => {
    expect(getRefreshIntervalMs(1800)).toBe(1_800_000)
    expect(getRefreshIntervalMs(60)).toBe(60_000)
  })

  test('raises values that would refetch in a tight loop', () => {
    expect(getRefreshIntervalMs(0)).toBe(60_000)
    expect(getRefreshIntervalMs(-5)).toBe(60_000)
    expect(getRefreshIntervalMs(1)).toBe(60_000)
    expect(getRefreshIntervalMs(NaN)).toBe(60_000)
  })

  test('caps values that would overflow setInterval', () => {
    // setInterval fires immediately for delays above 2^31 - 1 ms (~24.8 days)
    expect(getRefreshIntervalMs(Infinity)).toBe(86_400_000)
    expect(getRefreshIntervalMs(10_000_000)).toBe(86_400_000)
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
