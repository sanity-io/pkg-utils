import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {projectId: 'ppsg7ml5', dataset: 'test'},
  reactStrictMode: true,
  reactCompiler: {target: '18'},
})
