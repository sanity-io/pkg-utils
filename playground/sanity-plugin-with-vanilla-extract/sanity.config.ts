import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {colorInput} from './src'

export default defineConfig({
  projectId: 'ppsg7ml5',
  dataset: 'test',
  plugins: [structureTool(), colorInput()],
  schema: {
    types: [
      {
        type: 'document',
        name: 'colorInputTest',
        fields: [
          {type: 'string', name: 'title', title: 'Title'},
          {type: 'color', name: 'limited_srgb', title: 'Limited sRGB'},
          {
            type: 'color',
            name: 'display_p3',
            title: 'Display P3',
            options: {colorspace: 'display-p3'},
          },
          {
            type: 'color',
            name: 'limited_srgb_alpha',
            title: 'Limited sRGB with alpha',
            options: {alpha: true},
          },
          {
            type: 'color',
            name: 'display_p3_alpha',
            title: 'Display P3 with alpha',
            options: {colorspace: 'display-p3', alpha: true},
          },
        ],
      },
    ],
  },
  tasks: {enabled: false},
  scheduledPublishing: {enabled: false},
  announcements: {enabled: false},
  beta: {create: {startInCreateEnabled: false}},
})
