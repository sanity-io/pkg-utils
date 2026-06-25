import dynamic from 'next/dynamic'

// A Server Component that uses next/dynamic to code-split the package into its own chunk. (No
// `ssr: false`, which is not allowed in Server Components.)
const LazyTestComponent = dynamic(() =>
  import('sanity-css-vanilla-extract-test').then((mod) => mod.TestComponent),
)

export default function Page() {
  return (
    <main>
      <h1>@css-playground/next-dynamic</h1>
      <LazyTestComponent />
    </main>
  )
}
