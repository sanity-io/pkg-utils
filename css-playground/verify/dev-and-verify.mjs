import {spawn} from 'node:child_process'
import path from 'node:path'
import {setTimeout as sleep} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'

/**
 * Convenience wrapper that starts a consumer's dev server, waits for it to come up, runs the
 * headless-browser CSS check against it, then shuts the dev server down.
 *
 * Usage:
 *   node dev-and-verify.mjs <app-name> [css|no-css]
 *   # e.g. node dev-and-verify.mjs vite css
 *   #      node dev-and-verify.mjs next-server-component no-css
 *
 * Requires Chromium: `pnpm --filter @css-playground/verify install-browser`.
 */

const appArg = process.argv[2]
const expect = process.argv[3] ?? 'css'

if (!appArg) {
  console.error('usage: node dev-and-verify.mjs <app-name> [css|no-css]')
  process.exit(2)
}

const filter = appArg.startsWith('@css-playground/') ? appArg : `@css-playground/${appArg}`
const name = filter.replace('@css-playground/', '')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dirname, '..', '..')

// `detached` so we can kill the whole process group (the framework CLI is a grandchild of pnpm).
const dev = spawn('pnpm', ['--filter', filter, 'dev'], {cwd: repoRoot, detached: true})

function shutdown() {
  if (!dev.pid) return
  try {
    process.kill(-dev.pid, 'SIGTERM')
  } catch {
    // already gone
  }
}

let output = ''
let resolveUrl
const urlFound = new Promise((resolve) => {
  resolveUrl = resolve
})
const onData = (chunk) => {
  output += chunk.toString()
  const match = output.match(/https?:\/\/localhost:\d+/)
  if (match) resolveUrl(match[0])
}
dev.stdout.on('data', onData)
dev.stderr.on('data', onData)

const url = await Promise.race([urlFound, sleep(120_000).then(() => null)])

if (!url) {
  console.error(`Timed out waiting for ${filter} dev server URL.\n${output}`)
  shutdown()
  process.exit(1)
}

// Wait for the server to actually accept requests.
let ready = false
for (let i = 0; i < 60 && !ready; i++) {
  try {
    await fetch(url)
    ready = true
  } catch {
    await sleep(1000)
  }
}

const verify = spawn(
  'pnpm',
  ['--filter', '@css-playground/verify', 'exec', 'node', 'verify-css.mjs', url, name, expect],
  {cwd: repoRoot, stdio: 'inherit'},
)
const [code] = await new Promise((resolve) => verify.on('exit', (c, s) => resolve([c, s])))

shutdown()
process.exit(code ?? 1)
