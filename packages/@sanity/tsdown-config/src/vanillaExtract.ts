import {readFileSync} from 'node:fs'
import path from 'node:path'
import type {Options as VanillaExtractPluginOptions} from '@vanilla-extract/rollup-plugin'
import type {Rolldown} from 'tsdown'

/** The default name of the extracted CSS file. */
const DEFAULT_VANILLA_EXTRACT_CSS_NAME = 'bundle.css'

/**
 * Options for the `@vanilla-extract/rollup-plugin` integration, including the same extensions as
 * `@sanity/pkg-utils` (`minify`, `browserslist`, and `extract.compatMode`).
 * @public
 */
export interface PackageVanillaExtractOptions extends Omit<VanillaExtractPluginOptions, 'extract'> {
  /**
   * Minify the extracted CSS with `lightningcss`.
   * @defaultValue true
   */
  minify?: boolean
  /**
   * Browserslist query passed to `lightningcss` when optimizing the extracted CSS.
   * @defaultValue `@sanity/browserslist-config`
   */
  browserslist?: string | string[]
  /**
   * Different formatting of identifiers (e.g. class names, keyframes, CSS Vars, etc).
   * @defaultValue "short"
   */
  identifiers?: VanillaExtractPluginOptions['identifiers']
  /**
   * Extract the CSS into a separate file. The CSS is always extracted, so this configures _how_.
   */
  extract?: {
    /**
     * Name of the emitted `.css` file (and, with `compatMode`, the `exports` subpath + shim base).
     * @defaultValue "bundle.css"
     */
    name?: string
    /**
     * Generate a `.css.map` sourcemap file.
     * @defaultValue true
     */
    sourcemap?: boolean
    /**
     * Compatibility mode automatically wires up the conditional CSS export pattern so userland does
     * not have to. When enabled, the config:
     *
     * - injects `import "<pkg-name>/<name>"` into the `index` entry chunk,
     * - emits a no-op `<name>.js` shim for runtimes that cannot import `.css` files, and
     * - writes the conditional `"./<name>"` export to `package.json`
     *   (`browser`/`style` → the real CSS, `node`/`default` → the shim).
     *
     * The result is that `import "<pkg>/<name>"` resolves to the real CSS in bundlers/browsers and
     * to the no-op shim in Node and similar runtimes. Disable it to wire these up yourself.
     * @defaultValue true
     */
    compatMode?: boolean
  }
}

/** @internal */
export interface ResolvedVanillaExtract {
  enabled: boolean
  /** Normalized options (the object form, or `{}` when `vanillaExtract: true`). */
  options: PackageVanillaExtractOptions
  /**
   * Whether to automatically wire up the conditional CSS export pattern (intro import, JS shim, and
   * the `package.json` export). Only `true` when vanilla-extract is enabled.
   */
  compatMode: boolean
}

/**
 * Normalize the `vanillaExtract` option into a consistent shape and resolve whether compatibility
 * mode is active.
 * @internal
 */
export function resolveVanillaExtract(
  value: boolean | PackageVanillaExtractOptions | undefined,
): ResolvedVanillaExtract {
  const enabled = Boolean(value)
  const options: PackageVanillaExtractOptions = value === true || !value ? {} : value
  const compatMode = enabled ? (options.extract?.compatMode ?? true) : false

  return {enabled, options, compatMode}
}

/**
 * Resolve the name of the emitted CSS file. Unlike `@sanity/pkg-utils`, tsdown produces a single
 * bundle that is shared across runtimes, so there are no runtime-suffixed defaults.
 * @internal
 */
export function resolveVanillaExtractCssName(options: PackageVanillaExtractOptions): string {
  return options.extract?.name ?? DEFAULT_VANILLA_EXTRACT_CSS_NAME
}

/**
 * Build the conditional CSS export object that vanilla-extract compat mode expects, e.g.
 * ```json
 * {
 *   "browser": "./dist/bundle.css",
 *   "style": "./dist/bundle.css",
 *   "node": "./dist/bundle.css.js",
 *   "default": "./dist/bundle.css.js"
 * }
 * ```
 * @internal
 */
export function createConditionalCssExport(
  cssName: string,
  outDir: string,
): Record<string, string> {
  const cssFile = `./${outDir}/${cssName}`
  const shimFile = `./${outDir}/${cssName}.js`
  return {browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
}

/**
 * Insert (or replace) the `"./<cssName>"` export in an `exports`-shaped map, preserving the
 * existing order and placing it before `./package.json` when present. Used with tsdown's
 * `exports.customExports` so both `exports` and `publishConfig.exports` receive the entry.
 * @internal
 */
export function insertCssExport(
  exports: Record<string, unknown>,
  exportKey: string,
  conditionalExport: Record<string, string>,
): Record<string, unknown> {
  const nextExports: Record<string, unknown> = {}
  let inserted = false
  for (const [key, value] of Object.entries(exports)) {
    if (key === exportKey) continue
    if (key === './package.json' && !inserted) {
      nextExports[exportKey] = conditionalExport
      inserted = true
    }
    nextExports[key] = value
  }
  if (!inserted) {
    nextExports[exportKey] = conditionalExport
  }
  return nextExports
}

const RE_DTS = /\.d\.[cm]?ts$/

/**
 * Build an `intro` function that prepends `autoImport` to the `index` entry chunk only. The
 * `.d.ts` chunks generated by tsdown share the build, so they are explicitly excluded.
 * @internal
 */
export function composeIntro(autoImport: string): (chunk: Rolldown.RenderedChunk) => string {
  return (chunk) =>
    chunk.isEntry && chunk.name === 'index' && !RE_DTS.test(chunk.fileName) ? `${autoImport}\n` : ''
}

/**
 * Resolve the package name from `package.json`, required by compat mode to inject the
 * self-referential CSS import.
 * @internal
 */
export function readPackageName(cwd: string): string {
  const pkgPath = path.resolve(cwd, 'package.json')
  // oxlint-disable-next-line no-unsafe-type-assertion
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {name?: unknown}
  if (typeof pkg.name !== 'string' || !pkg.name) {
    throw new Error(
      `Unable to resolve the package name from ${pkgPath}, which is required by \`vanillaExtract\` compat mode to inject the self-referential CSS import. Set \`vanillaExtract: {extract: {compatMode: false}}\` to wire up the CSS export manually.`,
    )
  }
  return pkg.name
}
