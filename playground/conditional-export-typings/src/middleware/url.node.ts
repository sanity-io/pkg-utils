import * as url from 'node:url'

/** @public */
export function parse(unsafe: string) {
  return url.parse(unsafe, true)
}
