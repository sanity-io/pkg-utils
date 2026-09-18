import {CREATE_CONFIG_MESSAGE, createConfig, TestComponent} from 'sanity-css-vanilla-extract-test'
import t from 'tap'

// node-tap runs the test file in Node, so the self-referential `import "<pkg>/bundle.css"` must
// resolve to the JS shim rather than crash with `Error: Unknown file extension ".css"`.
// Plain JS: tap's TypeScript loader (ts-node) cannot use TypeScript 7's compiler API.
t.test('imports sanity-css-vanilla-extract-test without a .css crash', async (subtest) => {
  const config = createConfig()
  subtest.equal(config.marker, CREATE_CONFIG_MESSAGE)
  subtest.equal(typeof TestComponent, 'function')
})
