/**
 * The "strictly safe" proof of the atomic pass: for randomly generated style sets, every
 * combination of up to three styles on one element (with and without `:disabled`) must compute
 * to exactly the same styles in Chromium whether the stylesheet was rendered with the atomic
 * pass or without it — per module and whole-program.
 *
 * Needs a Chromium: `pnpm --filter @sanity/vanilla-extract-integration install-browser`.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium, type Browser} from 'playwright'
import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {getSourceFromVirtualCssFile} from '../src/getSourceFromVirtualCssFile.ts'
import {normalizePath} from '../src/normalizePath.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'
import {processVanillaProgram} from '../src/processVanillaProgram.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')
const fuzzRoot = path.join(__dirname, 'fixtures/atomic-fuzz')

const chromiumAvailable = fs.existsSync(chromium.executablePath())

/** A small deterministic PRNG (mulberry32), so a failing seed reproduces. */
function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T>(values: ReadonlyArray<T>): T => values[Math.floor(next() * values.length)]!
  const chance = (probability: number) => next() < probability
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  return {pick, chance, int}
}

/**
 * Properties with plenty of overlap (shorthands, longhands, logical/physical), so the barrier
 * analysis is exercised, plus a few independent ones.
 */
const PROPERTY_POOL: ReadonlyArray<[string, ReadonlyArray<string | number>]> = [
  ['padding', ['0', '4px', '8px 16px']],
  ['paddingTop', ['0', '2px']],
  ['paddingBottom', ['0', '6px']],
  ['paddingInline', ['3px', '5px']],
  ['margin', ['0', '10px']],
  ['marginLeft', ['1px', '7px']],
  ['marginInlineStart', ['9px', '11px']],
  ['display', ['block', 'inline-block', 'flex']],
  ['color', ['rgb(1, 2, 3)', 'rgb(4, 5, 6)']],
  ['border', ['1px solid rgb(7, 8, 9)', '2px dashed rgb(10, 11, 12)']],
  ['borderColor', ['rgb(13, 14, 15)', 'rgb(16, 17, 18)']],
  ['borderTopColor', ['rgb(19, 20, 21)', 'rgb(22, 23, 24)']],
  ['inset', ['0', '5px']],
  ['top', ['1px', '3px']],
  ['font', ['12px/1.5 serif', '16px/2 sans-serif']],
  ['lineHeight', ['1', '2']],
  ['fontWeight', [400, 700]],
  ['opacity', [0.5, 0.8]],
  ['width', ['10px', '20px']],
  ['inlineSize', ['30px', '40px']],
]

/** The physical longhands whose computed values are compared. */
const COMPARED_PROPERTIES = [
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-top-style',
  'border-left-width',
  'top',
  'right',
  'bottom',
  'left',
  'font-size',
  'font-family',
  'line-height',
  'font-weight',
  'opacity',
  'width',
]

function renderDeclarations(random: ReturnType<typeof createRandom>, count: number): string[] {
  const lines: string[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const [property, values] = random.pick(PROPERTY_POOL)
    if (used.has(property)) continue
    used.add(property)
    let value = random.pick(values)
    if (typeof value === 'string' && random.chance(0.1)) value = `${value} !important`
    lines.push(`${property}: ${JSON.stringify(value)},`)
  }
  return lines
}

/** Renders a random `.css.ts` module with `count` exported styles. */
function renderModule(
  seed: number,
  count: number,
  {layerImport, composeFrom}: {layerImport?: string; composeFrom?: string} = {},
): string {
  const random = createRandom(seed)
  const lines = [
    `import {layer, style} from '@vanilla-extract/css'`,
    ...(layerImport ? [`import {sharedLayer} from './${layerImport}'`] : []),
    ...(composeFrom ? [`import * as other from './${composeFrom}'`] : []),
    layerImport ? '' : `export const sharedLayer = layer()`,
  ]
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const name = `s${i}`
    const body: string[] = [...renderDeclarations(random, random.int(1, 4))]
    if (random.chance(0.3)) {
      body.push(`':disabled': {`, ...renderDeclarations(random, random.int(1, 2)), `},`)
    }
    if (random.chance(0.25)) {
      body.push(
        `'@media': {'(min-width: 1px)': {`,
        ...renderDeclarations(random, random.int(1, 2)),
        `}},`,
      )
    }
    if (random.chance(0.15)) {
      body.push(`selectors: {'&&': {`, ...renderDeclarations(random, 1), `}},`)
    }
    if (random.chance(0.15)) {
      body.push(`'@layer': {[sharedLayer]: {`, ...renderDeclarations(random, 1), `}},`)
    }
    const compositions: string[] = []
    if (i > 0 && random.chance(0.2)) compositions.push(random.pick(names))
    if (composeFrom && random.chance(0.2)) compositions.push(`other.s${random.int(0, 3)}`)
    const rule = `{\n${body.join('\n')}\n}`
    lines.push(
      compositions.length > 0
        ? `export const ${name} = style([${compositions.join(', ')}, ${rule}])`
        : `export const ${name} = style(${rule})`,
    )
    names.push(name)
  }
  return `${lines.join('\n')}\n`
}

function classLists(source: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const match of source.matchAll(/^export var (\w+) = '([^']*)';$/gm)) {
    result.set(match[1]!, match[2]!)
  }
  return result
}

interface RenderedVariant {
  css: string
  /** `file:export` → class list */
  classLists: Map<string, string>
}

async function renderPerModule(file: string, atomic: boolean): Promise<RenderedVariant> {
  const filePath = path.join(fuzzRoot, file)
  const {source} = await compile({filePath, cwd: packageRoot, identOption: 'short'})
  const output = await processVanillaFile({source, filePath, identOption: 'short', atomic})
  let css = ''
  for (const line of output.split('\n')) {
    const specifier = /^import '([^']+)';$/.exec(line)?.[1]
    if (specifier) css += `${(await getSourceFromVirtualCssFile(specifier)).source}\n`
  }
  return {
    css,
    classLists: new Map([...classLists(output)].map(([name, list]) => [`${file}:${name}`, list])),
  }
}

async function renderProgram(files: string[], atomic: boolean): Promise<RenderedVariant> {
  const program = await processVanillaProgram({
    filePaths: files.map((file) => path.join(fuzzRoot, file)),
    cwd: packageRoot,
    identOption: 'short',
    atomic,
  })
  const lists = new Map<string, string>()
  for (const file of files) {
    const source = program.modules.get(normalizePath(path.join(fuzzRoot, file))) ?? ''
    for (const [name, list] of classLists(source)) {
      lists.set(`${file}:${name}`, list)
    }
  }
  return {css: program.css, classLists: lists}
}

/** Every combination of 1–3 styles, as class lists to put on one element. */
function combinations(variant: RenderedVariant): string[][] {
  const keys = [...variant.classLists.keys()]
  const combos: string[][] = []
  for (let i = 0; i < keys.length; i++) {
    combos.push([keys[i]!])
    for (let j = i + 1; j < keys.length; j++) {
      combos.push([keys[i]!, keys[j]!])
      for (let k = j + 1; k < keys.length; k++) combos.push([keys[i]!, keys[j]!, keys[k]!])
    }
  }
  return combos
}

let browser: Browser | undefined

async function computedStyles(variant: RenderedVariant, combos: string[][]): Promise<string[]> {
  if (!browser) throw new Error('no browser')
  const page = await browser.newPage()
  try {
    const elements = combos.flatMap((combo, index) => {
      const className = combo.map((key) => variant.classLists.get(key)!).join(' ')
      return [
        `<div id="e${index}" class="${className}"></div>`,
        `<button id="d${index}" class="${className}" disabled></button>`,
      ]
    })
    await page.setContent(
      `<!doctype html><html><head><style>${variant.css}</style></head><body>${elements.join('')}</body></html>`,
    )
    // `await` so the page outlives the evaluation (the `finally` closes it)
    return await page.evaluate(
      ({count, properties}) => {
        const results: string[] = []
        for (let index = 0; index < count; index++) {
          for (const prefix of ['e', 'd']) {
            const element = document.getElementById(`${prefix}${index}`)!
            const computed = getComputedStyle(element)
            results.push(
              properties.map((property) => computed.getPropertyValue(property)).join(';'),
            )
          }
        }
        return results
      },
      {count: combos.length, properties: COMPARED_PROPERTIES},
    )
  } finally {
    await page.close()
  }
}

describe.skipIf(!chromiumAvailable)('atomic pass cascade equivalence (Chromium)', () => {
  beforeAll(async () => {
    browser = await chromium.launch()
  })
  afterAll(async () => {
    await browser?.close()
  })

  const seeds = [1, 2, 3, 4, 5, 6]

  test.each(seeds)('per-module rendering, seed %i', async (seed) => {
    fs.writeFileSync(path.join(fuzzRoot, `single-${seed}.css.ts`), renderModule(seed, 9))
    const plain = await renderPerModule(`single-${seed}.css.ts`, false)
    const atomic = await renderPerModule(`single-${seed}.css.ts`, true)
    expect([...atomic.classLists.keys()]).toEqual([...plain.classLists.keys()])
    // Something was actually shared, so the comparison means something
    expect(atomic.css).not.toBe(plain.css)

    const combos = combinations(plain)
    const [plainStyles, atomicStyles] = await Promise.all([
      computedStyles(plain, combos),
      computedStyles(atomic, combos),
    ])
    for (const [index, combo] of combos.entries()) {
      expect(atomicStyles[index * 2], `${combo.join(' + ')}`).toBe(plainStyles[index * 2])
      expect(atomicStyles[index * 2 + 1], `${combo.join(' + ')} (disabled)`).toBe(
        plainStyles[index * 2 + 1],
      )
    }
  })

  test.each(seeds)('whole-program rendering, seed %i', async (seed) => {
    fs.writeFileSync(path.join(fuzzRoot, `base-${seed}.css.ts`), renderModule(seed * 10, 4))
    fs.writeFileSync(
      path.join(fuzzRoot, `entry-${seed}.css.ts`),
      renderModule(seed * 10 + 1, 5, {
        layerImport: `base-${seed}.css.ts`,
        composeFrom: `base-${seed}.css.ts`,
      }),
    )
    const files = [`entry-${seed}.css.ts`, `base-${seed}.css.ts`]
    const plain = await renderProgram(files, false)
    const atomic = await renderProgram(files, true)
    expect([...atomic.classLists.keys()]).toEqual([...plain.classLists.keys()])

    const combos = combinations(plain)
    const [plainStyles, atomicStyles] = await Promise.all([
      computedStyles(plain, combos),
      computedStyles(atomic, combos),
    ])
    for (const [index, combo] of combos.entries()) {
      expect(atomicStyles[index * 2], `${combo.join(' + ')}`).toBe(plainStyles[index * 2])
      expect(atomicStyles[index * 2 + 1], `${combo.join(' + ')} (disabled)`).toBe(
        plainStyles[index * 2 + 1],
      )
    }
  })
})
