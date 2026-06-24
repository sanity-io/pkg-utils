import assert from 'node:assert/strict'
import {createConfig, CREATE_CONFIG_MESSAGE, TestComponent} from 'sanity-css-vanilla-extract-test'

// Deno emulates Node when importing npm packages, so the self-referential
// `import "<pkg>/bundle.css"` must resolve to the JS shim (via the `node`/`default` condition)
// rather than crash on a `.css` file Deno cannot import.
const config = createConfig()

assert.equal(config.marker, CREATE_CONFIG_MESSAGE)
assert.equal(typeof TestComponent, 'function')

console.log('OK: @css-playground/deno imported the package in Deno without a .css crash')
