import assert from 'node:assert/strict'
import {CREATE_CONFIG_MESSAGE, createConfig, TestComponent} from 'sanity-css-vanilla-extract-test'

/**
 * Importing the package evaluates its entry chunk, which runs the side-effectful
 * `import "sanity-css-vanilla-extract-test/bundle.css"`. In a plain Node runtime that import MUST
 * resolve to the no-op JS shim (via the conditional `./bundle.css` export) rather than throw
 * `Error: Unknown file extension ".css"`. This reproduces the failure mode that affected `sanity`.
 */
const config = createConfig()

assert.equal(config.marker, CREATE_CONFIG_MESSAGE)
assert.equal(typeof TestComponent, 'function')

console.log('OK: @css-playground/node imported the package in Node without a .css crash')
