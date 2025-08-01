import {defineField, defineType} from 'sanity'
import {ColorSwatch} from './ColorSwatch'

export const colorInputTest = defineType({
  type: 'document',
  name: 'colorInputTest',
  fieldsets: [{name: 'colors', title: 'Colors', options: {columns: 2}}],
  fields: [
    defineField({type: 'string', name: 'title', title: 'Title'}),
    defineField({
      type: 'color',
      name: 'limited_srgb',
      title: 'Limited sRGB',
      fieldset: 'colors',
    }),
    defineField({
      type: 'color',
      name: 'display_p3',
      title: 'Display P3',
      options: {colorspace: 'display-p3'},
      fieldset: 'colors',
    }),
    defineField({
      type: 'color',
      name: 'limited_srgb_alpha',
      title: 'Limited sRGB with alpha',
      options: {alpha: true},
      fieldset: 'colors',
    }),
    defineField({
      type: 'color',
      name: 'display_p3_alpha',
      title: 'Display P3 with alpha',
      options: {colorspace: 'display-p3', alpha: true},
      fieldset: 'colors',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      a: 'limited_srgb',
      b: 'display_p3',
      c: 'limited_srgb_alpha',
      d: 'display_p3_alpha',
    },
    prepare({title, a, b, c, d}) {
      return {
        title,
        media: <ColorSwatch a={a} b={b} c={c} d={d} />,
      }
    },
  },
})
