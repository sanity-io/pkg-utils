import {defineConfig, defineField, defineType} from 'sanity'
import {structureTool} from 'sanity/structure'
import {colorInput} from './src'

export default defineConfig({
  projectId: 'ppsg7ml5',
  dataset: 'test',
  plugins: [structureTool(), colorInput()],
  schema: {
    types: [
      defineType({
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
      }),
    ],
  },
  tasks: {enabled: false},
  scheduledPublishing: {enabled: false},
  announcements: {enabled: false},
  beta: {create: {startInCreateEnabled: false}},
})
