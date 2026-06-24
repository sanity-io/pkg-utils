import {createConfig, CREATE_CONFIG_MESSAGE, TestComponent} from 'sanity-css-vanilla-extract-test'

// Jest (node test environment) resolves the package's `exports` conditions, so the self-referential
// `import "<pkg>/bundle.css"` must resolve to the JS shim rather than crash on an unknown `.css`.
test('imports sanity-css-vanilla-extract-test without a .css crash', () => {
  const config = createConfig()
  expect(config.marker).toBe(CREATE_CONFIG_MESSAGE)
  expect(typeof TestComponent).toBe('function')
})
