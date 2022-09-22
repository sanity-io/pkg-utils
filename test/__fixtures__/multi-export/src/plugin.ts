import {type Plugin, definePlugin} from 'multi-export'

/** @public */
export function plugin(): Plugin {
  return definePlugin({
    name: 'plugin'
  })
}
