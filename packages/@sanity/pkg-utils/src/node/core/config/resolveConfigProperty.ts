import type {PkgConfigProperty, PkgConfigPropertyResolver} from './types.ts'

function isPkgConfigPropertyResolver<T>(
  prop: PkgConfigProperty<T>,
): prop is PkgConfigPropertyResolver<T> {
  return typeof prop === 'function'
}

/** @internal */
export function resolveConfigProperty<T>(
  prop: PkgConfigProperty<T> | undefined,
  initialValue: T,
): T {
  if (!prop) return initialValue

  if (isPkgConfigPropertyResolver(prop)) {
    return prop(initialValue)
  }

  return prop
}
