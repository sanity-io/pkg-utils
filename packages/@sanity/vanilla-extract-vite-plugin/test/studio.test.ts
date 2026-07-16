import {spawn} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {mkdir, mkdtemp, readdir, readFile, rm} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {afterAll, beforeAll, describe, expect, test} from 'vitest'

type PluginKind = 'official' | 'sanity'
type IdentifierMode = 'short' | 'debug' | 'custom'

interface BuildVariant {
  slug: string
  identifiers: IdentifierMode
  cssMinify: boolean
  cssTarget: 'esnext' | 'chrome61'
}

interface ProcessExit {
  code: number | null
  signal: NodeJS.Signals | null
}

interface RunningSanity {
  child: ReturnType<typeof spawn>
  completed: Promise<ProcessExit>
  output: () => string
}

interface StyleArtifact {
  className: string
  declarations: string[]
  markerColor: 'hex' | 'rgb'
}

interface BuildArtifact extends StyleArtifact {
  cssFileCount: number
  stylesheetLinkCount: number
}

const fixtureRoot = path.join(import.meta.dirname, 'fixtures/studio')
const requireFromFixture = createRequire(path.join(fixtureRoot, 'package.json'))
const markerColorPattern = /rgb\(\s*1\s*,\s*2\s*,\s*3\s*\)|#010203/i

const buildVariants = [
  {slug: 'short-expanded', identifiers: 'short', cssMinify: false, cssTarget: 'esnext'},
  {slug: 'short-minified-target', identifiers: 'short', cssMinify: true, cssTarget: 'chrome61'},
  {slug: 'debug-target', identifiers: 'debug', cssMinify: false, cssTarget: 'chrome61'},
  {slug: 'debug-minified', identifiers: 'debug', cssMinify: true, cssTarget: 'esnext'},
  {slug: 'custom-expanded', identifiers: 'custom', cssMinify: false, cssTarget: 'esnext'},
  {
    slug: 'custom-minified-target',
    identifiers: 'custom',
    cssMinify: true,
    cssTarget: 'chrome61',
  },
] as const satisfies readonly BuildVariant[]

let temporaryRoot = ''

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function resolvePackageBin(packageName: string, binName: string): string {
  const packageJsonPath = requireFromFixture.resolve(`${packageName}/package.json`)
  const manifest: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (!isRecord(manifest)) throw new Error(`Invalid package manifest at ${packageJsonPath}`)

  const bin = manifest['bin']
  const relativeBin =
    typeof bin === 'string'
      ? bin
      : isRecord(bin) && typeof bin[binName] === 'string'
        ? bin[binName]
        : undefined
  if (!relativeBin) throw new Error(`Could not resolve ${binName} from ${packageJsonPath}`)
  return path.resolve(path.dirname(packageJsonPath), relativeBin)
}

const sanityBin = resolvePackageBin('sanity', 'sanity')

function startSanity(arguments_: string[], environment: NodeJS.ProcessEnv): RunningSanity {
  const child = spawn(process.execPath, [sanityBin, ...arguments_], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      CI: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      SANITY_TELEMETRY_DISABLED: '1',
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stderr = ''
  let stdout = ''
  child.stderr?.setEncoding('utf8')
  child.stdout?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk
  })
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk
  })

  const completed = new Promise<ProcessExit>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code, signal) => resolve({code, signal}))
  })

  return {
    child,
    completed,
    output: () => `${stdout}\n${stderr}`.trim(),
  }
}

async function waitForCompletion(running: RunningSanity, timeout: number): Promise<ProcessExit> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      running.child.kill('SIGKILL')
      reject(new Error(`Sanity command timed out after ${timeout}ms\n${running.output()}`))
    }, timeout)
  })

  try {
    return await Promise.race([running.completed, timedOut])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function runSanity(arguments_: string[], environment: NodeJS.ProcessEnv): Promise<string> {
  const running = startSanity(arguments_, environment)
  const {code, signal} = await waitForCompletion(running, 120_000)
  if (code !== 0) {
    throw new Error(
      `Sanity exited with ${code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`}\n${running.output()}`,
    )
  }
  return running.output()
}

async function stopSanity(running: RunningSanity): Promise<void> {
  if (running.child.exitCode !== null || running.child.signalCode !== null) return
  running.child.kill('SIGTERM')

  const stopped = await Promise.race([
    running.completed.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])
  if (stopped || running.child.exitCode !== null || running.child.signalCode !== null) return

  running.child.kill('SIGKILL')
  await running.completed
}

function studioEnvironment(
  plugin: PluginKind,
  identifiers: IdentifierMode,
  scenario: string,
  options: {cssMinify?: boolean; cssTarget?: BuildVariant['cssTarget']} = {},
): NodeJS.ProcessEnv {
  return {
    VE_STUDIO_CACHE_DIR: path.join(temporaryRoot, 'vite-cache', `${scenario}-${plugin}`),
    VE_STUDIO_CSS_MINIFY: options.cssMinify ? '1' : '0',
    VE_STUDIO_CSS_TARGET: options.cssTarget ?? 'esnext',
    VE_STUDIO_IDENTIFIERS: identifiers,
    VE_STUDIO_PLUGIN: plugin,
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true})
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )
  return files.flat()
}

function extractStyleArtifact(css: string): StyleArtifact {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const rule = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((match) =>
    markerColorPattern.test(match[2] ?? ''),
  )
  if (!rule?.[1] || !rule[2]) throw new Error(`Could not find marker rule in CSS:\n${css}`)

  const className = rule[1].match(/\.([_a-zA-Z][\w-]*)/)?.[1]
  if (!className) throw new Error(`Could not find marker class in selector: ${rule[1]}`)

  const markerColor = rule[2].match(markerColorPattern)?.[0]
  if (!markerColor) throw new Error(`Could not find marker color in rule: ${rule[2]}`)

  const declarations = rule[2]
    .split(';')
    .map((declaration) =>
      declaration.trim().replace(markerColorPattern, '#010203').replaceAll(/\s+/g, ''),
    )
    .filter(Boolean)
    .toSorted()

  return {
    className,
    declarations,
    markerColor: markerColor.startsWith('#') ? 'hex' : 'rgb',
  }
}

async function readBuildArtifact(outputDirectory: string): Promise<BuildArtifact> {
  const files = await listFiles(outputDirectory)
  const cssFiles = files.filter((filePath) => filePath.endsWith('.css')).toSorted()
  if (cssFiles.length === 0) throw new Error(`No CSS files found in ${outputDirectory}`)

  const css = (await Promise.all(cssFiles.map((filePath) => readFile(filePath, 'utf8')))).join('\n')
  const html = await readFile(path.join(outputDirectory, 'index.html'), 'utf8')
  return {
    ...extractStyleArtifact(css),
    cssFileCount: cssFiles.length,
    stylesheetLinkCount: [...html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/gi)]
      .length,
  }
}

function assertIdentifier(className: string, identifiers: IdentifierMode): void {
  if (identifiers === 'debug') {
    expect(className).toContain('styles_studioMarker__')
  } else if (identifiers === 'custom') {
    expect(className).toMatch(/^parity_[\w-]+$/)
  } else {
    expect(className).not.toContain('studioMarker')
    expect(className).not.toMatch(/^parity_/)
  }
}

function assertBuildVariant(artifact: BuildArtifact, variant: BuildVariant): void {
  assertIdentifier(artifact.className, variant.identifiers)
  expect(artifact.stylesheetLinkCount).toBeGreaterThan(0)
  expect(artifact.markerColor).toBe(variant.cssMinify ? 'hex' : 'rgb')

  // Vite applies `cssTarget` in its CSS minifier; with minification disabled it deliberately
  // leaves the authored syntax untouched.
  if (variant.cssMinify && variant.cssTarget === 'chrome61') {
    expect(artifact.declarations).not.toContain('inset:0')
    expect(artifact.declarations).toEqual(
      expect.arrayContaining(['top:0', 'right:0', 'bottom:0', 'left:0']),
    )
  } else {
    expect(artifact.declarations).toContain('inset:0')
  }
}

async function runBuild(plugin: PluginKind, variant: BuildVariant): Promise<BuildArtifact> {
  const outputDirectory = path.join(temporaryRoot, 'build', `${variant.slug}-${plugin}`)
  await rm(outputDirectory, {recursive: true, force: true})
  await runSanity(
    ['build', outputDirectory, '--yes', '--no-auto-updates', '--no-minify', '--no-source-maps'],
    studioEnvironment(plugin, variant.identifiers, `build-${variant.slug}`, variant),
  )
  return readBuildArtifact(outputDirectory)
}

async function extractSchema(plugin: PluginKind, identifiers: IdentifierMode): Promise<unknown> {
  const outputPath = path.join(temporaryRoot, 'schema', `${identifiers}-${plugin}.json`)
  await mkdir(path.dirname(outputPath), {recursive: true})
  // The CLI joins `--path` to the Studio root rather than resolving an absolute path.
  const outputArgument = path.relative(fixtureRoot, outputPath)
  await runSanity(
    [
      'schemas',
      'extract',
      '--path',
      outputArgument,
      '--workspace',
      'default',
      '--enforce-required-fields',
    ],
    studioEnvironment(plugin, identifiers, `schema-${identifiers}`),
  )
  return JSON.parse(await readFile(outputPath, 'utf8')) as unknown
}

async function getFreePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Could not allocate a TCP port')
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return address.port
}

async function waitForServer(url: string, running: RunningSanity): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (running.child.exitCode !== null || running.child.signalCode !== null) {
      const {code, signal} = await running.completed
      throw new Error(
        `Sanity dev exited with ${code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`}\n${running.output()}`,
      )
    }

    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(1_000)})
      if (response.ok) return
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Sanity dev did not become ready at ${url}\n${running.output()}`)
}

function extractDevCss(source: string): string {
  const literal = source.match(/const __vite__css\s*=\s*("(?:\\.|[^"\\])*")/)?.[1]
  if (!literal) throw new Error(`Could not find Vite's CSS payload:\n${source}`)
  const css: unknown = JSON.parse(literal)
  if (typeof css !== 'string') throw new Error('Vite CSS payload was not a string')
  return css
}

async function runDev(plugin: PluginKind, identifiers: IdentifierMode): Promise<StyleArtifact> {
  const port = await getFreePort()
  const origin = `http://127.0.0.1:${port}`
  const running = startSanity(
    ['dev', '--host', '127.0.0.1', '--port', String(port), '--no-auto-updates'],
    studioEnvironment(plugin, identifiers, `dev-${identifiers}`),
  )

  try {
    await waitForServer(origin, running)
    const moduleResponse = await fetch(`${origin}/src/styles.css.ts`)
    expect(moduleResponse.ok).toBe(true)
    const moduleSource = await moduleResponse.text()

    const className = moduleSource.match(
      /(?:const|let|var)\s+studioMarker\s*=\s*["']([^"']+)["']/,
    )?.[1]
    if (!className) throw new Error(`Could not find studioMarker export:\n${moduleSource}`)

    const virtualCssPath = moduleSource.match(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/)?.[1]
    if (!virtualCssPath) throw new Error(`Could not find virtual CSS import:\n${moduleSource}`)

    const cssResponse = await fetch(new URL(virtualCssPath, origin))
    expect(cssResponse.ok).toBe(true)
    const css = extractDevCss(await cssResponse.text())
    const artifact = extractStyleArtifact(css)
    expect(artifact.className).toBe(className)
    return artifact
  } finally {
    await stopSanity(running)
  }
}

describe.sequential('Sanity Studio integration parity', () => {
  beforeAll(async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'vanilla-extract-sanity-studio-'))
  })

  afterAll(async () => {
    if (temporaryRoot) await rm(temporaryRoot, {recursive: true, force: true})
  })

  test.each(buildVariants)(
    'matches the official build with $slug',
    async (variant) => {
      const official = await runBuild('official', variant)
      assertBuildVariant(official, variant)

      const sanity = await runBuild('sanity', variant)
      assertBuildVariant(sanity, variant)
      expect(sanity).toEqual(official)
    },
    240_000,
  )

  test.each(['short', 'debug', 'custom'] as const)(
    'matches the official schema extraction with %s identifiers',
    async (identifiers) => {
      const official = await extractSchema('official', identifiers)
      const sanity = await extractSchema('sanity', identifiers)
      expect(sanity).toEqual(official)
    },
    180_000,
  )

  test.each(['short', 'debug', 'custom'] as const)(
    'matches the official dev output with %s identifiers',
    async (identifiers) => {
      const official = await runDev('official', identifiers)
      assertIdentifier(official.className, identifiers)

      const sanity = await runDev('sanity', identifiers)
      assertIdentifier(sanity.className, identifiers)
      expect(sanity).toEqual(official)
    },
    180_000,
  )
})
