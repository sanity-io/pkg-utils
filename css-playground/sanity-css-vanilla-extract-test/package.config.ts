import {defineConfig} from '@sanity/pkg-utils'

/**
 * The self-referential specifier injected into the entry chunk. It resolves, via the conditional
 * `./bundle.css` export in package.json, to the real extracted CSS in bundler/browser environments
 * and to a no-op JS shim in CSS-unaware runtimes (e.g. Node).
 */
const BUNDLE_CSS_IMPORT = `import "sanity-css-vanilla-extract-test/bundle.css"`

export default defineConfig({
  dist: 'dist',
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  rollup: {
    // Emit the no-op shim that the `node`/`default` conditions of the `./bundle.css` export point to.
    plugins: [
      {
        name: 'emit-bundle-css-shim',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'bundle.css.js',
            source:
              '// No-op shim for `bundle.css` in runtimes that cannot import `.css` files directly.\nexport default ""\n',
          })
        },
      },
    ],
    output: {
      intro: (chunkInfo) => {
        if (chunkInfo.isEntry && chunkInfo.name === 'index') {
          return BUNDLE_CSS_IMPORT
        }
        return ''
      },
    },
    vanillaExtract: true,
  },
})
