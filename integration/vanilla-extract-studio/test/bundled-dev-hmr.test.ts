import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {afterEach, describe, expect, test} from 'vitest'
import {connectHmrClient, startSanityDev, studioRoot} from './helpers.ts'

/**
 * Style edits under `sanity dev` with `unstable_bundledDev` (Vite's experimental bundled dev
 * mode). Vite never calls `hotUpdate` hooks in this mode: Rolldown's dev engine watches the
 * files itself and re-runs `load`/`transform` only for the changed file's module and the
 * modules that registered it as a watch file, dropping those whose output didn't change.
 *
 * The fork used to keep serving the CSS it evaluated at startup until the dev server restarted
 * — through HMR and full page reloads alike: its compiler inherited `experimental.bundledDev`
 * (under which Vite's watcher skips the project root, so it never saw an edit), and nothing
 * re-loaded the virtual `.vanilla.css` modules, which have no file of their own.
 *
 * There is no upstream reference here: `@vanilla-extract/vite-plugin` has the same gaps.
 */

const buttonCssTs = path.join(studioRoot, 'src/button.css.ts')
const themeTs = path.join(studioRoot, 'src/theme.ts')

const originalSources = new Map<string, string>()

async function editFixture(file: string, search: string, replacement: string): Promise<void> {
  const source = originalSources.get(file) ?? (await readFile(file, 'utf8'))
  originalSources.set(file, source)
  expect(source.split(search), `expected exactly one ${search} in ${file}`).toHaveLength(2)
  await writeFile(file, source.replace(search, replacement))
}

afterEach(async () => {
  await Promise.all([...originalSources].map(([file, source]) => writeFile(file, source)))
  originalSources.clear()
})

describe('sanity dev (bundled dev mode) HMR', () => {
  test('edits to a `.css.ts` module and to a module it imports reach the CSS without a restart', async () => {
    const server = await startSanityDev('fork', {}, {bundledDev: true})
    try {
      const entry = await server.fetchText('/assets/index.js')
      expect(entry).toContain('rgb(4, 5, 6)')
      expect(entry).toContain('rgb(1, 2, 3)')

      const hmr = await connectHmrClient(server, entry)
      try {
        await editFixture(buttonCssTs, "color: 'rgb(4, 5, 6)'", "color: 'rgb(40, 50, 60)'")
        await hmr.waitForUpdate(
          'with the edited CSS of `button.css.ts`',
          ({changedIds, code}) =>
            changedIds.includes('src/button.css.ts.vanilla.css') &&
            code.includes('rgb(40, 50, 60)'),
        )

        // `theme.ts` is a plain module `styles.css.ts` imports
        await editFixture(themeTs, "= 'rgb(1, 2, 3)'", "= 'rgb(10, 20, 30)'")
        await hmr.waitForUpdate(
          'with the CSS of `styles.css.ts` after editing `theme.ts`',
          ({changedIds, code}) =>
            changedIds.includes('src/styles.css.ts.vanilla.css') &&
            code.includes('rgb(10, 20, 30)'),
        )
      } finally {
        hmr.close()
      }

      // A page load after HMR patches regenerates the (now stale) bundle, which must carry the
      // edited CSS as well
      await server.fetchText('/')
      await expect
        .poll(
          async () => {
            const code = await server.fetchText('/assets/index.js')
            return code.includes('rgb(40, 50, 60)') && code.includes('rgb(10, 20, 30)')
          },
          {interval: 500, timeout: 60_000},
        )
        .toBe(true)
    } finally {
      await server.stop()
    }
  })
})
