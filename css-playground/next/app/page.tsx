import {TestComponent} from 'sanity-css-vanilla-extract-test'

// Server component: rendering the package during SSR exercises the Node shim path, while the client
// bundle resolves the self-referential import to the real CSS.
export default function Page() {
  return (
    <main>
      <h1>@css-playground/next</h1>
      <TestComponent />
    </main>
  )
}
