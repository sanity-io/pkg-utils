/** @public */
export interface Plugin {
  name: string
}

/** @public */
export interface Config extends Plugin {
  plugins?: Plugin[]
}
