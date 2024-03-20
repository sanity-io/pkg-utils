import {definePlugin, type Plugin} from 'multi-export-commonjs'

/** @public */
export function plugin(): Plugin {
  return definePlugin({
    name: 'plugin',
  })
}

export * from './shared'
