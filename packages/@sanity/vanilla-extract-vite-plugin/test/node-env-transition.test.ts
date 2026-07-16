import {execFile} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import {expect, test} from 'vitest'

const execFileAsync = promisify(execFile)

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/node-env-transition-build.mts',
)

/**
 * Regression test for CSS silently dropped from builds inside CLI hosts like `sanity build`
 * (https://github.com/sanity-io/pkg-utils/issues/3073).
 *
 * The mechanism needs a `NODE_ENV` transition, which an in-process vitest build can't
 * reproduce (the test runner pins `NODE_ENV` before anything loads): the `@vanilla-extract/*`
 * CJS wrappers pick their dev or prod build off `NODE_ENV` at first load. A CLI host imports
 * this plugin (and through it `@vanilla-extract/css`) with `NODE_ENV` unset, then `vite build`
 * flips `NODE_ENV` to `production` mid-process — so when the compiler's module runner
 * resolved the externalized `@vanilla-extract/css` to its CJS `default` export (Vite's
 * default `externalConditions` don't include `module`), the evaluated `.css.ts` modules
 * bound the compilation adapter to the dev copy while `style()` appended CSS through the prod
 * copy's mock adapter: class names kept working, CSS vanished. The compiler now pins Node
 * resolve conditions (preferring the single-file ESM builds), keeping one adapter instance.
 */
test('emits CSS when the plugin is loaded before `vite build` sets NODE_ENV', async () => {
  const env = {...process.env}
  delete env['NODE_ENV']
  // Don't leak test-runner Node options (e.g. loader hooks) into the child
  delete env['NODE_OPTIONS']

  const {stdout} = await execFileAsync(
    process.execPath,
    [
      // The child imports this package's TypeScript sources directly; older Node needs the
      // flag for that (a no-op wherever type stripping is on by default)
      ...(process.features.typescript ? [] : ['--experimental-strip-types']),
      scriptPath,
    ],
    {env, maxBuffer: 64 * 1024 * 1024},
  )

  const {css, entry} = JSON.parse(stdout) as {css: string; entry: string}

  // The entry exports the class names either way — the regression was CSS-only
  expect(entry).toContain('className')

  // Both `.css.ts` modules' rules must survive into the emitted CSS
  expect(css.includes('rgb(1, 2, 3)') || css.includes('#010203'), `css was: ${css}`).toBe(true)
  expect(css.includes('rgb(4, 5, 6)') || css.includes('#040506'), `css was: ${css}`).toBe(true)
})
