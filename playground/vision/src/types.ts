export interface VisionProps {
  config: VisionConfig
}

export interface VisionConfig {
  defaultApiVersion: string
  defaultDataset?: string
}

export interface VisionToolConfig extends Partial<VisionConfig> {
  name?: string
  title?: string
}
