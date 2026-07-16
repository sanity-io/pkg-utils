import {defineConfig, defineField, defineType} from 'sanity'
import {studioMarker} from './src/styles.css'

const parityDocument = defineType({
  name: 'parityDocument',
  title: 'Parity document',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: `vanilla-extract:${studioMarker}`,
    }),
  ],
})

export default defineConfig({
  name: 'default',
  title: 'Vanilla Extract parity',
  projectId: 'ppsg7ml5',
  dataset: 'test',
  schema: {types: [parityDocument]},
  tasks: {enabled: false},
  scheduledPublishing: {enabled: false},
  announcements: {enabled: false},
})
