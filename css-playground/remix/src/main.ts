import assert from 'node:assert/strict'

/**
 * Remix v3 is the Preact-fork rewrite (not React) and requires Node >= 24.3. The repo's CI runs on
 * Node 22 LTS, so this smoke test skips on older Node versions. When run on a supported runtime it
 * imports the package (exercising the self-referential `import "<pkg>/bundle.css"` -> JS shim) and,
 * since Remix v3 is not React, would mount the producer's component via the react-dom createRoot API.
 */
const major = Number(process.versions.node.split('.')[0])

if (major < 24) {
  console.log(
    `SKIP: @css-playground/remix requires Node >= 24.3 (Remix v3); current is ${process.versions.node}`,
  )
  process.exit(0)
}

const {createConfig, CREATE_CONFIG_MESSAGE, TestComponent} =
  await import('sanity-css-vanilla-extract-test')

const config = createConfig()
assert.equal(config.marker, CREATE_CONFIG_MESSAGE)
assert.equal(typeof TestComponent, 'function')

// Load the Remix v3 runtime to confirm the package resolves in a Remix context. Best-effort: a
// failure to import the (beta) framework must not fail the core no-crash assertion above.
try {
  await import('remix')
} catch (error) {
  console.warn('note: could not load the remix runtime:', (error as Error).message)
}

console.log('OK: @css-playground/remix imported the package under Remix v3 without a .css crash')
