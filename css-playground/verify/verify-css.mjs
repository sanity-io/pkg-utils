import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {chromium} from 'playwright'

/**
 * Headless-browser check of whether the producer's CSS applies in a running app.
 *
 * Usage:
 *   node verify-css.mjs <url> [name] [expect]
 *
 * - <url>    the running app to open.
 * - [name]   screenshot file name (default "screenshot").
 * - [expect] "css" (default) to require the styles to apply, or "no-css" to require they do NOT
 *            (the component renders but resolves the self-referential import to the JS shim - this is
 *            the expected outcome for pure Server Components that never ship client JS).
 *
 * It loads <url>, finds the producer's element, reads its *computed* `color`, and compares it to the
 * marker declared in `sanity-css-vanilla-extract-test`'s vanilla-extract style (`rgb(1, 2, 3)`). A
 * full-page screenshot is written to `screenshots/<name>.png` so a human can eyeball it too.
 *
 * Requires the Chromium browser to be installed once: `pnpm --filter @css-playground/verify install-browser`.
 */

const url = process.argv[2]
const name = process.argv[3] ?? 'screenshot'
const expect = process.argv[4] ?? 'css'

if (!url || (expect !== 'css' && expect !== 'no-css')) {
  console.error('usage: node verify-css.mjs <url> [name] [css|no-css]')
  process.exit(2)
}

// The marker declared in css-playground/sanity-css-vanilla-extract-test/src/styles.css.ts.
const EXPECTED_COLOR = 'rgb(1, 2, 3)'
const SELECTOR = '[data-testid="sanity-css-vanilla-extract-test"]'

const browser = await chromium.launch()

try {
  const page = await browser.newPage()
  // `domcontentloaded` rather than `networkidle`: dev servers keep an HMR websocket open, so the
  // network never goes idle. Readiness is handled by waiting for the element + polling its color.
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30_000})

  const element = page.locator(SELECTOR).first()
  await element.waitFor({state: 'visible', timeout: 30_000})

  // The element may be server-rendered (visible) before its client island hydrates and injects the
  // CSS, so poll the computed color for a while. For the shim cases the color simply never changes
  // and we fall through after the deadline.
  let color = ''
  const deadline = Date.now() + 10_000
  do {
    color = await element.evaluate((node) => getComputedStyle(node).color)
    if (color === EXPECTED_COLOR) break
    await page.waitForTimeout(250)
  } while (Date.now() < deadline)

  const borderColor = await element.evaluate((node) => getComputedStyle(node).borderTopColor)

  const outDir = path.resolve(import.meta.dirname, 'screenshots')
  await mkdir(outDir, {recursive: true})
  const screenshot = path.join(outDir, `${name}.png`)
  await page.screenshot({path: screenshot, fullPage: true})

  const cssApplied = color === EXPECTED_COLOR
  const ok = expect === 'css' ? cssApplied : !cssApplied
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${name}: css=${cssApplied ? 'applied' : 'absent (shim)'} ` +
      `color=${color} borderColor=${borderColor} expected=${expect}; screenshot=${screenshot}`,
  )
  process.exit(ok ? 0 : 1)
} finally {
  await browser.close()
}
