/**
 * The build variant matrix: CSS minification and syntax downleveling (`target`) are toggled
 * independently and combined, since both flow through different code paths in each plugin, and
 * identifier formatting (`short` vs `debug`) is toggled on its own — the `debug` variant runs
 * the debug-ID source transform (babel in `@vanilla-extract/integration`, a yuku-parser AST
 * pass in `@sanity/vanilla-extract-integration`) for every `.css.ts` module, which `short`
 * skips entirely. Minify/target aren't crossed with `debug`: they run after extraction and are
 * orthogonal to the per-module transform being measured.
 *
 * The `whole-program` variant is Sanity-plugin-only (`compilation: 'whole-program'`: one child
 * compilation and one stylesheet for all `.css.ts` modules instead of one per module); the
 * Rollup side runs its usual per-module pipeline as the reference.
 */
export interface BuildVariant {
  /** Stable slug used in output directory names. */
  slug: string
  /** Human-readable label used in benchmark names. */
  label: string
  minify: boolean
  target: string | false
  identifiers: 'short' | 'debug'
  /** `@sanity/vanilla-extract-rolldown-plugin`'s `compilation` option (per-module by default). */
  compilation?: 'per-module' | 'whole-program'
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
  {
    slug: 'whole-program',
    label: 'whole-program compilation (Sanity plugin), no minify, no target',
    minify: false,
    target: false,
    identifiers: 'short',
    compilation: 'whole-program',
  },
]
