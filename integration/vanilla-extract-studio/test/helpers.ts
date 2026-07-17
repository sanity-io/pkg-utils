import {spawn, type ChildProcess} from 'node:child_process'
import {readdir, readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createServer} from 'node:net'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const outputRoot = path.join(studioRoot, 'output')

/**
 * The `sanity` CLI entry, resolved to the package's real JS bin script and spawned through
 * `process.execPath` — the `node_modules/.bin` shims are platform-specific (`sanity` on
 * POSIX, `sanity.cmd` on Windows).
 */
const sanityBinScript = (() => {
  const packageJsonPath = createRequire(import.meta.url).resolve('sanity/package.json')
  return path.join(path.dirname(packageJsonPath), 'bin/sanity')
})()

/** The two implementations under test; `upstream` is the reference for expected output. */
export type PluginImplementation = 'fork' | 'upstream'

/**
 * The environment for a spawned `sanity` command. `NODE_ENV` is removed deliberately: the
 * CLI is normally run from a terminal where it is unset, and the behaviour under test depends
 * on it (`@vanilla-extract/css` ships `NODE_ENV`-switching CJS wrappers, and `vite build`
 * flips `NODE_ENV` to `production` mid-process — a divergence a test-runner-provided
 * `NODE_ENV=test` would mask).
 */
function commandEnv(
  implementation: PluginImplementation,
  variantEnv: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DO_NOT_TRACK: '1',
    VE_PLUGIN: implementation,
    ...variantEnv,
  }
  delete env['NODE_ENV']
  // Vitest propagates NODE_OPTIONS (e.g. debugger/loader hooks) that shouldn't leak into the
  // studio commands under test.
  delete env['NODE_OPTIONS']
  return env
}

export interface SanityCommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Runs a `sanity` CLI command to completion in the studio root. */
export function runSanityCommand(
  args: string[],
  implementation: PluginImplementation,
  variantEnv: Record<string, string>,
): Promise<SanityCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [sanityBinScript, ...args], {
      cwd: studioRoot,
      env: commandEnv(implementation, variantEnv),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({exitCode: code ?? -1, stdout, stderr})
    })
  })
}

/** Formats a failed command for assertion messages. */
export function describeResult(result: SanityCommandResult): string {
  return `exit code ${result.exitCode}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {recursive: true, withFileTypes: true})
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
}

/**
 * The concatenated CSS assets of a build output, ordered by their hash-stripped file names so
 * content-hash differences between two builds don't affect the comparison.
 */
export async function readBuildCss(outDir: string): Promise<string> {
  const files = (await collectFiles(outDir)).filter((file) => file.endsWith('.css'))
  const withKeys = await Promise.all(
    files.map(async (file) => ({
      key: path.basename(file).replace(/-[\w]+\.css$/, '.css'),
      css: await readFile(file, 'utf8'),
    })),
  )
  return withKeys
    .toSorted((a, b) => a.key.localeCompare(b.key))
    .map((entry) => entry.css)
    .join('\n')
}

/** The class lists of the fixture's `.css.ts` exports, keyed like the schema description. */
export interface FixtureClassNames {
  dialog: string
  overlay: string
  button: string
}

const classNamesPattern =
  /dialog:(?<dialog>[^\s"'`$]+) overlay:(?<overlay>[^\s"'`$]+) button:(?<button>[^"'`\n$]+)/

/** Parses the fixture class names out of a schema description occurrence in `source`. */
export function parseFixtureClassNames(source: string): FixtureClassNames | undefined {
  const match = source.match(classNamesPattern)
  if (!match) return undefined
  const {dialog, overlay, button} = match.groups!
  return {dialog: dialog!, overlay: overlay!, button: button!.trim()}
}

/** Parses the `veStudio*` export bindings of the compiled `.css.ts` modules out of JS code. */
export function parseFixtureBindings(source: string): FixtureClassNames | undefined {
  const bindings: Record<string, string> = {}
  for (const match of source.matchAll(/\b(veStudio[A-Za-z]+)\s*=\s*(["'])([^"'\n]+)\2/g)) {
    bindings[match[1]!] = match[3]!
  }
  const {veStudioDialog, veStudioOverlay, veStudioButton} = bindings
  if (!veStudioDialog || !veStudioOverlay || !veStudioButton) return undefined
  return {dialog: veStudioDialog, overlay: veStudioOverlay, button: veStudioButton}
}

/**
 * The fixture class names as they appear in the built JS. The builds run with `--no-minify`,
 * so the compiled `.css.ts` modules keep their `veStudio…` binding names; if a future bundler
 * folds the constants away instead, the schema-description literal of `sanity.config.ts`
 * still carries them.
 */
export async function readBuildClassNames(outDir: string): Promise<FixtureClassNames> {
  const files = (await collectFiles(outDir)).filter((file) => file.endsWith('.js'))
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const classNames = parseFixtureBindings(source) ?? parseFixtureClassNames(source)
    if (classNames) return classNames
  }
  throw new Error(`No fixture class names found in the JS output of ${outDir}`)
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (typeof address === 'object' && address) {
        server.close(() => resolve(address.port))
      } else {
        server.close(() => reject(new Error('Could not allocate a port')))
      }
    })
  })
}

export interface DevServerHandle {
  port: number
  output: () => string
  fetchText: (pathname: string) => Promise<string>
  stop: () => Promise<void>
}

export interface StartSanityDevOptions {
  /**
   * Runs `sanity dev` with `unstable_bundledDev` (Vite's experimental bundled dev mode): the
   * studio is served as a Rolldown-bundled module graph with on-demand-compiled lazy chunks
   * instead of unbundled per-module ESM. Readiness is probed through the bundled entry.
   */
  bundledDev?: boolean
}

/**
 * Starts `sanity dev` and waits until it serves transformed modules. Always `stop()` the
 * handle (the tests do so in `finally` blocks) so no dev server outlives its test.
 */
export async function startSanityDev(
  implementation: PluginImplementation,
  variantEnv: Record<string, string>,
  {bundledDev = false}: StartSanityDevOptions = {},
): Promise<DevServerHandle> {
  const port = await findFreePort()
  const child: ChildProcess = spawn(
    process.execPath,
    [sanityBinScript, 'dev', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: studioRoot,
      env: {
        ...commandEnv(implementation, variantEnv),
        ...(bundledDev ? {VE_BUNDLED_DEV: 'true'} : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let output = ''
  child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()))
  let exited = false
  const exitPromise = new Promise<void>((resolve) => {
    child.on('close', () => {
      exited = true
      resolve()
    })
  })

  const fetchText = async (pathname: string): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`)
    if (!response.ok) {
      throw new Error(`GET ${pathname} responded with ${response.status}`)
    }
    return response.text()
  }

  const stop = async (): Promise<void> => {
    if (exited) return
    child.kill('SIGTERM')
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000)
    await exitPromise
    clearTimeout(killTimer)
  }

  // Readiness: the dev server responds with transformed studio code — a module transform
  // request in the default unbundled mode, the bundled entry chunk in bundled dev mode
  // (fetching it awaits the initial in-server bundle)
  const readinessPath = bundledDev ? '/assets/index.js' : '/src/styles.css.ts'
  const deadline = Date.now() + 120_000
  for (;;) {
    if (exited) {
      throw new Error(`sanity dev exited before becoming ready\n${output}`)
    }
    try {
      const code = await fetchText(readinessPath)
      if (code.includes('veStudioDialog')) break
    } catch {
      // not ready yet
    }
    if (Date.now() > deadline) {
      await stop()
      throw new Error(`sanity dev did not become ready in time\n${output}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return {port, output: () => output, fetchText, stop}
}

/**
 * Requests the on-demand compilation of a bundled-dev lazy chunk the way the browser runtime
 * does: lazy `import()`s in the served bundle load a stub chunk whose body fetches
 * `/@vite/lazy?id=<module id>&clientId=<id>`, compiling the chunk on first request. The
 * `clientId` must belong to a registered client, so this helper first announces one over the
 * HMR WebSocket (`vite:module-loaded`, like the Rolldown browser runtime on startup) using
 * the `wsToken` embedded in the served entry chunk.
 */
export async function compileLazyChunk(
  server: DevServerHandle,
  entryCode: string,
  lazyModuleId: string,
): Promise<string> {
  const wsToken = entryCode.match(/wsToken = "([^"]+)"/)?.[1]
  if (!wsToken) {
    throw new Error('No wsToken found in the served entry chunk')
  }

  const clientId = `integration-test-${Math.random().toString(36).slice(2)}`
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}/?token=${wsToken}`, 'vite-hmr')
  try {
    // The server greets every accepted client with `{"type":"connected"}`, so waiting for it
    // also covers the open handshake. Time-boxed so an unresponsive server (or a rejected
    // `wsToken`) fails the test instead of hanging it until the suite timeout.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for the HMR WebSocket connection greeting'))
      }, 30_000)
      socket.addEventListener('message', (event) => {
        const message: unknown = JSON.parse(String(event.data))
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'connected'
        ) {
          clearTimeout(timeout)
          resolve()
        }
      })
      socket.addEventListener('error', () => {
        clearTimeout(timeout)
        reject(new Error('HMR WebSocket connection failed'))
      })
      socket.addEventListener('close', () => {
        clearTimeout(timeout)
        reject(new Error('HMR WebSocket closed before the connection greeting'))
      })
    })
    socket.send(
      JSON.stringify({type: 'custom', event: 'vite:module-loaded', data: {modules: [], clientId}}),
    )
    // The client registration the module-loaded event triggers is processed asynchronously;
    // give it a beat before requesting a compile on its behalf
    await new Promise((resolve) => setTimeout(resolve, 250))

    const url = `/@vite/lazy?id=${encodeURIComponent(lazyModuleId)}&clientId=${clientId}`
    const response = await fetch(`http://127.0.0.1:${server.port}${url}`, {
      // The regression this exists for is a hang: the compile deadlocks until the module
      // runner's 60s transport timeout, then crashes the dev server. Outlive the timeout so
      // the failure surfaces as the server's error output instead of a client-side abort.
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) {
      throw new Error(`GET ${url} responded with ${response.status}`)
    }
    return await response.text()
  } finally {
    socket.close()
  }
}

/** The virtual `.vanilla.css` module specifiers imported by a transformed `.css.ts` module. */
export function extractVirtualCssImports(code: string): string[] {
  return [...code.matchAll(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/g)].map(
    (match) => match[1]!,
  )
}

/** The exported class names of a transformed `.css.ts` module served by the dev server. */
export function extractDevClassNames(code: string): Record<string, string> {
  const classNames: Record<string, string> = {}
  for (const match of code.matchAll(/\b(veStudio[A-Za-z]+)\s*=\s*(["'])([^"']+)\2/g)) {
    classNames[match[1]!] = match[3]!
  }
  return classNames
}
