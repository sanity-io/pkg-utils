/**
 * Serializes compilations: the vanilla-extract css adapter is handed to the evaluated modules
 * through a global, so only one `.css.ts` module may be evaluated at a time. Ported from
 * `@vanilla-extract/compiler` (MIT licensed, Copyright (c) 2021 SEEK).
 * @internal
 */
let queue: Promise<unknown> = Promise.resolve()

export function lock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn)
  queue = result.catch(() => undefined)
  return result
}
