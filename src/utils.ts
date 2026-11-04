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
