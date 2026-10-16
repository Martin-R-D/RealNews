// Start frontend first. HIGHLIGHT_LIVE_TEST=1 also checks the configured news providers.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const baseURL = process.env.HIGHLIGHT_TEST_URL || 'http://127.0.0.1:5173'
const publishedAt = new Date(Date.now() - 25 * 60000).toISOString()
const article = (source, title, suffix) => ({ source, title, abstract: `${source} reports that the central bridge will close for scheduled repairs, with alternative transport available for commuters.`, url: `https://example.com/${suffix}`, publishedAt, thumbnail: null })
const feed = { updatedAt: new Date().toISOString(), sourceCount: 4, stories: [
  { id: 'bridge', title: 'Central bridge closes for two weeks of repairs', category: 'World', sourceCount: 3, articles: [article('Reuters', 'Central bridge closes for two weeks of repairs', 'reuters'), article('BBC', 'Commuters offered free buses during bridge closure', 'bbc'), article('The Guardian', 'Businesses prepare for central bridge repair disruption', 'guardian')] },
  { id: 'energy', title: 'Cities announce a joint clean energy investment', category: 'Environment', sourceCount: 2, isDeveloping: true, articles: [article('BBC', 'Cities announce a joint clean energy investment', 'energy-bbc'), article('The Guardian', 'New clean energy fund aims to cut household bills', 'energy-guardian')] },
  { id: 'science', title: 'Scientists share new images from the ocean floor', category: 'Science', sourceCount: 1, articles: [article('France 24', 'Scientists share new images from the ocean floor', 'science')] },
  { id: 'culture', title: 'A new chapter for the city’s public library', category: 'Culture', sourceCount: 1, articles: [article('The Guardian', 'A new chapter for the city’s public library', 'culture')] },
] }
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/stories', route => route.fulfill({ json: feed }))
    let analyzedTopic
    await page.route('**/api/analyze', route => {
      analyzedTopic = route.request().postDataJSON().topic
      return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ type: 'result', data: { topic: analyzedTopic, articles: [], verdict: { sources: [], neutralSummary: 'Test analysis complete.' }, sourceLocations: [] } })}\n\n` })
    })
    await page.goto(baseURL)
    await page.locator('.story-card').first().waitFor()
    assert.equal(await page.locator('.story-card').count(), 4)
    const lead = page.locator('[data-story-id="bridge"]')
    await lead.getByRole('tab', { name: 'BBC', exact: true }).click()
    assert.equal(await lead.getByRole('heading', { level: 3 }).textContent(), feed.stories[0].articles[1].title)
    assert.equal(await lead.getByRole('link', { name: 'Read original', exact: false }).getAttribute('href'), 'https://example.com/bbc')
    await page.keyboard.press('ArrowRight')
    assert.equal(await lead.getByRole('tab', { name: 'The Guardian', exact: true }).getAttribute('aria-selected'), 'true')
    await page.keyboard.press('Home')
    assert.equal(await lead.getByRole('tab', { name: 'Reuters', exact: true }).getAttribute('aria-selected'), 'true')
    await lead.locator('summary').click()
    assert.equal(await lead.locator('details').getAttribute('open'), '')
    assert.equal(await lead.locator('details a').count(), 3)
    await lead.locator('summary').click()
    await page.getByRole('button', { name: 'Multiple perspectives' }).click()
    assert.equal(await page.locator('.story-card').count(), 2)
    assert.equal(await page.getByText('New coverage', { exact: true }).count(), 1)
    await page.getByRole('button', { name: 'All stories', exact: true }).click()
    assert.equal(await page.locator('.story-card').count(), 4)
    await page.screenshot({ path: '/tmp/realnews-home-desktop.png' })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await lead.getByRole('tab', { name: 'The Guardian', exact: true }).click()
      assert.equal(await lead.getByRole('heading', { level: 3 }).textContent(), feed.stories[0].articles[2].title)
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('*')].map(el => ({ tag: el.tagName, cls: typeof el.className === 'string' ? el.className : '', right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > innerWidth + 1).slice(0, 12)))
        await page.screenshot({ path: '/tmp/realnews-home-overflow.png', fullPage: true })
        throw new Error(`Page overflows at width ${width}`)
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: '/tmp/realnews-home-mobile.png', fullPage: true })
    await lead.getByRole('button', { name: 'Compare coverage' }).click()
    await page.waitForURL('**/results')
    await page.getByText('Test analysis complete.', { exact: true }).waitFor()
    assert.equal(analyzedTopic, feed.stories[0].title)
    assert.deepEqual(errors, [])
    const states = await browser.newPage()
    let mode = 'error'
    await states.route('**/api/stories', route => mode === 'error'
      ? route.fulfill({ status: 503, json: { error: 'unavailable' } })
      : route.fulfill({ json: mode === 'empty' ? { stories: [], sourceCount: 0 } : { ...feed, stale: true, stories: [feed.stories[2]] } }))
    await states.goto(baseURL)
    await states.getByRole('alert').waitFor()
    mode = 'single'
    await states.getByRole('button', { name: 'Try again' }).click()
    await states.getByText('One source so far', { exact: true }).waitFor()
    await states.getByText('Fresh coverage is temporarily unavailable.', { exact: false }).waitFor()
    await states.getByRole('button', { name: 'Multiple perspectives' }).click()
    await states.getByText('More perspectives are on the way.', { exact: true }).waitFor()
    await states.getByRole('button', { name: 'View all stories' }).click()
    assert.equal(await states.locator('.story-card').count(), 1)
    mode = 'empty'
    await states.reload()
    await states.getByText('A quiet moment at the news desk.', { exact: true }).waitFor()
    if (process.env.HIGHLIGHT_LIVE_TEST === '1') {
      const live = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
      const started = Date.now()
      await live.goto(baseURL)
      await live.locator('.story-card').first().waitFor({ timeout: 24000 })
      const first = live.locator('.story-card').first()
      const tabs = first.getByRole('tab')
      const count = await tabs.count()
      if (count > 1) {
        await tabs.nth(1).click()
        assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true')
        assert.ok((await first.getByRole('heading', { level: 3 }).textContent()).length)
      }
      await live.screenshot({ path: '/tmp/realnews-home-live.png' })
      console.log(`Live homepage passed in ${Date.now() - started}ms; ${await live.locator('.story-card').count()} cards, ${count} perspectives in lead story.`)
    }
    console.log('Homepage Chromium checks passed: source switching, keyboard navigation, original links, briefing, filters, badges, compare navigation, retry, stale/empty/single-source states, and 320/390px layouts.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
