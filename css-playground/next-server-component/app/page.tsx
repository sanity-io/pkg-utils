import {TestComponent} from 'sanity-css-vanilla-extract-test'

// The default App Router page is a Server Component. Rendering the package during SSR exercises the
// Node shim path, while the client bundle resolves the self-referential import to the real CSS.
export default function Page() {
  return (
    <main>
      <h1>@css-playground/next-server-component</h1>
      <TestComponent />
    </main>
  )
}
