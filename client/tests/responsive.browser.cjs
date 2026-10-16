// Start frontend first, then npm run test:responsive. Optional system Chromium via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const baseURL = process.env.HIGHLIGHT_TEST_URL || 'http://127.0.0.1:5173'
const topic = 'A closer look at the central bridge closure and the city’s transport plans'
const sources = ['The Guardian', 'BBC', 'New York Times']
const articles = sources.map((source, index) => ({ source, title: `${source}: Central bridge closes for scheduled repairs`, contentFull: 'Officials announced that the central bridge will close for two weeks for repairs. A free shuttle bus will run every fifteen minutes during the closure. Local businesses asked the council to publish a detailed transport plan. '.repeat(3), url: `https://example.com/article-${index}`, publishedAt: new Date().toISOString() }))
const result = { topic, heroImage: 'https://example.com/hero.jpg', articles, totalArticles: 9, totalSources: 3, durationSeconds: '12.4', sourceLocations: [{ source: 'BBC', location: { lat: 51.5, lng: -.1, city: 'London' } }], verdict: { neutralSummary: 'City officials announced a two-week closure of the central bridge for structural repairs. A temporary shuttle service will connect the two riverbanks, while local businesses are asking for clearer information about deliveries and access.', commonFacts: ['The central bridge is scheduled to close for two weeks.', 'A free shuttle will run during the closure.', 'Businesses have requested additional information about access.'], missingContext: 'The excerpts do not include the full engineering assessment or the final delivery-access plan.', sources: sources.map((source, index) => ({ source, biasScore: 15 + index * 24, emphasis: 'The article emphasizes how repairs will affect commuters and the measures planned to keep the city connected.', omissions: 'The available excerpt does not describe the engineering assessment in detail.', emotionalLanguage: index ? ['disruption', 'urgent'] : [] })) }, coverage: { status: 'complete', findings: [{ detail: 'Free shuttle service during the closure', articles: [{ articleId: 0, status: 'mentioned', quote: 'A free shuttle bus will run every fifteen minutes during the closure.' }, { articleId: 1, status: 'not_found', quote: '' }, { articleId: 2, status: 'disputed', quote: 'Local businesses asked the council to publish a detailed transport plan.' }] }] } }
const feed = { sourceCount: 3, stories: [{ id: 'bridge', title: articles[0].title, category: 'World', sourceCount: 3, articles: articles.map(item => ({ ...item, abstract: item.contentFull.slice(0, 190), thumbnail: null })) }, { id: 'single', title: 'A new public library opens its doors', category: 'Culture', sourceCount: 1, articles: [{ source: 'BBC', title: 'A new public library opens its doors', abstract: 'A new space for reading, research, and community events.', url: 'https://example.com/library', publishedAt: new Date().toISOString() }] }] }
const hero = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#e8f0fb"/><path d="M0 240Q230 80 500 240M0 260H500" stroke="#a6bfdf" stroke-width="14" fill="none"/></svg>'
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ result, topic }) => localStorage.setItem('realnews_history', JSON.stringify([{ topic, analyzedAt: new Date().toISOString(), results: result, stats: { totalArticles: 9, totalSources: 3 } }])), { result, topic })
    await page.route('**/api/stories', route => route.fulfill({ json: feed }))
    await page.route('https://example.com/hero.jpg', route => route.fulfill({ contentType: 'image/svg+xml', body: hero }))
    for (const width of [320, 390, 768, 1024, 1440]) {
      console.log(`Checking homepage and analysis at ${width}px`)
      await page.setViewportSize({ width, height: width > 767 ? 1000 : 844 })
      await page.goto(baseURL)
      await page.locator('.story-card').first().waitFor()
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.story-card-featured')).backgroundColor), 'rgb(255, 255, 255)')
      await assertFits(page, `homepage ${width}`)
      if (width === 1440 || width === 390) await page.screenshot({ path: `/tmp/realnews-white-home-${width}.png` })
      await page.getByText(topic, { exact: true }).click()
      await page.getByRole('heading', { name: topic, exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Neutral Summary', exact: true }).waitFor()
      assert.equal(await page.locator('.source-card').count(), 3)
      await assertFits(page, `analysis ${width}`)
      const columns = await page.locator('.source-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
      assert.equal(columns, width < 768 ? 1 : 2)
      const mapWidth = await page.locator('.map-canvas').evaluate(el => el.clientWidth)
      const leafletWidth = await page.locator('.map-canvas').evaluate(el => el.querySelector('.leaflet-map-pane') != null)
      assert.ok(mapWidth > 200 && leafletWidth)
      await page.locator('.coverage-summary').click()
      await page.getByText('Mentioned', { exact: true }).waitFor()
      await assertFits(page, `expanded evidence ${width}`)
      if (width === 1440 || width === 390) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: `/tmp/realnews-white-analysis-${width}.png`, fullPage: true })
      }
      await page.locator('.report-toolbar a[href="#sources"]').click()
      await page.locator('[data-highlight-source]').first().waitFor()
      assert.ok(await page.locator('[data-highlight-source]').first().isVisible())
      await page.getByRole('link', { name: 'RealNews home', exact: true }).click()
      await page.locator('.library-card').first().waitFor()
    }
    // Keyboard deletion must delete without navigating into the analysis.
    await page.getByRole('button', { name: `Delete ${topic}`, exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByText('A little space for the bigger picture.', { exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/')

    // Streamed loading and error screens at phone and laptop widths.
    const loading = await browser.newPage({ reducedMotion: 'reduce' })
    let release
    const gate = new Promise(resolve => { release = resolve })
    await loading.route('**/api/stories', route => route.fulfill({ json: feed }))
    await loading.route('**/api/analyze', async route => {
      await gate
      await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ error: 'Test provider is temporarily unavailable.' })}\n\n` })
    })
    await loading.goto(baseURL)
    await loading.getByRole('textbox', { name: 'Topic to analyze' }).fill('A very detailed story about transport across several countries')
    await loading.getByRole('button', { name: 'Analyze', exact: false }).click()
    await loading.locator('.loading-page .report-title').waitFor()
    for (const width of [320, 390, 1024, 1440]) {
      await loading.setViewportSize({ width, height: 900 })
      await assertFits(loading, `loading ${width}`)
      if (width === 390 || width === 1440) await loading.screenshot({ path: `/tmp/realnews-white-loading-${width}.png`, fullPage: true })
    }
    release()
    await loading.getByRole('alert').waitFor()
    await assertFits(loading, 'error')
    await loading.setViewportSize({ width: 320, height: 800 })
    await assertFits(loading, 'mobile error')
    const empty = await browser.newPage({ viewport: { width: 320, height: 800 } })
    await empty.goto(`${baseURL}/results`)
    await empty.getByRole('heading', { name: 'What story is on your mind?' }).waitFor()
    await assertFits(empty, 'empty analysis')
    assert.deepEqual(errors, [])
    console.log('Responsive Chromium checks passed: white homepage and full analysis at 320/390/768/1024/1440px; evidence expansion, library navigation and keyboard deletion, maps, loading, errors, and empty analysis.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })

async function assertFits(page, label) {
  const overflow = await page.evaluate(() => {
    const width = innerWidth
    if (document.documentElement.scrollWidth <= width) return []
    return [...document.querySelectorAll('main,section,article,header,nav,h1,h2,p,button')].map(el => ({ tag: el.tagName, cls: String(el.className), right: el.getBoundingClientRect().right })).filter(el => el.right > width + 1).slice(0, 8).concat([{ rootWidth: document.documentElement.scrollWidth, viewportWidth: width }])
  })
  assert.deepEqual(overflow, [], `Horizontal overflow on ${label}: ${JSON.stringify(overflow)}`)
}
