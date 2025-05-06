/** @public */
export function parse(unsafe: string) {
  return new URL(unsafe)
}
