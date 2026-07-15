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
}

interface FixtureManifest {
  version: 1
  representative: FixtureDefinition
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

function renderPlainModule(index: number): string {
  return `export const value${pad(index)} = ${index + 1}\n`
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

function renderStyleModule(index: number): string {
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

  const plainFiles: Array<readonly [string, string]> = Array.from(
    {length: definition.plainModules},
    (_, index) => [path.join(plainRoot, `module-${pad(index)}.ts`), renderPlainModule(index)],
  )
  const styleFiles: Array<readonly [string, string]> = Array.from(
    {length: definition.styleModules},
    (_, index) => [path.join(stylesRoot, `style-${pad(index)}.css.ts`), renderStyleModule(index)],
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
const hmrPlainModules = readInteger('VE_BENCH_HMR_MODULES', representativePlainModules, 0)
const hmrStyleModules = readInteger('VE_BENCH_HMR_STYLES', representativeStyleModules, 1)

const manifest: FixtureManifest = {
  version: 1,
  representative: {
    directory: 'representative',
    plainModules: representativePlainModules,
    styleModules: representativeStyleModules,
  },
  stress: readStressSizes().map((plainModules) => ({
    directory: `stress-${plainModules}`,
    plainModules,
    styleModules: 1,
  })),
  hmr: {
    official: {
      directory: 'hmr-official',
      plainModules: hmrPlainModules,
      styleModules: hmrStyleModules,
    },
    sanity: {
      directory: 'hmr-sanity',
      plainModules: hmrPlainModules,
      styleModules: hmrStyleModules,
    },
  },
}

await rm(generatedRoot, {recursive: true, force: true})
await mkdir(generatedRoot, {recursive: true})

const definitions = [
  manifest.representative,
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
