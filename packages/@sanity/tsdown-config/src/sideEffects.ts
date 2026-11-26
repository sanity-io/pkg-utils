import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {isDeepStrictEqual} from 'node:util'
import type {RolldownChunk} from 'tsdown'

/** Matches a trailing newline so rewritten `package.json` files keep one when they had one. */
const RE_TRAILING_NEWLINE = /\n$/
/** Matches the leading whitespace of the first indented JSON line. */
const RE_JSON_INDENT = /^([ \t]+)\S/m
/** Matches declaration outputs that never carry runtime CSS imports. */
const RE_DTS = /\.d\.[cm]?ts$/
/** Matches emitted CSS assets. */
const RE_CSS_ASSET = /\.css$/
/**
 * Matches vanilla-extract-style `.css.js` chunks (and `.css.cjs` / `.css.mjs`). Deliberately
 * excludes the `*-css.js` Node shims this config emits for conditional CSS exports — those are
 * no-ops, not stylesheet modules (see `cssShimFileName`).
 */
const RE_CSS_JS_CHUNK = /\.css\.[cm]?js$/
/** Matches JS outputs that may contain a CSS import. */
const RE_JS_OUTPUT = /\.[cm]?js$/
/**
 * Matches a side-effect CSS `import` in emitted ESM. Anchored after a statement boundary
 * (`^`, `;`, or newline) so JSDoc/examples that mention those imports (e.g. `` `import
 * "./style.css"` `` in this package's own CSS plugin chunk) are not treated as side-effectful,
 * while full minify (`import "pkg/style.css";export…`) still matches. Query strings are
 * accepted so a future injector cannot slip past the scan.
 */
const RE_CSS_IMPORT = /(?:^|[;\n])\s*import\s*["'][^"']+\.css(?:\?[^"']*)?["']/m
/**
 * Matches a literal `require("…css")` call in emitted CJS. Compress can fold the injected
 * `require(…);` onto the same line as the next statement (`require("…css"), exports.x = …`),
 * so `,` is also a boundary — but it still requires a string literal ending in `.css`, which
 * dynamic `require(${specifier})` helpers in library code do not produce.
 */
const RE_CSS_REQUIRE = /(?:^|[;,\n])\s*require\s*\(\s*["'][^"']+\.css(?:\?[^"']*)?["']\s*\)/m

/**
 * The `package.json#sideEffects` value derived from a build: `false` when nothing is
 * side-effectful, otherwise the sorted list of package-relative paths that are.
 */
export type PackageSideEffects = false | string[]

/**
 * Collects the side-effectful outputs of a build: CSS assets, vanilla-extract-style `.css.js`
 * chunks, and every JS file whose emitted code imports a stylesheet. Paths are package-relative
 * with a leading `./` (e.g. `./dist/style.css`), matching the hand-maintained allowlists in
 * sanity-io/sanity#16494.
 *
 * Prefers scanning `outDir` on disk so dual-format builds and pkg-utils' CSS-then-canonical
 * waterfall see every file that exists when `build:done` runs. Falls back to the hook's
 * `chunks` when `outDir` is missing or unreadable.
 */
export function collectSideEffects(options: {
  cwd: string
  outDir: string
  chunks?: readonly RolldownChunk[]
}): PackageSideEffects {
  const {cwd} = options
  const outDir = path.resolve(cwd, options.outDir)
  const files = listOutputFiles(outDir)
  const relativeFiles =
    files.length > 0
      ? files.map((filePath) => path.relative(cwd, filePath))
      : (options.chunks ?? []).map((chunk) =>
          path.relative(cwd, path.resolve(chunk.outDir, chunk.fileName)),
        )

  const sideEffects = new Set<string>()

  for (const relativePath of relativeFiles) {
    const normalized = normalizePackagePath(relativePath)
    const baseName = path.posix.basename(normalized)

    if (RE_DTS.test(baseName)) continue

    if (RE_CSS_ASSET.test(baseName) && !baseName.endsWith('.css.map')) {
      sideEffects.add(normalized)
      continue
    }

    if (RE_CSS_JS_CHUNK.test(baseName)) {
      sideEffects.add(normalized)
      continue
    }

    if (!RE_JS_OUTPUT.test(baseName)) continue

    const absolutePath = path.resolve(cwd, relativePath)
    let code: string
    try {
      code = readFileSync(absolutePath, 'utf8')
    } catch {
      const chunk = options.chunks?.find(
        (entry) => path.resolve(entry.outDir, entry.fileName) === absolutePath,
      )
      if (!chunk || chunk.type !== 'chunk' || typeof chunk.code !== 'string') continue
      code = chunk.code
    }
    if (RE_CSS_IMPORT.test(code) || RE_CSS_REQUIRE.test(code)) sideEffects.add(normalized)
  }

  if (sideEffects.size === 0) return false
  return [...sideEffects].toSorted((a, b) => a.localeCompare(b))
}

/**
 * Writes `package.json#sideEffects` to the computed value when it differs. Preserves the
 * file's indentation, newline style, and trailing newline — the same care tsdown's exports
 * writer takes — so the rewrite does not churn formatting.
 *
 * Returns whether the file changed.
 */
export function writePackageSideEffects(options: {
  packageJsonPath: string
  sideEffects: PackageSideEffects
}): boolean {
  const {packageJsonPath, sideEffects} = options
  let originalText: string
  try {
    originalText = readFileSync(packageJsonPath, 'utf8')
  } catch {
    return false
  }

  const pkg: Record<string, unknown> = JSON.parse(originalText)
  if (isDeepStrictEqual(pkg['sideEffects'], sideEffects)) return false

  pkg['sideEffects'] = sideEffects

  const indent = RE_JSON_INDENT.exec(originalText)?.[1] ?? 2
  const eol = originalText.includes('\r\n') ? '\r\n' : '\n'
  const hasTrailingNewline = RE_TRAILING_NEWLINE.test(originalText)
  let jsonString = JSON.stringify(pkg, null, indent)
  if (eol !== '\n') jsonString = jsonString.replaceAll('\n', eol)
  if (hasTrailingNewline) jsonString += eol

  if (originalText === jsonString) return false
  writeFileSync(packageJsonPath, jsonString, 'utf8')
  return true
}

/** Recursively lists files under `dir`, ignoring missing directories. */
function listOutputFiles(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      files.push(...listOutputFiles(fullPath))
      continue
    }
    if (stat.isFile()) files.push(fullPath)
  }
  return files
}

/** Package-relative path with POSIX separators and a leading `./`. */
function normalizePackagePath(relativePath: string): string {
  const posix = relativePath.replaceAll('\\', '/')
  if (posix.startsWith('./')) return posix
  if (posix.startsWith('../')) return posix
  return `./${posix}`
}
