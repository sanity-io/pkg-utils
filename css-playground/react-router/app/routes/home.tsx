import {TestComponent} from 'sanity-css-vanilla-extract-test'

// React Router v7 is React-based, so the component renders normally. SSR exercises the Node shim
// path and the client build resolves the self-referential import to the real CSS.
export default function Home() {
  return (
    <main>
      <h1>@css-playground/react-router</h1>
      <TestComponent />
    </main>
  )
}
