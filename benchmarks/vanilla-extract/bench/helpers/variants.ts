/**
 * The build variant matrix: CSS minification and syntax downleveling (`target`) are toggled
 * independently and combined, since both flow through different code paths in each plugin.
 */
export interface BuildVariant {
  /** Stable slug used in output directory names. */
  slug: string
  /** Human-readable label used in benchmark names. */
  label: string
  minify: boolean
  target: string | false
}

export const buildVariants: BuildVariant[] = [
  {slug: 'baseline', label: 'no minify, no target', minify: false, target: false},
  {slug: 'minify', label: 'minify', minify: true, target: false},
  {slug: 'target', label: 'target chrome61', minify: false, target: 'chrome61'},
  {slug: 'minify-target', label: 'minify + target chrome61', minify: true, target: 'chrome61'},
]
