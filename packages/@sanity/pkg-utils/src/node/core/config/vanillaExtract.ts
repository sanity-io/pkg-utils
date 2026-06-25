import type {PkgConfigOptions, PkgRuntime, PkgVanillaExtractOptions} from './types.ts'

/** The default name of the extracted CSS file. */
const DEFAULT_VANILLA_EXTRACT_CSS_NAME = 'bundle.css'

export interface ResolvedVanillaExtract {
  enabled: boolean
  /** Normalized options (the object form, or `{}` when `vanillaExtract: true`). */
  options: PkgVanillaExtractOptions
  /**
   * Whether to automatically wire up the conditional CSS export pattern (intro import, JS shim, and
   * the `package.json` export). Only `true` when vanilla-extract is enabled.
   */
  compatMode: boolean
}

/**
 * Normalize the `rollup.vanillaExtract` config into a consistent shape and resolve whether
 * compatibility mode is active.
 * @internal
 */
export function resolveVanillaExtract(config: PkgConfigOptions | undefined): ResolvedVanillaExtract {
  const value = config?.rollup?.vanillaExtract
  const enabled = Boolean(value)
  const options: PkgVanillaExtractOptions = value === true || !value ? {} : value
  const compatMode = enabled ? (options.extract?.compatMode ?? true) : false

  return {enabled, options, compatMode}
}

/**
 * Resolve the name of the emitted CSS file. In compat mode this is a stable, runtime-independent
 * name (so it can back a single conditional export); otherwise it keeps the historical
 * runtime-suffixed defaults.
 * @internal
 */
export function resolveVanillaExtractCssName(
  options: PkgVanillaExtractOptions,
  context: {compatMode: boolean; runtime: PkgRuntime},
): string {
  if (options.extract?.name) {
    return options.extract.name
  }

  if (context.compatMode) {
    return DEFAULT_VANILLA_EXTRACT_CSS_NAME
  }

  if (context.runtime === 'node') return 'bundle.node.css'
  if (context.runtime === 'browser') return 'bundle.browser.css'
  return DEFAULT_VANILLA_EXTRACT_CSS_NAME
}
