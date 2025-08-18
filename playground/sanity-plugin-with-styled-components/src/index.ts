import {definePlugin, type Plugin} from 'sanity'
import {colorType} from './schema'

/** @public */
export const colorInput: Plugin = definePlugin({
  name: '@sanity/color-input',
  schema: {types: [colorType]},
})

export {ColorInput} from './LazyColorInput'
export type {ColorDefinition} from './schema'
