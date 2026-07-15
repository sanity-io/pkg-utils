import type {Plugin} from 'rollup'
import {cssShimDtsFileName, cssShimFileName} from '../../core/pkg/cssShimFileName.ts'

/**
 * Emits a no-op JavaScript shim alongside the extracted CSS. The conditional `./<css>` export
 * points its `node`/`default` conditions at this file so that the self-referential
 * `import "<pkg>/<css>"` resolves to a harmless module in runtimes that cannot import `.css`
 * files, instead of throwing `Error: Unknown file extension ".css"`.
 *
 * Matching `.d.ts` declarations are emitted for both export targets:
 * - `<css>.d.ts` for the extracted CSS file (`browser` / `style` conditions)
 * - `<css-shim>.d.ts` (e.g. `bundle-css.d.ts`) for the JS shim (`node` / `default` conditions)
 *
 * The shim is named `bundle-css.js` rather than `bundle.css.js` so it does not match
 * vanilla-extract's `cssFileFilter` (`/\.css\.(js|…)$/`).
 *
 * @param options.cssName - The CSS file name, e.g. `bundle.css`.
 * @internal
 */
export function bundleCssShim(options: {cssName: string}): Plugin {
  const {cssName} = options
  const shimFileName = cssShimFileName(cssName)

  return {
    name: 'pkg-utils:bundle-css-shim',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: shimFileName,
        source: `// No-op shim for \`${cssName}\` in runtimes that cannot import \`.css\` files directly.\nexport default ""\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: `${cssName}.d.ts`,
        source: `// Type declarations for \`${cssName}\` and its no-op JS shim.\ndeclare const _default: string\nexport default _default\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: cssShimDtsFileName(cssName),
        source: `// Type declarations for \`${cssName}\` and its no-op JS shim.\ndeclare const _default: string\nexport default _default\n`,
      })
    },
  }
}
