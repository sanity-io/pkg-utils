const INVALID_SHIM_CHARS_RE = /[^a-zA-Z0-9_-]/g
const TRAILING_CSS_EXT_RE = /\.css$/i

/**
 * Derive the emitted JS shim filename from the CSS filename so custom
 * `fileName` values get a matching shim (`styles.css` -> `styles-css.js`,
 * `foo/bar.css` -> `foo-bar-css.js`).
 *
 * @internal
 */
export function cssShimFileName(cssFileName: string): string {
  const stem = cssFileName
    .replace(TRAILING_CSS_EXT_RE, '')
    .replace(INVALID_SHIM_CHARS_RE, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${stem || 'styles'}-css.js`
}

/**
 * Derive the `.d.ts` companion filename for {@link cssShimFileName} so
 * TypeScript's `moduleResolution: "bundler"` / `"node16"` / `"nodenext"`
 * resolves the `./styles.css` subpath without `TS2882` ("Cannot find module or
 * type declarations for side-effect import").
 *
 * @internal
 */
export function cssShimDtsFileName(cssFileName: string): string {
  return cssShimFileName(cssFileName).replace(/\.js$/, '.d.ts')
}

/**
 * Source for the no-op JS shim emitted alongside `styles.css`.
 *
 * Intentionally comment-only so it parses as both CommonJS and ES module
 * regardless of the consuming package's `"type"`.
 *
 * @internal
 */
export const cssShimSource = '// Runtime no-op for Node.js, see package.json#exports\n'

/**
 * Source for the `.d.ts` companion emitted alongside the Node.js CSS shim.
 *
 * @internal
 */
export const cssShimDtsSource =
  '// Runtime no-op for Node.js, see package.json#exports\nexport {}\n'
