import {renderInto} from 'sanity-css-vanilla-extract-test'
import {render} from 'solid-js/web'

function SolidApp() {
  return <p>@css-playground/solidjs</p>
}

const solidRoot = document.getElementById('root')
if (solidRoot) {
  render(() => <SolidApp />, solidRoot)
}

// SolidJS is not React. The producer exposes a `renderInto` helper (authored with React JSX and
// using the react-dom createRoot API internally) so we can mount its component here without writing
// React in a file that Solid's JSX transform would otherwise process. This pulls the package - and
// its self-referential `import "<pkg>/bundle.css"` - into the build graph.
const reactRoot = document.getElementById('react-root')
if (reactRoot) {
  void renderInto(reactRoot)
}
