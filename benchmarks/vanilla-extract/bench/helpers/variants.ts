/**
 * The build variant matrix: CSS minification and syntax downleveling (`target`) are toggled
 * independently and combined, since both flow through different code paths in each plugin, and
 * identifier formatting (`short` vs `debug`) is toggled on its own — the `debug` variant runs
 * the debug-ID source transform (babel in `@vanilla-extract/integration`, an oxc AST pass in
 * `@sanity/vanilla-extract-integration`) for every `.css.ts` module, which `short` skips
 * entirely. Minify/target aren't crossed with `debug`: they run after extraction and are
 * orthogonal to the per-module transform being measured.
 */
export interface BuildVariant {
  /** Stable slug used in output directory names. */
  slug: string
  /** Human-readable label used in benchmark names. */
  label: string
  minify: boolean
  target: string | false
  identifiers: 'short' | 'debug'
}

export const buildVariants: BuildVariant[] = [
  {
    slug: 'baseline',
    label: 'no minify, no target',
    minify: false,
    target: false,
    identifiers: 'short',
  },
  {slug: 'minify', label: 'minify', minify: true, target: false, identifiers: 'short'},
  {
    slug: 'target',
    label: 'target chrome61',
    minify: false,
    target: 'chrome61',
    identifiers: 'short',
  },
  {
    slug: 'minify-target',
    label: 'minify + target chrome61',
    minify: true,
    target: 'chrome61',
    identifiers: 'short',
  },
  {
    slug: 'debug-ids',
    label: 'debug identifiers',
    minify: false,
    target: false,
    identifiers: 'debug',
  },
]
