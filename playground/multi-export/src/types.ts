/** @internal */
interface PluginOptions {
  /**
   * @defaultValue true
   */
  enabled?: boolean
}

/** @public */
export interface Plugin {
  name: string
  /** @internal */
  options?: PluginOptions
}

/** @public */
export interface Config extends Plugin {
  plugins?: Plugin[]
}
