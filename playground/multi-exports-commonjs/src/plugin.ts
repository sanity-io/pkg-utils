import {type Plugin, definePlugin} from 'multi-export-commonjs'

/** @public */
export function plugin(): Plugin {
  return definePlugin({
    name: 'plugin',
  })
}
