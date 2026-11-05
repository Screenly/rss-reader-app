// One cache per feed URL, so a changed rss_url (or another app on the same
// origin) never shows a different feed's stories
const CACHE_KEY_PREFIX = 'rssStore:'
// The single shared key used before caches were per feed
const LEGACY_CACHE_KEY = 'rssStore'
// Past this, cached stories are too old to show during an outage, and the
// error screen is more honest than yesterday's news
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const MIN_REFRESH_SECONDS = 60
const MAX_REFRESH_SECONDS = 24 * 60 * 60

export interface RssEntry {
  title: string
  content: string
  formattedDate: string
  imageUrl: string
  source: string
}

interface AppCache {
  feedUrl: string
  entries: RssEntry[]
  timestamp: number
}

const LONG_TITLE_CHARS = 70
const VERY_LONG_TITLE_CHARS = 130

// News titles vary wildly in length; a long one steps down in size instead
// of wrapping the lead story off the canvas
export function getTitleSizeClass(title: string): string {
  if (title.length > VERY_LONG_TITLE_CHARS) return 'is-very-long'
  if (title.length > LONG_TITLE_CHARS) return 'is-long'
  return ''
}

// BBC feeds only advertise 240px thumbnails, which blur on a screen-sized lead
// story. Their image CDN serves the same image at other sizes, but each URL
// shape accepts its own set (/ace/ 404s on 1080, /news/ on 1280, /images/ic/
// 403s on 2048x1152), so round up to a size each shape is known to serve.
// Other feeds' URLs are left untouched.
const BBC_IMAGE_SHAPES: { pattern: RegExp; sizes: string[] }[] = [
  {
    // https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/...
    pattern: /^(https?:\/\/ichef\.bbci\.co\.uk\/ace\/[^/]+\/)\d+\//,
    sizes: ['240', '480', '640', '976', '1280', '1536', '2048'],
  },
  {
    // https://ichef.bbci.co.uk/news/240/cpsprodpb/...
    pattern: /^(https?:\/\/ichef\.bbci\.co\.uk\/news\/)\d+\//,
    sizes: ['240', '480', '640', '976', '1536', '2048'],
  },
  {
    // https://ichef.bbci.co.uk/images/ic/240x135/p0l7jnbt.jpg (video items)
    pattern: /^(https?:\/\/ichef\.bbci\.co\.uk\/images\/ic\/)\d+x\d+\//,
    sizes: [
      '240x135',
      '480x270',
      '640x360',
      '976x549',
      '1280x720',
      '1536x864',
      '1920x1080',
    ],
  },
]

export function resizeImageUrl(url: string, width: number): string {
  const shape = BBC_IMAGE_SHAPES.find(({ pattern }) => pattern.test(url))
  if (!shape) return url
  const { pattern, sizes } = shape
  const size =
    sizes.find((candidate) => parseInt(candidate, 10) >= width) ??
    sizes[sizes.length - 1]
  return url.replace(pattern, `$1${size}/`)
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cacheKey(feedUrl: string): string {
  return `${CACHE_KEY_PREFIX}${feedUrl}`
}

function readCache(key: string): Partial<AppCache> | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<AppCache>)
      : null
  } catch {
    return null
  }
}

// A cache saved in the future means the clock was wrong when it was saved
// (players often boot with a bad date until they sync), so its real age is
// unknown; treat it as stale rather than letting it outlive the 24 hours
function isFresh(cache: Partial<AppCache>, now: number): boolean {
  if (typeof cache.timestamp !== 'number') return false
  const age = now - cache.timestamp
  return age >= 0 && age <= CACHE_MAX_AGE_MS
}

// Storage can hold anything (an older build's format, a partial write), and
// rendering trusts these fields, so check every entry. Optional text fields
// default to empty; an entry without a title is unusable.
function toEntry(value: unknown): RssEntry | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.title !== 'string') return null
  const text = (field: unknown) => (typeof field === 'string' ? field : '')
  return {
    title: v.title,
    content: text(v.content),
    formattedDate: text(v.formattedDate),
    imageUrl: text(v.imageUrl),
    source: text(v.source),
  }
}

// Returns the cached entries for this feed, or [] if there are none, they
// belong to another feed, they are older than CACHE_MAX_AGE_MS, or any of
// them is malformed
export function loadCache(feedUrl: string, now = Date.now()): RssEntry[] {
  try {
    const cache = readCache(cacheKey(feedUrl))
    if (
      !cache ||
      cache.feedUrl !== feedUrl ||
      !Array.isArray(cache.entries) ||
      !isFresh(cache, now)
    ) {
      return []
    }
    const entries = cache.entries.map(toEntry)
    return entries.every((entry) => entry !== null)
      ? (entries as RssEntry[])
      : []
  } catch {
    return []
  }
}

export function saveCache(
  feedUrl: string,
  entries: RssEntry[],
  now = Date.now(),
) {
  try {
    // Prune first: if storage is full of expired caches, the write below
    // would otherwise fail every time and the cache would never recover
    pruneCaches(feedUrl, now)
    const data: AppCache = { feedUrl, entries, timestamp: now }
    localStorage.setItem(cacheKey(feedUrl), JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save cache:', err)
  }
}

// Drops the legacy shared cache and other feeds' expired caches, so a screen
// whose rss_url changes over time doesn't collect them forever
function pruneCaches(currentFeedUrl: string, now: number) {
  localStorage.removeItem(LEGACY_CACHE_KEY)
  const stale: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (
      !key ||
      !key.startsWith(CACHE_KEY_PREFIX) ||
      key === cacheKey(currentFeedUrl)
    ) {
      continue
    }
    const cache = readCache(key)
    if (!cache || !isFresh(cache, now)) stale.push(key)
  }
  stale.forEach((key) => localStorage.removeItem(key))
}

// cache_interval is free text: 0 or a tiny value would refetch the feed in a
// tight loop, and a huge one (or Infinity) overflows setInterval, which then
// fires immediately. Clamp it to a sane range.
export function getRefreshIntervalMs(seconds: number): number {
  const clamped = Number.isNaN(seconds)
    ? MIN_REFRESH_SECONDS
    : Math.min(Math.max(seconds, MIN_REFRESH_SECONDS), MAX_REFRESH_SECONDS)
  if (clamped !== seconds) {
    console.warn(
      `cache_interval ${seconds} is outside ${MIN_REFRESH_SECONDS}-${MAX_REFRESH_SECONDS} seconds; using ${clamped}`,
    )
  }
  return clamped * 1000
}
