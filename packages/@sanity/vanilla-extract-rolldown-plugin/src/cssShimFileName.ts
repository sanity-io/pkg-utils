/**
 * The no-op JS shim file name for a CSS file under `inject.nodeCompat`.
 *
 * `bundle.css` → `bundle-css.js` — deliberately not `${cssFileName}.js` (`bundle.css.js`),
 * which vanilla-extract's `cssFileFilter` (`/\.css\.(js|cjs|mjs|jsx|ts|tsx)$/`) would treat as
 * a stylesheet module. When a consumer later resolves `./bundle.css` to the shim (e.g. via
 * Vitest/Vite's `ModuleRunner` under the `node`/`default` export conditions), a `.css.js`
 * filename would be compiled as if it were `.css.ts` output and throw.
 *
 * @public
 */
export function cssShimFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.js`
}

/**
 * The `.d.ts` companion for {@link cssShimFileName}. `bundle.css` → `bundle-css.d.ts`.
 * Emitted alongside {@link cssFileDtsFileName} so both the `browser`/`style` (`bundle.css`)
 * and `node`/`default` (`bundle-css.js`) export targets resolve a declaration file.
 *
 * @public
 */
export function cssShimDtsFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.d.ts`
}

/**
 * The `.d.ts` companion for the extracted CSS file itself. `bundle.css` → `bundle.css.d.ts`.
 *
 * @public
 */
export function cssFileDtsFileName(cssFileName: string): string {
  return `${cssFileName}.d.ts`
}
