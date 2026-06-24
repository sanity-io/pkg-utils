import {TestComponent} from 'sanity-css-vanilla-extract-test'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

// Bundled by Parcel; rendering the component pulls the package (and its self-referential
// `import "<pkg>/bundle.css"`) into the build graph.
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <TestComponent />
    </StrictMode>,
  )
}
