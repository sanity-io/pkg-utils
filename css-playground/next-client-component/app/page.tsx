'use client'

import {TestComponent} from 'sanity-css-vanilla-extract-test'

// A Client Component that directly imports the package, so it is bundled into the client graph and
// the self-referential import resolves to the real CSS (the browser condition).
export default function Page() {
  return (
    <main>
      <h1>@css-playground/next-client-component</h1>
      <TestComponent />
    </main>
  )
}
