import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  dist: 'dist',
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  rollup: {
    // With `vanillaExtract: true`, pkg-utils' compat mode (on by default) automatically injects the
    // self-referential `import "sanity-css-vanilla-extract-test/bundle.css"`, emits the
    // `bundle.css.js` shim, and writes the conditional `./bundle.css` export to package.json.
    vanillaExtract: true,
  },
})
