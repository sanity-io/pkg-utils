/** @public */
export function parse(unsafe: string, origin?: string) {
  return new URL(unsafe, origin)
}
