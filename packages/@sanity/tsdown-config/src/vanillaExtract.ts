import type {Options as VanillaExtractPluginOptions} from '@sanity/vanilla-extract-tsdown-plugin'

/** The default name of the extracted CSS file. */
const DEFAULT_VANILLA_EXTRACT_CSS_FILE_NAME = 'bundle.css'

/**
 * Options for the `@sanity/vanilla-extract-tsdown-plugin` integration - the same options as the
 * plugin itself (`identifiers`, `fileName`, `minify`, and `target`, all modeled after the `css`
 * options of `@tsdown/css`), with `inject` extended to also write the conditional CSS export to
 * `package.json`.
 * @public
 */
export interface PackageVanillaExtractOptions extends Omit<VanillaExtractPluginOptions, 'inject'> {
  /**
   * Automatically wires up the conditional CSS export pattern so userland does not have to.
   * When enabled, the plugin:
   *
   * - injects the self-referential `import "<pkg-name>/<fileName>"` into the entry chunks that
   *   use vanilla-extract styles, and
   * - emits a no-op `<fileName>.js` shim (plus a `<fileName>.d.ts` declaration) for runtimes
   *   that cannot import `.css` files,
   *
   * and the config writes the conditional `"./<fileName>"` export to `package.json`
   * (`browser`/`style` → the real CSS, `node`/`default` → the shim).
   *
   * The result is that `import "<pkg>/<fileName>"` resolves to the real CSS in
   * bundlers/browsers and to the no-op shim in Node and similar runtimes. Disable it to wire
   * these up yourself.
   * @defaultValue true
   */
  inject?: boolean
}

/** @internal */
export interface ResolvedVanillaExtract {
  enabled: boolean
  /** Normalized options (the object form, or `{}` when `vanillaExtract: true`). */
  options: PackageVanillaExtractOptions
  /**
   * Whether to automatically wire up the conditional CSS export pattern (the plugin's `inject`
   * plus the `package.json` export). Only `true` when vanilla-extract is enabled.
   */
  inject: boolean
}

/**
 * Normalize the `vanillaExtract` option into a consistent shape and resolve whether the
 * conditional CSS export wiring (`inject`) is active.
 * @internal
 */
export function resolveVanillaExtract(
  value: boolean | PackageVanillaExtractOptions | undefined,
): ResolvedVanillaExtract {
  const enabled = Boolean(value)
  const options: PackageVanillaExtractOptions = value === true || !value ? {} : value
  const inject = enabled ? (options.inject ?? true) : false

  return {enabled, options, inject}
}

/**
 * Resolve the name of the emitted CSS file. Unlike `@sanity/pkg-utils`, tsdown produces a single
 * bundle that is shared across runtimes, so there are no runtime-suffixed defaults.
 * @internal
 */
export function resolveVanillaExtractFileName(options: PackageVanillaExtractOptions): string {
  return options.fileName ?? DEFAULT_VANILLA_EXTRACT_CSS_FILE_NAME
}

/**
 * Build the conditional CSS export object that the vanilla-extract `inject` wiring expects, e.g.
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
  cssFileName: string,
  outDir: string,
): Record<string, string> {
  const cssFile = `./${outDir}/${cssFileName}`
  const shimFile = `./${outDir}/${cssFileName}.js`
  return {browser: cssFile, style: cssFile, node: shimFile, default: shimFile}
}

/**
 * Insert (or replace) the `"./<cssFileName>"` export in an `exports`-shaped map, preserving the
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
