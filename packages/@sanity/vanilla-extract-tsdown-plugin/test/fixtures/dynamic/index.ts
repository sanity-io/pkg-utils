import {box} from './static.css.ts'

/**
 * Combines a statically imported style with a dynamically imported one, so the tests can assert
 * that the extracted CSS keeps execution order: the static CSS must precede the CSS of the
 * dynamically imported chunk, which only loads later at runtime.
 */
export async function getClassNames(): Promise<string> {
  const lazy = await import('./lazy.ts')
  return `${box} ${lazy.getLazyClassName()}`
}
