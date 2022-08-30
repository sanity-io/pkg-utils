import {ConfigProperty, ConfigPropertyResolver} from './types'

/**
 * @internal
 */
export function _resolveConfigProperty<T>(prop: ConfigProperty<T> | undefined, initialValue: T): T {
  if (!prop) return initialValue

  if (typeof prop === 'function') {
    return (prop as ConfigPropertyResolver<T>)(initialValue)
  }

  return prop
}
