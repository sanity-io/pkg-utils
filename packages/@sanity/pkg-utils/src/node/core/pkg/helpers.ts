/** @internal */
export function assertFirst<T>(a: T, arr: T[]): boolean {
  const aIdx = arr.indexOf(a)

  // if not found, then we don't care
  if (aIdx === -1) {
    return true
  }

  return aIdx === 0
}

/** @internal */
export function assertLast<T>(a: T, arr: T[]): boolean {
  const aIdx = arr.indexOf(a)

  // if not found, then we don't care
  if (aIdx === -1) {
    return true
  }

  return aIdx === arr.length - 1
}

/** @internal */
export function assertOrder<T>(a: T, b: T, arr: T[]): boolean {
  const aIdx = arr.indexOf(a)
  const bIdx = arr.indexOf(b)

  // if either is not found, then we don't care
  if (aIdx === -1 || bIdx === -1) {
    return true
  }

  return aIdx < bIdx
}
