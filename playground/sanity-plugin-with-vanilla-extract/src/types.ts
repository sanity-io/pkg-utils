import type {StringInputProps, StringSchemaType} from 'sanity'

export interface ColorOptions {
  alpha?: boolean
  colorspace?: 'limited-srgb' | 'display-p3'
}

interface ColorSchemaType extends StringSchemaType {
  options?: StringSchemaType['options'] & ColorOptions
}
export type ColorInputProps = StringInputProps<ColorSchemaType>
