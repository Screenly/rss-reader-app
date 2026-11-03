const CACHE_KEY = 'rssStore'

export interface RssEntry {
  title: string
  content: string
  formattedDate: string
  imageUrl: string
  source: string
}

interface AppCache {
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
// story. Their image CDN serves other widths from the same path: any width up
// to 999, but above that only a fixed set (1080, for one, is a 404). Round up
// to a width it is known to serve. Other feeds' URLs are left untouched.
const BBC_IMAGE_WIDTH = /^(https?:\/\/ichef\.bbci\.co\.uk\/[^/]+\/[^/]+\/)\d+\//
const BBC_WIDTHS = [240, 480, 640, 976, 1280, 1536, 2048]

export function resizeImageUrl(url: string, width: number): string {
  const snapped =
    BBC_WIDTHS.find((candidate) => candidate >= width) ??
    BBC_WIDTHS[BBC_WIDTHS.length - 1]
  return url.replace(BBC_IMAGE_WIDTH, `$1${snapped}/`)
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function loadCache(): RssEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed: AppCache = JSON.parse(raw)
    // parsed.entries is undefined if the stored value is a legacy plain array;
    // falling back to [] causes a fresh fetch on first run after upgrade.
    return parsed.entries ?? []
  } catch {
    return []
  }
}

export function saveCache(entries: RssEntry[]) {
  try {
    const data: AppCache = { entries, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('Failed to save cache:', err)
  }
}
