import type {NextConfig} from 'next'
import {createConfig} from 'sanity-css-vanilla-extract-test'

// Evaluated in Node during `next build`, reproducing the sanity-io/sanity#12825 failure mode:
// importing a package whose entry chunk has a self-referential `import "<pkg>/bundle.css"` in a
// CSS-unaware Node context. It must resolve to the JS shim rather than crash.
createConfig()

const nextConfig: NextConfig = {}

export default nextConfig
