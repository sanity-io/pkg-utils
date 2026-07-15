import {
  DEFAULT_CSS_FILE_NAME,
  vanillaExtractPlugin as rolldownVanillaExtractPlugin,
  type Options,
} from '@sanity/vanilla-extract-rolldown-plugin'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'
import {createConditionalCssExport, insertCssExport} from './exports.ts'

export type {Options} from '@sanity/vanilla-extract-rolldown-plugin'

/**
 * A tsdown plugin that compiles vanilla-extract `.css.ts` modules and extracts their CSS into a
 * single `lightningcss`-optimized file, following the same architecture (and option vocabulary)
 * as `@tsdown/css`.
 *
 * It wraps the rolldown-generic
 * [`@sanity/vanilla-extract-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-rolldown-plugin#readme)
 * (compilation, hook filters, single-file extraction, and the `inject` wiring) with the tsdown
 * specifics: the CSS syntax lowering `target` defaults to tsdown's resolved top-level `target`,
 * the self-referential import of `inject.nodeCompat` uses the package name tsdown resolved, and
 * the conditional `"./<fileName>"` export is written to `package.json` through tsdown's
 * [`exports` feature](https://tsdown.dev/options/package-exports) when it's enabled.
 * @public
 */
export function vanillaExtractPlugin(options: Options = {}): TsdownPlugin {
  const fileName = options.fileName ?? DEFAULT_CSS_FILE_NAME
  /**
   * The conditional CSS export flavor of `inject`: only that flavor needs the `package.json`
   * exports wiring below.
   */
  const nodeCompat =
    typeof options.inject === 'object' ? (options.inject.nodeCompat ?? false) : false

  const plugin = rolldownVanillaExtractPlugin(options)

  return {
    ...plugin,

    // With `inject.nodeCompat`, write the conditional `./<fileName>` export to `package.json`
    // (and, through tsdown, to `publishConfig.exports`) by composing into `exports.customExports`
    // before the config is resolved — the tsdown analogue of a Vite plugin extending the user
    // config from its `config` hook. tsdown's `exports` feature is opt-in, so nothing is written
    // (and the conditional export has to be maintained manually) when it's not enabled.
    tsdownConfig(config: UserConfig) {
      if (!nodeCompat) return undefined
      const exportsOption = config.exports
      if (!exportsOption) return undefined

      // Normalize the `boolean | CIOption | object` forms of the `exports` option into the
      // object form, preserving the enabled-ness (`true` and bare CI conditions mean enabled)
      const exportsOptions: Extract<NonNullable<UserConfig['exports']>, object> = exportsOption ===
      true
        ? {}
        : typeof exportsOption === 'string'
          ? {enabled: exportsOption}
          : exportsOption

      const conditionalCssExport = createConditionalCssExport(fileName, config.outDir ?? 'dist')
      const previousCustomExports = exportsOptions.customExports
      exportsOptions.customExports = async (exportsMap, context) => {
        // Apply a pre-existing `customExports` first (both its function and record forms,
        // mirroring how tsdown itself applies them), then insert the conditional CSS export
        const base =
          typeof previousCustomExports === 'function'
            ? await previousCustomExports(exportsMap, context)
            : previousCustomExports
              ? {...exportsMap, ...previousCustomExports}
              : exportsMap
        return insertCssExport(base, `./${fileName}`, conditionalCssExport)
      }
      config.exports = exportsOptions
      return undefined
    },

    // Forward the tsdown-resolved context to the rolldown plugin: the top-level `target` (the
    // default for the CSS syntax lowering target, like `css.target` in `@tsdown/css`), the
    // package name (for the self-referential import injected by `inject.nodeCompat`), and the
    // working directory. The hook fires once per output format with the same values. Outside
    // tsdown the rolldown plugin falls back to `@sanity/browserslist-config` and reading
    // package.json from the working directory.
    tsdownConfigResolved(config: ResolvedConfig) {
      plugin.api.setBuildContext({
        target: config.target,
        packageName: config.pkg?.name,
        cwd: config.cwd,
      })
    },
  }
}
