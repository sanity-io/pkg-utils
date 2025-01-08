import {fetchSearchResults} from './data'

export function SearchResults({query}: {query: string}) {
  if (query === '') {
    return null
  }

  const albums = fetchSearchResults(query)

  if (albums.length === 0) {
    return (
      <p>
        No matches for <i>"{query}"</i>
      </p>
    )
  }

  return (
    <ul>
      {albums.map((album) => (
        <li key={album.id}>
          {album.title} ({album.year})
        </li>
      ))}
    </ul>
  )
}
