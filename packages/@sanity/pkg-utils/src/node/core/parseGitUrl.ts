export type ParsedGitUrl = {
  source: string
  owner: string
  name: string
}

/**
 * Parse a git remote URL into host / owner / repo name.
 * Supports https, ssh, scp-like (`git@host:path`), and `git+…` forms used by npm.
 */
export function parseGitUrl(input: string): ParsedGitUrl {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('Invalid url.')
  }

  const normalized = normalizeGitUrl(trimmed)

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('URL parsing failed.')
  }

  const source = parsed.hostname
  if (!source) {
    throw new Error('URL parsing failed.')
  }

  const segments = parsed.pathname
    .replace(/^\/+/, '')
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean)

  if (segments.length < 2) {
    throw new Error('URL parsing failed.')
  }

  const name = segments.at(-1)!
  const owner = segments.slice(0, -1).join('/')

  return {source, owner, name}
}

function normalizeGitUrl(input: string): string {
  let url = input

  // npm-style: git+https://… / git+ssh://…
  if (url.startsWith('git+')) {
    url = url.slice(4)
  }

  // scp-like: git@github.com:owner/repo.git
  const scpMatch = /^(?:[^@]+@)?([^:/\s]+):(.+)$/.exec(url)
  if (scpMatch && !url.includes('://')) {
    const host = scpMatch[1]!
    const path = scpMatch[2]!
    return `ssh://${host}/${path.replace(/^\/+/, '')}`
  }

  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) {
    return `https://${url}`
  }

  return url
}
