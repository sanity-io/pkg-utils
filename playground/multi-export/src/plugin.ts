import {definePlugin, type Plugin} from 'multi-export'

/** @public */
export function plugin(): Plugin {
  return definePlugin({
    name: 'plugin',
  })
}
