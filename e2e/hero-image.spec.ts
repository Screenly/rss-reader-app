import { expect, test } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'

// The lead image keeps the same height whatever size the feed sends, with its
// width following the image's own aspect ratio up to the column width, and is
// never cropped

const RSS_URL = 'http://feeds.example/hero.xml'
const IMAGE_URL = 'https://mock-images.example/hero.svg'

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Hero image</title>
    <item>
      <title>Lead story</title>
      <description>Excerpt</description>
      <pubDate>Mon, 08 Dec 2025 09:00:00 GMT</pubDate>
      <media:thumbnail url="${IMAGE_URL}"/>
    </item>
  </channel>
</rss>`

const IMAGES = [
  { name: '16:9', width: 1280, height: 720 },
  { name: 'small 16:9', width: 240, height: 135 },
  { name: 'portrait', width: 600, height: 800 },
  { name: 'very wide', width: 1500, height: 250 },
]

const VIEWPORTS = [
  { name: 'landscape', width: 1920, height: 1080 },
  { name: 'portrait', width: 1080, height: 1920 },
]

const { screenlyJsContent } = createMockScreenlyForScreenshots(
  { coordinates: [51.5074, -0.1278], location: 'London, UK' },
  {
    bypass_cors: 'false',
    cache_interval: '1800',
    display_errors: 'false',
    enable_analytics: 'false',
    mode: 'headlines',
    override_locale: 'en',
    override_timezone: 'Europe/London',
    rss_title: 'Hero image',
    rss_url: RSS_URL,
  },
)

for (const viewport of VIEWPORTS) {
  test(`lead image keeps one height in ${viewport.name}`, async ({
    browser,
  }) => {
    const sizes: Record<string, { width: number; height: number }> = {}
    let columnWidth = 0

    for (const image of IMAGES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      })
      const page = await context.newPage()

      await setupClockMock(page)
      await setupScreenlyJsMock(page, screenlyJsContent)
      await page.route(RSS_URL, (route) =>
        route.fulfill({
          contentType: 'application/rss+xml',
          body: RSS_XML,
        }),
      )
      await page.route(IMAGE_URL, (route) =>
        route.fulfill({
          contentType: 'image/svg+xml',
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}"><rect width="100%" height="100%" fill="teal"/></svg>`,
        }),
      )

      await page.goto('/')
      const hero = page.locator('[data-hero-image]')
      await expect(hero).toBeVisible()
      await expect
        .poll(() => hero.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBe(image.width)

      const result = await hero.evaluate((el: HTMLImageElement) => {
        const style = getComputedStyle(el)
        return {
          width: el.clientWidth,
          height: el.clientHeight,
          columnWidth: el.parentElement!.clientWidth,
          paddingLeft: parseFloat(
            getComputedStyle(el.parentElement!).paddingLeft,
          ),
          objectFit: style.objectFit,
        }
      })
      await context.close()

      expect(result.objectFit, image.name).toBe('contain')
      columnWidth = result.columnWidth - result.paddingLeft
      sizes[image.name] = { width: result.width, height: result.height }
    }

    // Every image shows at the same height
    const heights = new Set(Object.values(sizes).map((s) => s.height))
    expect(heights.size, JSON.stringify(sizes)).toBe(1)
    const [boxHeight] = heights

    for (const image of IMAGES) {
      const shown = sizes[image.name]
      const natural = (boxHeight * image.width) / image.height
      // Width follows the aspect ratio, capped at the column
      expect(shown.width, image.name).toBeCloseTo(
        Math.min(natural, columnWidth),
        -1,
      )
      expect(shown.width, image.name).toBeLessThanOrEqual(columnWidth + 1)
    }
  })
}
