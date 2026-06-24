import {createConfig, CREATE_CONFIG_MESSAGE, TestComponent} from 'sanity-css-vanilla-extract-test'
import t from 'tap'

// node-tap runs the test file in Node, so the self-referential `import "<pkg>/bundle.css"` must
// resolve to the JS shim rather than crash with `Error: Unknown file extension ".css"`.
t.test('imports sanity-css-vanilla-extract-test without a .css crash', async (t) => {
  const config = createConfig()
  t.equal(config.marker, CREATE_CONFIG_MESSAGE)
  t.equal(typeof TestComponent, 'function')
})
