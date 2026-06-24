'use client'

import dynamic from 'next/dynamic'

// A client component that lazy-loads the package's React component via next/dynamic (ssr: false),
// so the package is only pulled into a client chunk.
const LazyTestComponent = dynamic(
  () => import('sanity-css-vanilla-extract-test').then((mod) => mod.TestComponent),
  {ssr: false},
)

export default function DynamicPage() {
  return (
    <main>
      <h1>@css-playground/next - next/dynamic</h1>
      <LazyTestComponent />
    </main>
  )
}
