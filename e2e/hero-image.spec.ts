import { expect, test, type Browser, type Page } from '@playwright/test'
import {
  createMockScreenlyForScreenshots,
  setupClockMock,
  setupScreenlyJsMock,
} from '@screenly/edge-apps/test/screenshots'

// The lead image is never cropped and keeps the same height whatever size the
// feed sends, with its width following the image's own aspect ratio. Images
// too wide for the column at that height span the column and go shorter.

const RSS_URL = 'http://feeds.example/hero.xml'
const IMAGE_URL = 'https://mock-images.example/hero.svg'

const rssXml = (withImage: boolean) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Hero image</title>
    <item>
      <title>Lead story</title>
      <description>Excerpt</description>
      <pubDate>Mon, 08 Dec 2025 09:00:00 GMT</pubDate>
      ${withImage ? `<media:thumbnail url="${IMAGE_URL}"/>` : ''}
    </item>
  </channel>
</rss>`

const imageSvg = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="teal"/></svg>`

const IMAGES = [
  { name: '16:9', width: 1280, height: 720 },
  { name: 'small 16:9', width: 240, height: 135 },
  { name: '4:3', width: 384, height: 288 },
  { name: 'portrait', width: 600, height: 800 },
]
const WIDE_IMAGE = { name: 'very wide', width: 1500, height: 250 }

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

async function openApp(
  browser: Browser,
  viewport: { width: number; height: number },
  image: { width: number; height: number } | 'none' | 'never-loads',
): Promise<Page> {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await setupClockMock(page)
  await setupScreenlyJsMock(page, screenlyJsContent)
  await page.route(RSS_URL, (route) =>
    route.fulfill({
      contentType: 'application/rss+xml',
      body: rssXml(image !== 'none'),
    }),
  )
  if (typeof image === 'object') {
    await page.route(IMAGE_URL, (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: imageSvg(image.width, image.height),
      }),
    )
  } else if (image === 'never-loads') {
    // Leave the request hanging so the image stays in its loading state
    await page.route(IMAGE_URL, () => {})
  }
  await page.goto('/')
  await expect(page.locator('[data-hero-title]')).toHaveText('Lead story')
  return page
}

// The image's shown box, the column it sits in, and the natural size once loaded
async function measure(page: Page) {
  return page.locator('[data-hero-image]').evaluate((el: HTMLImageElement) => {
    const column = el.parentElement!
    return {
      width: el.clientWidth,
      height: el.clientHeight,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      columnWidth:
        column.clientWidth - parseFloat(getComputedStyle(column).paddingLeft),
    }
  })
}

async function loadedSize(
  browser: Browser,
  viewport: { width: number; height: number },
  image: { width: number; height: number },
) {
  const page = await openApp(browser, viewport, image)
  const hero = page.locator('[data-hero-image]')
  await expect(hero).toBeVisible()
  await expect
    .poll(() => hero.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(image.width)
  const size = await measure(page)
  await page.context().close()
  return size
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test('every image shows whole, at the same height', async ({ browser }) => {
      const sizes = []
      for (const image of IMAGES) {
        sizes.push({ image, ...(await loadedSize(browser, viewport, image)) })
      }

      const heights = new Set(sizes.map((s) => s.height))
      expect(heights.size, JSON.stringify(sizes)).toBe(1)

      for (const s of sizes) {
        // Width follows the image's own aspect ratio, so nothing is cropped or
        // padded out
        expect(s.width, s.image.name).toBeCloseTo(
          (s.height * s.image.width) / s.image.height,
          -1,
        )
        expect(s.width, s.image.name).toBeLessThanOrEqual(s.columnWidth)
      }
    })

    test('a very wide image spans the column and goes shorter', async ({
      browser,
    }) => {
      const normal = await loadedSize(browser, viewport, IMAGES[0])
      const wide = await loadedSize(browser, viewport, WIDE_IMAGE)

      expect(wide.width).toBeCloseTo(wide.columnWidth, -1)
      expect(wide.height).toBeLessThan(normal.height)
      // The frame wraps the picture, with no empty bands above and below
      expect(wide.width / wide.height).toBeCloseTo(
        WIDE_IMAGE.width / WIDE_IMAGE.height,
        1,
      )
    })

    test('holds a 16:9 box while the image loads', async ({ browser }) => {
      const page = await openApp(browser, viewport, 'never-loads')
      const loading = await measure(page)
      await page.context().close()

      const normal = await loadedSize(browser, viewport, IMAGES[0])
      expect(loading.height).toBe(normal.height)
      expect(loading.width).toBeCloseTo((loading.height * 16) / 9, -1)
    })

    test('hides the image when the story has none', async ({ browser }) => {
      const page = await openApp(browser, viewport, 'none')
      await expect(page.locator('[data-hero-image]')).toBeHidden()
      await page.context().close()
    })
  })
}
