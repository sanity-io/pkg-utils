import {createFileRoute} from '@tanstack/react-router'
import {TestComponent} from 'sanity-css-vanilla-extract-test'

export const Route = createFileRoute('/')({
  component: Home,
})

// TanStack Start is React-based; SSR exercises the Node shim path and the client build resolves the
// self-referential import to the real CSS.
function Home() {
  return (
    <main>
      <h1>@css-playground/tanstack-start</h1>
      <TestComponent />
    </main>
  )
}
