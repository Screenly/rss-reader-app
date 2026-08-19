import './css/style.css'

// Side-effect import: registers <auto-scaler> as a custom element
import '@screenly/edge-apps/components'
import { parseFeed } from '@rowanmanning/feed-parser'
import {
  formatLocalizedDate,
  getCorsProxyUrl,
  getLocale,
  getSettingWithDefault,
  getTimeZone,
  isLightColor,
  setupBrandingLogo,
  setupErrorHandling,
  setupTheme,
  signalReady,
} from '@screenly/edge-apps'
import { getNewsMode, type NewsMode } from './mode'
import {
  getTitleSizeClass,
  loadCache,
  saveCache,
  stripHtml,
  type RssEntry,
} from './utils'

const MAX_ENTRIES = 6
const DATE_UPDATE_INTERVAL_MS = 60 * 1000

interface FeedConfig {
  rssUrl: string
  rssTitle: string
  locale: string
  timezone: string
}

function queryElements() {
  return {
    source: document.querySelector('[data-source]'),
    date: document.querySelector('[data-date]'),
    body: document.querySelector<HTMLElement>('[data-body]'),
    heroDate: document.querySelector('[data-hero-date]'),
    heroTitle: document.querySelector('[data-hero-title]'),
    heroExcerpt: document.querySelector('[data-hero-excerpt]'),
    heroImage: document.querySelector<HTMLImageElement>('[data-hero-image]'),
    list: document.querySelector('[data-list]'),
    error: document.querySelector<HTMLElement>('[data-error]'),
    logo: document.querySelector<HTMLImageElement>('[data-logo]'),
  }
}

type NewsElements = ReturnType<typeof queryElements>

async function fetchFeed(config: FeedConfig): Promise<RssEntry[]> {
  const bypassCors =
    getSettingWithDefault<string>('bypass_cors', 'true') === 'true'
  const isAbsolute = /^https?:/.test(config.rssUrl)
  const url =
    bypassCors && isAbsolute
      ? `${getCorsProxyUrl()}/${config.rssUrl}`
      : config.rssUrl

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`)
  }
  const xml = await response.text()
  const feed = parseFeed(xml)

  return feed.items.slice(0, MAX_ENTRIES).map((item) => {
    const rawContent = item.content ?? item.description ?? ''
    return {
      title: item.title ?? '',
      source: config.rssTitle,
      content: rawContent.includes('<') ? stripHtml(rawContent) : rawContent,
      imageUrl: item.image?.url ?? '',
      formattedDate: item.published
        ? formatLocalizedDate(item.published, config.locale, {
            timeZone: config.timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '',
    }
  })
}

function createRow(entry: RssEntry, withImage: boolean): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'news-item'

  const text = document.createElement('div')
  text.className = 'news-item-text'

  const title = document.createElement('p')
  title.className = 'news-item-title'
  title.textContent = entry.title

  const date = document.createElement('p')
  date.className = 'news-item-date'
  date.textContent = entry.formattedDate

  text.append(title, date)
  item.appendChild(text)

  if (withImage && entry.imageUrl) {
    const image = document.createElement('img')
    image.className = 'news-item-image'
    image.alt = ''
    image.onerror = () => image.classList.add('is-hidden')
    image.src = entry.imageUrl
    item.appendChild(image)
  }

  return item
}

function renderHero(els: NewsElements, entry: RssEntry) {
  if (els.heroImage) {
    els.heroImage.classList.toggle('is-hidden', !entry.imageUrl)
    if (entry.imageUrl) {
      els.heroImage.src = entry.imageUrl
    }
  }
  if (els.heroDate) {
    els.heroDate.textContent = entry.formattedDate
  }
  if (els.heroTitle) {
    els.heroTitle.className = [
      'news-hero-title',
      getTitleSizeClass(entry.title),
    ]
      .filter(Boolean)
      .join(' ')
    els.heroTitle.textContent = entry.title
  }
  if (els.heroExcerpt) {
    els.heroExcerpt.textContent = entry.content
  }
}

function render(els: NewsElements, mode: NewsMode, entries: RssEntry[]) {
  const listEntries = mode === 'headlines' ? entries.slice(1) : entries
  // The list mode is the text-first layout, so it skips thumbnails
  els.list?.replaceChildren(
    ...listEntries.map((entry) => createRow(entry, mode === 'headlines')),
  )

  // The list mode never shows the lead story, so skip rendering it
  if (mode !== 'headlines') return
  renderHero(els, entries[0])
}

function showBody(els: NewsElements) {
  if (els.body) els.body.hidden = false
  if (els.error) els.error.hidden = true
}

function showError(els: NewsElements) {
  if (els.body) els.body.hidden = true
  if (els.error) els.error.hidden = false
}

async function loadAndRender(
  els: NewsElements,
  mode: NewsMode,
  config: FeedConfig,
) {
  try {
    const entries = await fetchFeed(config)
    if (entries.length === 0) {
      showError(els)
      return
    }
    saveCache(entries)
    render(els, mode, entries)
    showBody(els)
  } catch (err) {
    console.error('RSS fetch failed:', err)
    const cached = loadCache()
    if (cached.length === 0) {
      showError(els)
      return
    }
    render(els, mode, cached)
    showBody(els)
  }
}

function updateDate(els: NewsElements, config: FeedConfig) {
  if (!els.date) return

  els.date.textContent = formatLocalizedDate(new Date(), config.locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: config.timezone,
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  setupErrorHandling()

  const { primary } = setupTheme()
  document.body.classList.toggle('is-light-brand', isLightColor(primary))

  const mode = getNewsMode()
  document.body.classList.add(`mode-${mode}`)

  const els = queryElements()

  const heroImage = els.heroImage
  if (heroImage) {
    heroImage.onerror = () => heroImage.classList.add('is-hidden')
  }

  const logo = els.logo
  if (logo) {
    logo.onerror = () => logo.classList.add('is-hidden')
    logo.src = await setupBrandingLogo()
  }

  const rssTitle = getSettingWithDefault<string>('rss_title', 'RSS Feed')
  if (els.source) {
    els.source.textContent = rssTitle
  }

  const config: FeedConfig = {
    rssUrl: getSettingWithDefault<string>(
      'rss_url',
      'http://feeds.bbci.co.uk/news/rss.xml',
    ),
    rssTitle,
    locale: await getLocale(),
    timezone: await getTimeZone(),
  }
  const cacheInterval =
    getSettingWithDefault<number>('cache_interval', 1800) * 1000

  updateDate(els, config)
  setInterval(() => updateDate(els, config), DATE_UPDATE_INTERVAL_MS)

  await loadAndRender(els, mode, config)
  signalReady()
  setInterval(() => loadAndRender(els, mode, config), cacheInterval)
})
