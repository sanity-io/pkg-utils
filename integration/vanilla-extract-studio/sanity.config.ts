import {defineConfig, defineField, defineType} from 'sanity'
import {veStudioButton} from './src/button.css'
import {veStudioDialog, veStudioOverlay} from './src/styles.css'

/**
 * The schema embeds the generated class names as a string-literal list option (which
 * `sanity schema extract` preserves as a literal value type), so the extracted schema carries
 * them: the integration tests compare the extracted schema of the fork against the upstream
 * reference, which asserts both that `.css.ts` evaluation works inside the schema-extraction
 * worker and that both implementations generate identical identifiers.
 */
const veStyledDocument = defineType({
  name: 'veStyledDocument',
  title: 'VE styled document',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Name',
      description: `dialog:${veStudioDialog} overlay:${veStudioOverlay} button:${veStudioButton}`,
      options: {
        list: [`dialog:${veStudioDialog} overlay:${veStudioOverlay} button:${veStudioButton}`],
      },
    }),
  ],
})

export default defineConfig({
  projectId: process.env['SANITY_STUDIO_PROJECT_ID'] || 'ppsg7ml5',
  dataset: process.env['SANITY_STUDIO_DATASET'] || 'test',
  schema: {
    types: [veStyledDocument],
  },
})
