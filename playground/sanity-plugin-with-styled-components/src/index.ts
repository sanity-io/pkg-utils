import {definePlugin, type Plugin} from 'sanity'

interface ColorOptions {
  /**
   * @defaultValue 'hex'
   */
  format?: 'hex' | 'rgb' | 'hsl' | 'hsv'
  alpha?: boolean
}

/** @public */
export const colorInput: Plugin<ColorOptions> = definePlugin<ColorOptions>({
  name: '@sanity/color-input',
})

export {ColorInput} from './LazyColorInput'
