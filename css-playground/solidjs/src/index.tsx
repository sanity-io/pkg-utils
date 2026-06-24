import {createElement} from 'react'
import {createRoot} from 'react-dom/client'
import {TestComponent} from 'sanity-css-vanilla-extract-test'
import {render} from 'solid-js/web'

function SolidApp() {
  return <p>@css-playground/solidjs</p>
}

const solidRoot = document.getElementById('root')
if (solidRoot) {
  render(() => <SolidApp />, solidRoot)
}

// SolidJS is not React, so the producer's React component is mounted via the react-dom
// createRoot API (using createElement to avoid Solid's JSX transform). This pulls the package -
// and its self-referential `import "<pkg>/bundle.css"` - into the build graph.
const reactRoot = document.getElementById('react-root')
if (reactRoot) {
  createRoot(reactRoot).render(createElement(TestComponent))
}
