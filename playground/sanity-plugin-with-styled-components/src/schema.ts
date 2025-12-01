import {defineType, type StringDefinition} from 'sanity'
import {ColorInput} from './LazyColorInput'
import type {ColorOptions} from './types'

const colorTypeName = 'color' as const

/**
 * @public
 */
export interface ColorDefinition extends Omit<
  StringDefinition,
  'type' | 'options' | 'placeholder'
> {
  type: typeof colorTypeName
  options?: ColorOptions
}

declare module 'sanity' {
  // makes type: 'color' narrow correctly when using defineTyp/defineField/defineArrayMember
  export interface IntrinsicDefinitions {
    color: ColorDefinition
  }
}

export const colorType = defineType({
  name: colorTypeName,
  type: 'string',
  title: 'Color',
  components: {input: ColorInput},
})
