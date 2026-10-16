// Start frontend first: npm run dev -- --host 127.0.0.1
// Install Chromium with: npx playwright install chromium
// Set HIGHLIGHT_LIVE_TEST=1 to include the configured backend/AI service.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const text = 'Riverton officials announced that the central bridge will close for two weeks for repairs. A free shuttle bus will run every fifteen minutes during the closure.'
const answer = (neutralVersion) => ({ biasScore: 12, neutralVersion, howOthersSaidIt: [{ articleId: 1, source: 'Example B', quote: 'The bridge will close for repairs.', url: 'https://example.com/story' }] })
;(async () => {
 const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true, args: ['--no-sandbox'] })
 try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const result = { articles: [{ source: 'Example A', title: 'Bridge', contentFull: text }, { source: 'Example B', title: 'Bridge', contentFull: 'The bridge will close for repairs.' }], verdict: { neutralSummary: 'Repairs planned.', sources: [{ source: 'Example A', biasScore: 12, emphasis: 'Repair schedule and shuttle service', omissions: 'None identified.' }, { source: 'Example B', biasScore: 10 }] }, totalArticles: 2, totalSources: 2, sourceLocations: [] }
  await page.addInitScript(({ result }) => localStorage.setItem('realnews_history', JSON.stringify([{ topic: 'Browser highlight check', analyzedAt: new Date().toISOString(), results: result, stats: { totalArticles: 2, totalSources: 2 } }])), { result })
  await page.route('**/api/stories', route => route.fulfill({ json: { stories: [], sourceCount: 0 } }))
  let calls = 0
  let mode = 'normal'
  await page.route('**/api/highlight', async route => {
   calls++
   const current = calls
   if (mode === 'race') await new Promise(resolve => setTimeout(resolve, current === 2 ? 700 : 250))
   if (mode === 'failure') { mode = 'normal'; return route.fulfill({ status: 502, json: { error: 'Selection analysis failed. Please try again.' } }) }
   try { await route.fulfill({ json: answer(`Answer ${current}`) }) } catch {}
  })
  await page.goto(process.env.HIGHLIGHT_TEST_URL || 'http://127.0.0.1:5173')
  await page.getByText('Browser highlight check', { exact: true }).click()
  const article = page.locator('[data-highlight-source="Example A"]')
  await article.scrollIntoViewIfNeeded()
  async function select(start, end) {
   await article.evaluate((element, { start, end }) => {
    const range = document.createRange()
    range.setStart(element.firstChild, start)
    range.setEnd(element.firstChild, end)
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
   }, { start, end })
  }
  const dialog = page.getByRole('dialog', { name: 'Selection analysis' })
  await select(0, 87)
  await dialog.getByText('Answer 1', { exact: true }).waitFor()
  await dialog.getByText('How others said it:', { exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(calls, 1, 'Popup interaction must not repeat request')
  await page.getByRole('button', { name: 'Close comparison' }).click()
  await page.waitForTimeout(250)
  assert.equal(await dialog.count(), 0, 'Close must not reopen popup')
  await select(0, 87)
  await dialog.getByText('Answer 1', { exact: true }).waitFor()
  assert.equal(calls, 1, 'Same selection must use cache')
  await select(0, 87)
  await page.waitForTimeout(250)
  assert.equal(calls, 1, 'Same selection must deduplicate')
  mode = 'race'
  await select(10, 87)
  await page.waitForTimeout(230)
  await select(20, 87)
  await dialog.getByText('Answer 3', { exact: true }).waitFor()
  await page.waitForTimeout(600)
  assert.equal(await dialog.getByText('Answer 3', { exact: true }).count(), 1, 'Old response must not overwrite newer answer')
  mode = 'failure'
  await select(30, 87)
  await dialog.getByRole('alert').waitFor()
  await dialog.getByRole('button', { name: 'Retry' }).click()
  await dialog.getByText('Answer 5', { exact: true }).waitFor()
  assert.equal(calls, 5)
  await page.keyboard.press('Escape')
  assert.equal(await dialog.count(), 0)
  // Selecting the source card's analysis text must not start a request.
  await page.getByText('Repair schedule and shuttle service', { exact: true }).evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element)
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  assert.equal(await dialog.count(), 0)
  // A background click must stay closed even if the browser retains its selection.
  await select(0, 87)
  await dialog.getByText('Answer 1', { exact: true }).waitFor()
  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  assert.equal(await dialog.count(), 0, 'Outside click must not reopen stale selection')
  await page.setViewportSize({ width: 360, height: 640 })
  await article.scrollIntoViewIfNeeded()
  await select(0, 87)
  await dialog.getByText('Answer 1', { exact: true }).waitFor()
  const box = await dialog.boundingBox()
  assert.ok(box.x >= 0 && box.x + box.width <= 360, `Horizontal bounds: ${JSON.stringify(box)}`)
  assert.ok(box.y >= 0 && box.y + box.height <= 640, `Vertical bounds: ${JSON.stringify(box)}`)

  // Finish with actual mouse selection and a real API request through Vite's proxy.
  await page.keyboard.press('Escape')
  if (process.env.HIGHLIGHT_LIVE_TEST === '1') await page.unroute('**/api/highlight')
  await page.setViewportSize({ width: 1100, height: 850 })
  await article.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.getSelection().removeAllRanges())
  const started = Date.now()
  await article.click({ clickCount: 3, position: { x: 25, y: 12 } })
  await dialog.getByText('Most neutral version:', { exact: true }).waitFor({ timeout: 22000 })
  assert.equal(await dialog.getByRole('alert').count(), 0)
  assert.ok((await dialog.getByText('Bias score:', { exact: false }).textContent()).includes('/100'))
  console.log(`Native mouse highlight passed in ${Date.now() - started}ms.`)
  assert.deepEqual(errors, [])
  console.log('Chromium checks passed: selection, popup interaction, close, cache, deduplication, rapid reselection, retry, Escape, article-only scope, mobile bounds; no page errors.')
 } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
