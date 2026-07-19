import type {Plugin} from 'rollup'
import {cssShimDtsFileName, cssShimFileName} from '../../core/pkg/cssShimFileName.ts'

/**
 * Emits a no-op JavaScript shim alongside the extracted CSS. The conditional `./<css>` export
 * points its `node`/`default` conditions at this file so that the self-referential
 * `import "<pkg>/<css>"` resolves to a harmless module in runtimes that cannot import `.css`
 * files, instead of throwing `Error: Unknown file extension ".css"`.
 *
 * A matching `.d.ts` declaration is emitted for the shim (`bundle-css.d.ts`); the conditional
 * `./<css>` export's `types` condition points at it, so a separate `<css>.d.ts` is unnecessary.
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
        fileName: cssShimDtsFileName(cssName),
        source: `// Type declarations for \`${cssName}\` and its no-op JS shim.\ndeclare const _default: string\nexport default _default\n`,
      })
    },
  }
}
