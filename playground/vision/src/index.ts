import {definePlugin} from 'sanity'
import {route} from 'sanity/router'

import {type VisionToolConfig} from './types'

export const visionTool = definePlugin<VisionToolConfig | void>((options) => {
  const {name, title, ...config} = options || {}

  return {
    name: '@sanity/vision',
    tools: [
      {
        name: name || 'vision',
        title: title || 'Vision',
        options: config,
        router: route.create('/*'),
      },
    ],
  }
})
