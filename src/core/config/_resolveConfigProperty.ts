import {ConfigProperty, ConfigPropertyResolver} from './types'

/**
 * @internal
 */
export function _resolveConfigProperty<T>(prop: ConfigProperty<T>, initialValue: T): T {
  if (typeof prop === 'function') {
    return (prop as ConfigPropertyResolver<T>)(initialValue)
  }

  return prop
}
