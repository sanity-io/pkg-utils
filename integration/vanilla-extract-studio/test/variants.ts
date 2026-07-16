/**
 * The option matrix the studio commands are compared across. Every variant runs once with the
 * fork (`@sanity/vanilla-extract-vite-plugin`) and once with the upstream reference
 * (`@vanilla-extract/vite-plugin`); `sanity.cli.ts` maps the `env` entries onto the plugin
 * options and the Vite CSS build options.
 */

/** How the generated identifiers are expected to look in the compared output. */
export type IdentifierVariant = 'default' | 'short' | 'debug' | 'prefix'

export interface StudioVariant {
  slug: string
  /** `VE_*` environment variables consumed by `sanity.cli.ts`. */
  env: Record<string, string>
  identifiers: IdentifierVariant
}

export interface BuildVariant extends StudioVariant {
  cssMinify: 'default' | 'true' | 'false' | 'lightningcss'
  cssTarget?: string
}

function variantEnv(
  identifiers: IdentifierVariant,
  cssMinify?: BuildVariant['cssMinify'],
  cssTarget?: string,
): Record<string, string> {
  const env: Record<string, string> = {}
  if (identifiers !== 'default') env['VE_IDENTIFIERS'] = identifiers
  if (cssMinify && cssMinify !== 'default') env['VE_CSS_MINIFY'] = cssMinify
  if (cssTarget) env['VE_CSS_TARGET'] = cssTarget
  return env
}

/**
 * `sanity build` variants. The builds run with `--no-minify` so the JS output stays greppable
 * for class names; CSS minification is driven explicitly through `build.cssMinify`, so the
 * minifier still runs against the extracted CSS where the variant asks for it.
 */
export const buildVariants: BuildVariant[] = [
  {
    slug: 'defaults',
    env: variantEnv('default'),
    identifiers: 'default',
    cssMinify: 'default',
  },
  {
    slug: 'debug-identifiers',
    env: variantEnv('debug'),
    identifiers: 'debug',
    cssMinify: 'default',
  },
  {
    slug: 'prefix-identifiers',
    env: variantEnv('prefix'),
    identifiers: 'prefix',
    cssMinify: 'default',
  },
  {
    slug: 'css-minify',
    env: variantEnv('short', 'true'),
    identifiers: 'short',
    cssMinify: 'true',
  },
  {
    slug: 'css-minify-lightningcss',
    env: variantEnv('debug', 'lightningcss'),
    identifiers: 'debug',
    cssMinify: 'lightningcss',
  },
  {
    // `cssTarget` lowering is applied by lightningcss, so the target variant enables it as
    // the minifier to make the lowering observable (`inset` → `top`/`right`/`bottom`/`left`)
    slug: 'css-target',
    env: variantEnv('debug', 'lightningcss', 'chrome61'),
    identifiers: 'debug',
    cssMinify: 'lightningcss',
    cssTarget: 'chrome61',
  },
]

/** `sanity dev` and `sanity schema extract` variants: the CSS build options don't apply. */
export const devVariants: StudioVariant[] = [
  {slug: 'defaults', env: variantEnv('default'), identifiers: 'default'},
  {slug: 'short-identifiers', env: variantEnv('short'), identifiers: 'short'},
  {slug: 'prefix-identifiers', env: variantEnv('prefix'), identifiers: 'prefix'},
]

export const schemaExtractVariants: StudioVariant[] = devVariants

export interface ClassNameExpectation {
  /** Every class of every export must match. */
  pattern: RegExp
  /**
   * For `debug` identifiers: the expected `<fileName>_<debugId>__` prefix of each export's
   * own class (composed styles append their dependencies' classes after it).
   */
  firstClassPrefixes?: {dialog: string; overlay: string; button: string}
}

/**
 * The expected class-name shape for an identifier variant. `defaultFormat` is what the
 * plugin defaults resolve to for the command under test: `short` for production builds,
 * `debug` for dev servers and the schema-extraction worker.
 */
export function classNameExpectation(
  identifiers: IdentifierVariant,
  defaultFormat: 'short' | 'debug',
): ClassNameExpectation {
  const format = identifiers === 'default' ? defaultFormat : identifiers
  switch (format) {
    case 'short':
      // A bare hash (underscore-prefixed when it starts with a digit), no debug info
      return {pattern: /^_?[a-z0-9]+$/i}
    case 'debug':
      // `<fileName>_<debugId>__<hash>`, where the debug ID is the local binding name
      return {
        pattern: /^(styles|button)_\w+__[a-z0-9]+$/i,
        firstClassPrefixes: {
          dialog: 'styles_veStudioDialog__',
          overlay: 'styles_veStudioOverlay__',
          button: 'button_veStudioButton__',
        },
      }
    case 'prefix':
      // The custom identifier function of `sanity.cli.ts`: `ve_<hash>` (no debug IDs are
      // injected for custom identifier functions, matching upstream)
      return {pattern: /^ve_[a-z0-9]+$/i}
    default:
      throw new Error(`Unsupported identifier variant: ${String(format)}`)
  }
}
