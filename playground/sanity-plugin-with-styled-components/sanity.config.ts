import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {colorInput} from './src'
import {colorInputTest} from './test/schema'

export default defineConfig({
  projectId: 'ppsg7ml5',
  dataset: 'test',
  plugins: [structureTool(), colorInput()],
  schema: {types: [colorInputTest]},
  tasks: {enabled: false},
  scheduledPublishing: {enabled: false},
  announcements: {enabled: false},
  beta: {create: {startInCreateEnabled: false}},
})
