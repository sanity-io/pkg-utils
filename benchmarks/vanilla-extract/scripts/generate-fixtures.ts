import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'

const benchmarkRoot = path.resolve(import.meta.dirname, '..')
const generatedRoot = path.join(benchmarkRoot, '.generated')
const writeBatchSize = 128

const sharedColor = 'rgb(1, 2, 3)'
const initialLeafColor = 'rgb(10, 20, 30)'

interface FixtureDefinition {
  directory: string
  plainModules: number
  styleModules: number
  /**
   * `production` modules are sized like real source files (roughly 3-4 printed pages each) so
   * parsers and per-module transforms get realistic volume; `minimal` keeps the original
   * near-empty modules for the suites where volume is beside the point — HMR (whose
   * edit-markers rely on the simple leaf shape) and the hook-filter sweep (which isolates the
   * per-module Rust ↔ JS hook boundary, best observed without parse noise).
   */
  moduleShape: 'production' | 'minimal'
}

interface FixtureManifest {
  version: 1
  representative: FixtureDefinition
  /** App-scale graph for the kitchen-sink vite build case (debug ids, css minify + target). */
  heavy: FixtureDefinition
  stress: FixtureDefinition[]
  hmr: {
    official: FixtureDefinition
    sanity: FixtureDefinition
  }
}

function readInteger(name: string, fallback: number, minimum: number): number {
  const value = process.env[name]
  if (value === undefined) return fallback

  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}, received ${value}`,
    )
  }
  return parsed
}

function readStressSizes(): number[] {
  const raw = process.env['VE_BENCH_STRESS_SIZES'] ?? '0,1000,5000'
  const sizes = raw.split(',').map((value) => {
    const parsed = Number.parseInt(value.trim(), 10)
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new Error(`VE_BENCH_STRESS_SIZES must contain non-negative integers, received ${raw}`)
    }
    return parsed
  })

  return [...new Set(sizes)].toSorted((left, right) => left - right)
}

function pad(index: number): string {
  return index.toString().padStart(5, '0')
}

function renderMinimalPlainModule(index: number): string {
  return `export const value${pad(index)} = ${index + 1}\n`
}

/**
 * Every module is sized like a production source file (roughly 3-4 printed pages) instead of a
 * synthetic one-liner, so bundler parsers get realistic per-file volume and barrel imports
 * aggregate realistic graph volume.
 *
 * Intentionally JS-only syntax (in `.ts` files, like the rest of the fixture): the official
 * Rollup pipeline has no TypeScript plugin, so plain modules reach Rollup's own parser as-is.
 * The `.css.ts` modules are where TS syntax is fair game — both pipelines compile those with
 * TS-capable tooling before the bundler parses the result.
 */
function renderPlainModule(index: number): string {
  const id = pad(index)
  const hue = (index * 37) % 360
  const step = (index % 7) + 2
  const limit = ((index * 13) % 50) + 25

  return [
    `/**`,
    ` * Feature module ${id}: a representative slice of product code (tokens, pure helpers, a`,
    ` * reducer, and a small service) so bundlers parse realistic per-file volume.`,
    ` */`,
    ``,
    `export const tokens${id} = {`,
    `  spacing: {xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 40},`,
    `  radius: {none: 0, sm: 2, md: 6, lg: 12, pill: 999},`,
    `  duration: {instant: 0, fast: 120, normal: 240, slow: 400},`,
    `  zIndex: {base: 0, dropdown: ${100 + (index % 10)}, overlay: ${200 + (index % 10)}, toast: 300},`,
    `  hue: ${hue},`,
    `  breakpoints: {`,
    `    phone: 360,`,
    `    tablet: 768,`,
    `    laptop: 1024,`,
    `    desktop: 1440,`,
    `    wide: 1920,`,
    `  },`,
    `}`,
    ``,
    `export const defaultConfig${id} = {`,
    `  id: 'feature-${id}',`,
    `  enabled: ${index % 3 !== 0},`,
    `  weight: ${(index % 9) + 1},`,
    `  labels: ['module', 'benchmark', 'fixture-${id}'],`,
    `  thresholds: {warn: ${limit}, error: ${limit * 2}, retryDelayMs: ${step * 250}},`,
    `  variant: '${index % 3 === 0 ? 'control' : index % 3 === 1 ? 'treatment' : 'holdout'}',`,
    `  rollout: {`,
    `    percentage: ${(index * 11) % 100},`,
    `    cohorts: [`,
    `      {name: 'internal', seed: ${index + 1}},`,
    `      {name: 'beta', seed: ${index + 2}},`,
    `      {name: 'public', seed: ${index + 3}},`,
    `    ],`,
    `  },`,
    `}`,
    ``,
    `export function clamp${id}(value, minimum, maximum) {`,
    `  if (Number.isNaN(value)) return minimum`,
    `  if (value < minimum) return minimum`,
    `  if (value > maximum) return maximum`,
    `  return value`,
    `}`,
    ``,
    `export function formatLabel${id}(raw) {`,
    `  const trimmed = raw.trim().toLowerCase()`,
    `  if (trimmed.length === 0) return 'unnamed'`,
    `  return trimmed`,
    `    .split(/[\\s_-]+/)`,
    `    .filter((part) => part.length > 0)`,
    `    .map((part, partIndex) =>`,
    `      partIndex === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),`,
    `    )`,
    `    .join('')`,
    `}`,
    ``,
    `export function accumulateMetrics${id}(metrics, samples) {`,
    `  const next = {...metrics}`,
    `  for (const sample of samples) {`,
    `    const key = formatLabel${id}(sample.name)`,
    `    next[key] = clamp${id}((next[key] ?? 0) + sample.value, 0, Number.MAX_SAFE_INTEGER)`,
    `  }`,
    `  return next`,
    `}`,
    ``,
    `export function createInitialState${id}() {`,
    `  return {status: 'idle', attempts: 0, lastUpdatedAt: null, history: [], metrics: {}}`,
    `}`,
    ``,
    `export function reduceFeature${id}(state, event) {`,
    `  switch (event.type) {`,
    `    case 'requested':`,
    `      return {`,
    `        ...state,`,
    `        status: 'loading',`,
    `        attempts: state.attempts + 1,`,
    `        history: [...state.history, {at: event.at, status: 'loading'}],`,
    `      }`,
    `    case 'resolved':`,
    `      return {`,
    `        ...state,`,
    `        status: 'ready',`,
    `        lastUpdatedAt: event.at,`,
    `        metrics: accumulateMetrics${id}(state.metrics, [`,
    `          {name: 'payload size', value: event.payloadSize},`,
    `        ]),`,
    `        history: [...state.history, {at: event.at, status: 'ready'}],`,
    `      }`,
    `    case 'rejected':`,
    `      return {`,
    `        ...state,`,
    `        status: event.retryable && state.attempts < ${step} ? 'idle' : 'failed',`,
    `        history: [...state.history, {at: event.at, status: 'failed'}],`,
    `      }`,
    `    case 'reset':`,
    `      return createInitialState${id}()`,
    `    default:`,
    `      return state`,
    `  }`,
    `}`,
    ``,
    `export class FeatureService${id} {`,
    `  #state = createInitialState${id}()`,
    `  #config`,
    ``,
    `  constructor(config = {}) {`,
    `    this.#config = {...defaultConfig${id}, ...config}`,
    `  }`,
    ``,
    `  get config() {`,
    `    return this.#config`,
    `  }`,
    ``,
    `  get state() {`,
    `    return this.#state`,
    `  }`,
    ``,
    `  dispatch(event) {`,
    `    this.#state = reduceFeature${id}(this.#state, event)`,
    `    return this.#state`,
    `  }`,
    ``,
    `  snapshotEntries() {`,
    `    return Object.entries(this.#state.metrics).sort(([left], [right]) =>`,
    `      left.localeCompare(right),`,
    `    )`,
    `  }`,
    `}`,
    ``,
    `const registry${id} = new Map([`,
    `  [defaultConfig${id}.id, defaultConfig${id}],`,
    `  ['feature-${id}-fallback', {...defaultConfig${id}, enabled: false, weight: 0}],`,
    `])`,
    ``,
    `export function resolveConfig${id}(configId) {`,
    `  return registry${id}.get(configId) ?? defaultConfig${id}`,
    `}`,
    ``,
    `export const value${id} = ${index + 1}`,
    ``,
  ].join('\n')
}

function renderPlainIndex(count: number): string {
  if (count === 0) return 'export const plainTotal = 0\n'

  const imports = Array.from(
    {length: count},
    (_, index) => `import {value${pad(index)}} from './plain/module-${pad(index)}.ts'`,
  )
  const values = Array.from({length: count}, (_, index) => `value${pad(index)}`)

  return `${imports.join('\n')}\n\nexport const plainTotal = [${values.join(', ')}].reduce(\n  (total, value) => total + value,\n  0,\n)\n`
}

function renderMinimalStyleModule(index: number): string {
  const red = (index * 17 + 20) % 256
  const green = (index * 29 + 40) % 256
  const blue = (index * 41 + 60) % 256
  const backgroundColor = index === 0 ? initialLeafColor : `rgb(${red}, ${green}, ${blue})`

  return [
    `import {style} from '@vanilla-extract/css'`,
    `import {accentColor} from '../theme.ts'`,
    ``,
    `export const className${pad(index)} = style({`,
    `  color: accentColor,`,
    `  backgroundColor: '${backgroundColor}',`,
    `  border: '1px solid rgb(${blue}, ${red}, ${green})',`,
    `  padding: '${(index % 8) + 1}px',`,
    // Lowered to top/right/bottom/left by a chrome61 target, so downleveling is observable
    `  inset: ${index % 4},`,
    `})`,
    ``,
  ].join('\n')
}

/**
 * Sized like the real-world `.css.ts` files we see in production codebases (roughly 3-4
 * printed pages of themes, variants, keyframes, and nested selector/media blocks) so the
 * per-module debug-ID transform (babel upstream, yuku in the Sanity fork) and the CSS pipeline
 * have realistic volume to chew on.
 *
 * Load-bearing markers, relied on by the smoke harness (and kept HMR-compatible even though
 * the HMR fixtures use the minimal shape):
 * - `className<index>` stays the first export, with `color: accentColor` (the shared-theme
 *   dependency) and, for index 0, the `initialLeafColor` background (which must stay the first
 *   rgb() literal in the source).
 * - the `inset` shorthand (lowered by a chrome61 target, so downleveling is observable).
 * - non-marker colors use hsl()/var() so no other rgb() literal can collide with the marker
 *   search-and-replace.
 */
function renderStyleModule(index: number): string {
  const id = pad(index)
  const red = (index * 17 + 20) % 256
  const green = (index * 29 + 40) % 256
  const blue = (index * 41 + 60) % 256
  const backgroundColor = index === 0 ? initialLeafColor : `rgb(${red}, ${green}, ${blue})`
  const hue = (index * 37) % 360
  const spacingStep = (index % 8) + 1

  return [
    `import {createVar, keyframes, style, styleVariants} from '@vanilla-extract/css'`,
    `import {accentColor} from '../theme.ts'`,
    ``,
    `export const surfaceHue${id} = createVar()`,
    `export const surfaceSpacing${id} = createVar()`,
    `export const surfaceRing${id} = createVar()`,
    ``,
    `export const className${id} = style({`,
    `  color: accentColor,`,
    `  backgroundColor: '${backgroundColor}',`,
    `  border: '1px solid hsl(${(hue + 40) % 360}deg 60% 40%)',`,
    `  padding: '${spacingStep}px',`,
    // Lowered to top/right/bottom/left by a chrome61 target, so downleveling is observable
    `  inset: ${index % 4},`,
    `  vars: {`,
    `    [surfaceHue${id}]: '${hue}deg',`,
    `    [surfaceSpacing${id}]: '${spacingStep * 4}px',`,
    `    [surfaceRing${id}]: 'hsl(${hue}deg 70% 52% / 0.4)',`,
    `  },`,
    `  transition: 'background-color 120ms ease-out, color 120ms ease-out',`,
    `  selectors: {`,
    `    '&:hover': {`,
    `      backgroundColor: 'hsl(${hue}deg 48% 92%)',`,
    `      boxShadow: \`0 0 0 3px \${surfaceRing${id}}\`,`,
    `    },`,
    `    '&:focus-visible': {`,
    `      outline: \`2px solid \${surfaceRing${id}}\`,`,
    `      outlineOffset: '2px',`,
    `    },`,
    `    '&[data-disabled="true"]': {`,
    `      opacity: 0.45,`,
    `      pointerEvents: 'none',`,
    `    },`,
    `  },`,
    `  '@media': {`,
    `    'screen and (min-width: 768px)': {`,
    `      padding: \`calc(\${surfaceSpacing${id}} / 2)\`,`,
    `      fontSize: '${14 + (index % 4)}px',`,
    `    },`,
    `    'screen and (min-width: 1280px)': {`,
    `      padding: \`\${surfaceSpacing${id}}\`,`,
    `      lineHeight: ${(1 + (index % 5) / 10).toFixed(1)},`,
    `    },`,
    `    '(prefers-reduced-motion: reduce)': {`,
    `      transition: 'none',`,
    `    },`,
    `  },`,
    `})`,
    ``,
    `const pulse${id} = keyframes({`,
    `  '0%': {transform: 'scale(1)', opacity: 1},`,
    `  '50%': {transform: 'scale(${(1 + (index % 6) / 100).toFixed(2)})', opacity: 0.85},`,
    `  '100%': {transform: 'scale(1)', opacity: 1},`,
    `})`,
    ``,
    `export const surface${id} = style({`,
    `  display: 'flex',`,
    `  flexDirection: 'column',`,
    `  gap: \`calc(\${surfaceSpacing${id}} / 4)\`,`,
    `  borderRadius: '${(index % 6) + 2}px',`,
    `  background: 'hsl(${hue}deg 30% 98%)',`,
    `  animationName: pulse${id},`,
    `  animationDuration: '${1200 + (index % 8) * 150}ms',`,
    `  animationIterationCount: 'infinite',`,
    `  selectors: {`,
    `    [\`\${className${id}} &\`]: {`,
    `      background: 'transparent',`,
    `    },`,
    `    '&:last-child': {`,
    `      marginBlockEnd: 0,`,
    `    },`,
    `  },`,
    `  '@supports': {`,
    `    '(backdrop-filter: blur(4px))': {`,
    `      backdropFilter: 'blur(${(index % 5) + 2}px)',`,
    `      background: 'hsl(${hue}deg 30% 98% / 0.8)',`,
    `    },`,
    `  },`,
    `})`,
    ``,
    `export const heading${id} = style({`,
    `  fontWeight: ${500 + (index % 4) * 100},`,
    `  letterSpacing: '${((index % 5) / 100).toFixed(2)}em',`,
    `  marginBlock: \`calc(\${surfaceSpacing${id}} / 8) calc(\${surfaceSpacing${id}} / 2)\`,`,
    `  textWrap: 'balance',`,
    `})`,
    ``,
    `export const body${id} = style([`,
    `  heading${id},`,
    `  {`,
    `    fontWeight: 400,`,
    `    color: 'hsl(${(hue + 180) % 360}deg 15% 25%)',`,
    `    maxInlineSize: '${60 + (index % 20)}ch',`,
    `  },`,
    `])`,
    ``,
    `export const tone${id} = styleVariants({`,
    `  neutral: {`,
    `    backgroundColor: 'hsl(${hue}deg 10% 96%)',`,
    `    color: 'hsl(${hue}deg 10% 20%)',`,
    `  },`,
    `  positive: {`,
    `    backgroundColor: 'hsl(145deg 45% 94%)',`,
    `    color: 'hsl(145deg 60% 22%)',`,
    `  },`,
    `  caution: {`,
    `    backgroundColor: 'hsl(45deg 80% 93%)',`,
    `    color: 'hsl(40deg 70% 25%)',`,
    `  },`,
    `  critical: {`,
    `    backgroundColor: 'hsl(4deg 70% 95%)',`,
    `    color: 'hsl(4deg 72% 30%)',`,
    `    selectors: {`,
    `      '&:hover': {`,
    `        backgroundColor: 'hsl(4deg 70% 90%)',`,
    `      },`,
    `    },`,
    `  },`,
    `})`,
    ``,
    `const sizeScale${id} = {`,
    `  compact: {paddingBlock: '${spacingStep}px', fontSize: '${12 + (index % 3)}px'},`,
    `  regular: {paddingBlock: '${spacingStep * 2}px', fontSize: '${14 + (index % 3)}px'},`,
    `  spacious: {paddingBlock: '${spacingStep * 3}px', fontSize: '${16 + (index % 3)}px'},`,
    `} as const`,
    ``,
    `export const size${id} = styleVariants(sizeScale${id}, (scale) => ({`,
    `  ...scale,`,
    `  paddingInline: \`calc(\${surfaceSpacing${id}} / 2)\`,`,
    `  '@media': {`,
    `    'screen and (max-width: 480px)': {`,
    `      paddingInline: '${spacingStep * 2}px',`,
    `    },`,
    `  },`,
    `}))`,
    ``,
    `export const emphasis${id} = styleVariants({`,
    `  subtle: [body${id}, {textDecorationLine: 'none'}],`,
    `  strong: [heading${id}, {textDecorationLine: 'underline', textUnderlineOffset: '2px'}],`,
    `})`,
    ``,
  ].join('\n')
}

function renderStylesIndex(count: number): string {
  const imports = Array.from(
    {length: count},
    (_, index) => `import {className${pad(index)}} from './styles/style-${pad(index)}.css.ts'`,
  )
  const classNames = Array.from({length: count}, (_, index) => `className${pad(index)}`)

  return `${imports.join('\n')}\n\nexport const classNames = [${classNames.join(', ')}]\n`
}

function renderLibraryEntry(): string {
  return [
    `import {plainTotal} from './plain.ts'`,
    `import {classNames} from './styles.ts'`,
    ``,
    `export {plainTotal}`,
    ``,
    `export function getBenchmarkClassName() {`,
    `  return classNames[0] ?? ''`,
    `}`,
    ``,
  ].join('\n')
}

function renderBrowserEntry(): string {
  return [
    `import {plainTotal} from './plain.ts'`,
    `import {classNames} from './styles.ts'`,
    ``,
    `const probe = document.querySelector('#probe')`,
    `if (!(probe instanceof HTMLElement)) throw new Error('Missing #probe element')`,
    `probe.className = classNames[0] ?? ''`,
    `probe.dataset.plainTotal = String(plainTotal)`,
    ``,
    `const storageKey = 'vanilla-extract-benchmark-loads'`,
    `const loads = Number(sessionStorage.getItem(storageKey) ?? '0') + 1`,
    `sessionStorage.setItem(storageKey, String(loads))`,
    `const runtime = {loads, ready: true, updates: 0}`,
    `window['__vanillaExtractBenchmark'] = runtime`,
    ``,
    `if (import.meta.hot) {`,
    `  import.meta.hot.accept('./styles.ts', (nextStyles) => {`,
    `    probe.className = nextStyles?.classNames[0] ?? ''`,
    `  })`,
    `  import.meta.hot.on('vite:afterUpdate', () => {`,
    `    runtime.updates += 1`,
    `  })`,
    `}`,
    ``,
  ].join('\n')
}

async function writeInBatches(files: Array<readonly [string, string]>): Promise<void> {
  for (let index = 0; index < files.length; index += writeBatchSize) {
    await Promise.all(
      files
        .slice(index, index + writeBatchSize)
        .map(([filePath, contents]) => writeFile(filePath, contents)),
    )
  }
}

async function generateFixture(definition: FixtureDefinition): Promise<void> {
  const fixtureRoot = path.join(generatedRoot, definition.directory)
  const sourceRoot = path.join(fixtureRoot, 'src')
  const plainRoot = path.join(sourceRoot, 'plain')
  const stylesRoot = path.join(sourceRoot, 'styles')

  await Promise.all([mkdir(plainRoot, {recursive: true}), mkdir(stylesRoot, {recursive: true})])

  const renderPlain =
    definition.moduleShape === 'production' ? renderPlainModule : renderMinimalPlainModule
  const renderStyle =
    definition.moduleShape === 'production' ? renderStyleModule : renderMinimalStyleModule

  const plainFiles: Array<readonly [string, string]> = Array.from(
    {length: definition.plainModules},
    (_, index) => [path.join(plainRoot, `module-${pad(index)}.ts`), renderPlain(index)],
  )
  const styleFiles: Array<readonly [string, string]> = Array.from(
    {length: definition.styleModules},
    (_, index) => [path.join(stylesRoot, `style-${pad(index)}.css.ts`), renderStyle(index)],
  )

  await Promise.all([writeInBatches(plainFiles), writeInBatches(styleFiles)])
  await Promise.all([
    writeFile(
      path.join(fixtureRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: `@vanilla-extract-benchmark/${definition.directory}`,
          private: true,
          type: 'module',
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      path.join(fixtureRoot, 'index.html'),
      '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="probe">probe</div><script type="module" src="/src/main.ts"></script></body></html>\n',
    ),
    writeFile(path.join(sourceRoot, 'library.ts'), renderLibraryEntry()),
    writeFile(path.join(sourceRoot, 'main.ts'), renderBrowserEntry()),
    writeFile(path.join(sourceRoot, 'plain.ts'), renderPlainIndex(definition.plainModules)),
    writeFile(path.join(sourceRoot, 'styles.ts'), renderStylesIndex(definition.styleModules)),
    writeFile(path.join(sourceRoot, 'theme.ts'), `export const accentColor = '${sharedColor}'\n`),
  ])
}

const representativePlainModules = readInteger('VE_BENCH_MODULES', 500, 0)
const representativeStyleModules = readInteger('VE_BENCH_STYLES', 100, 1)
const heavyPlainModules = readInteger('VE_BENCH_HEAVY_MODULES', 5000, 0)
const heavyStyleModules = readInteger('VE_BENCH_HEAVY_STYLES', 500, 1)
const hmrPlainModules = readInteger('VE_BENCH_HMR_MODULES', representativePlainModules, 0)
const hmrStyleModules = readInteger('VE_BENCH_HMR_STYLES', representativeStyleModules, 1)

const manifest: FixtureManifest = {
  version: 1,
  representative: {
    directory: 'representative',
    plainModules: representativePlainModules,
    styleModules: representativeStyleModules,
    moduleShape: 'production',
  },
  heavy: {
    directory: 'heavy',
    plainModules: heavyPlainModules,
    styleModules: heavyStyleModules,
    moduleShape: 'production',
  },
  stress: readStressSizes().map((plainModules) => ({
    directory: `stress-${plainModules}`,
    plainModules,
    styleModules: 1,
    moduleShape: 'minimal',
  })),
  hmr: {
    official: {
      directory: 'hmr-official',
      plainModules: hmrPlainModules,
      styleModules: hmrStyleModules,
      moduleShape: 'minimal',
    },
    sanity: {
      directory: 'hmr-sanity',
      plainModules: hmrPlainModules,
      styleModules: hmrStyleModules,
      moduleShape: 'minimal',
    },
  },
}

await rm(generatedRoot, {recursive: true, force: true})
await mkdir(generatedRoot, {recursive: true})

const definitions = [
  manifest.representative,
  manifest.heavy,
  ...manifest.stress,
  manifest.hmr.official,
  manifest.hmr.sanity,
]
await Promise.all(definitions.map((definition) => generateFixture(definition)))
await writeFile(path.join(generatedRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// eslint-disable-next-line no-console
console.log(
  `Generated ${definitions.length} benchmark fixtures in ${path.relative(process.cwd(), generatedRoot)}`,
)
