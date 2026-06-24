import {TestComponent} from 'sanity-css-vanilla-extract-test'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

// Rendering the component pulls the package (and its self-referential `import "<pkg>/bundle.css"`)
// into Vite's build graph, where the `browser` condition resolves to the real CSS file.
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <TestComponent />
    </StrictMode>,
  )
}
