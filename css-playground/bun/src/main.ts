import assert from 'node:assert/strict'
import {createConfig, CREATE_CONFIG_MESSAGE, TestComponent} from 'sanity-css-vanilla-extract-test'

// Bun emulates Node when importing packages, so the self-referential `import "<pkg>/bundle.css"`
// must resolve to the JS shim (via the `node`/`default` condition) rather than crash on a `.css`
// file Bun's runtime cannot import.
const config = createConfig()

assert.equal(config.marker, CREATE_CONFIG_MESSAGE)
assert.equal(typeof TestComponent, 'function')

console.log('OK: @css-playground/bun imported the package in Bun without a .css crash')
