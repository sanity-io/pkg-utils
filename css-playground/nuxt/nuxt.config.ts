import {createConfig} from 'sanity-css-vanilla-extract-test'

// nuxt.config.ts is evaluated in Node by Nuxt (via jiti), so importing and calling the package here
// reproduces the CSS-unaware import scenario: the self-referential `import "<pkg>/bundle.css"` must
// resolve to the JS shim rather than crash the build.
createConfig()

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: {enabled: false},
  telemetry: false,
})
