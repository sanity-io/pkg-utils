import type {NextConfig} from 'next'
import {createConfig} from 'sanity-css-vanilla-extract-test'

// Importing and calling the package here reproduces the exact failure mode from
// sanity-io/sanity#12825: a CSS-unaware Node context (the Next.js config, evaluated during
// `next build`) importing a package whose entry chunk contains a self-referential
// `import "<pkg>/bundle.css"`. With the conditional export + JS shim this resolves cleanly instead
// of throwing `Error: Unknown file extension ".css"`.
createConfig()

const nextConfig: NextConfig = {}

export default nextConfig
