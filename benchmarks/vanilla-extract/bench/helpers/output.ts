import assert from 'node:assert/strict'
import {readdirSync, readFileSync} from 'node:fs'
import {readdir, readFile} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

const cssMarker = /rgb\(\s*1\s*,\s*2\s*,\s*3\s*\)|#010203/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function listFilesSync(directory: string): string[] {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFilesSync(entryPath) : [entryPath]
  })
}

async function assertCssOutput(outputDirectory: string): Promise<void> {
  const files = await listFiles(outputDirectory)
  const cssFiles = files.filter((filePath) => filePath.endsWith('.css'))
  assert(cssFiles.length > 0, `Expected CSS output in ${outputDirectory}`)

  const css = (await Promise.all(cssFiles.map((filePath) => readFile(filePath, 'utf8')))).join('\n')
  assert(
    cssMarker.test(css),
    `Expected the shared color marker in CSS output at ${outputDirectory}`,
  )
}

function assertCssOutputSync(outputDirectory: string): void {
  const files = listFilesSync(outputDirectory)
  const cssFiles = files.filter((filePath) => filePath.endsWith('.css'))
  assert(cssFiles.length > 0, `Expected CSS output in ${outputDirectory}`)

  const css = cssFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n')
  assert(
    cssMarker.test(css),
    `Expected the shared color marker in CSS output at ${outputDirectory}`,
  )
}

export async function assertLibraryOutput(outputDirectory: string): Promise<void> {
  await assertCssOutput(outputDirectory)

  const entryPath = path.join(outputDirectory, 'index.mjs')
  const entry: unknown = await import(`${pathToFileURL(entryPath).href}?t=${Date.now()}`)
  assert(isRecord(entry), `Expected an object module namespace from ${entryPath}`)
  const getBenchmarkClassName = entry['getBenchmarkClassName']
  if (typeof getBenchmarkClassName !== 'function') {
    throw new Error(`Expected getBenchmarkClassName export in ${entryPath}`)
  }
  assert.equal(typeof entry['plainTotal'], 'number', `Expected plainTotal export in ${entryPath}`)
  const className: unknown = Reflect.apply(getBenchmarkClassName, undefined, [])
  assert(
    typeof className === 'string' && className.length > 0,
    `Expected a generated class name from ${entryPath}`,
  )
}

export async function assertViteOutput(outputDirectory: string): Promise<void> {
  await assertCssOutput(outputDirectory)

  const files = await listFiles(outputDirectory)
  assert(
    files.some((filePath) => filePath.endsWith('.js')),
    `Expected JavaScript output in ${outputDirectory}`,
  )
  assert(
    files.some((filePath) => path.basename(filePath) === 'index.html'),
    `Expected index.html output in ${outputDirectory}`,
  )
}

export function assertLibraryOutputSync(outputDirectory: string): void {
  assertCssOutputSync(outputDirectory)

  const entryPath = path.join(outputDirectory, 'index.mjs')
  const source = readFileSync(entryPath, 'utf8')
  assert.match(source, /getBenchmarkClassName/)
  assert.match(source, /plainTotal/)
}

export function assertViteOutputSync(outputDirectory: string): void {
  assertCssOutputSync(outputDirectory)

  const files = listFilesSync(outputDirectory)
  assert(
    files.some((filePath) => filePath.endsWith('.js')),
    `Expected JavaScript output in ${outputDirectory}`,
  )
  assert(
    files.some((filePath) => path.basename(filePath) === 'index.html'),
    `Expected index.html output in ${outputDirectory}`,
  )
}
