import {Suspense, useDeferredValue, useState} from 'react'

import {Input} from './Input'
import {SearchResults} from './SearchResults'

/** @public */
export function App(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  return (
    <>
      <Input
        label="Search albums:"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        ref={(node) => {
          node?.focus()
        }}
      />
      <Suspense fallback={<h2>Loading...</h2>}>
        <div style={{opacity: isStale ? 0.5 : 1}}>
          <SearchResults query={deferredQuery} />
        </div>
      </Suspense>
    </>
  )
}
