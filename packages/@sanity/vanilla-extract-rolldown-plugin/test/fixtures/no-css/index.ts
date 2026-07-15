/**
 * A module without any vanilla-extract styles, so the tests can assert what the plugin emits
 * (or doesn't) when it's enabled but no CSS is extracted.
 */
export function getClassNames(): string {
  return ''
}
