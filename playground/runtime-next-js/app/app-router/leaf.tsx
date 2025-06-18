'use client'

// Teeny tiny component in its own file, demonstrating how small client component
// leafs can be in an RSC tree, and how little the impact of using `React.createContext` can be
import {useResult} from 'use-client-directive'

export default function Leaf() {
  const result = useResult()

  return <div>useContext={result}</div>
}
