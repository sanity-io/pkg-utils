import {PkgConfigProperty, PkgConfigPropertyResolver} from './types'

/** @internal */
export function _resolveConfigProperty<T>(
  prop: PkgConfigProperty<T> | undefined,
  initialValue: T
): T {
  if (!prop) return initialValue

  if (typeof prop === 'function') {
    return (prop as PkgConfigPropertyResolver<T>)(initialValue)
  }

  return prop
}
