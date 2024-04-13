import {type Router, type RouterState} from 'sanity/router'

/**
 * @hidden
 * @beta
 */
export type Plugin<TOptions = void> = (options: TOptions) => PluginOptions

/**
 * A tool can be thought of as a top-level "view" or "app".
 * They are available through the global menu bar, and has a URL route associated with them.
 *
 * In essence, a tool is a React component that is rendered when the tool is active,
 * along with a title, name (URL segment) and icon.
 *
 * Tools can handle {@link structure.Intent | intents} such as "edit" or "create" by defining a
 * function for the `canHandleIntent` property, as well as the `getIntentState` property,
 * which defines what an intent will be mapped to in terms of the tool's URL state.
 *
 * @public
 */
export interface Tool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Options = any,
> {
  /**
   * The name of the tool, used as part of the URL.
   */
  name: string

  /**
   * Options are passed through from the configuration to the component defined by the `component`
   */
  options?: Options

  /**
   * The router for the tool. See {@link router.Router}
   */
  router?: Router

  /**
   * Title of the tool - used for the navigation menu item, along with the icon.
   */
  title: string

  /**
   * Determines whether the tool will control the `document.title`.
   */
  controlsDocumentTitle?: boolean

  /**
   * Gets the state for the given intent.
   *
   * @param intent - The intent to get the state for.
   * @param params - The parameters for the intent.
   * @param routerState - The current router state. See {@link router.RouterState}
   * @param payload - The payload for the intent.
   * @returns The state for the intent.
   */
  getIntentState?: (
    intent: string,
    params: Record<string, string>,
    routerState: RouterState | undefined,
    payload: unknown,
  ) => unknown

  /**
   * Determines whether the tool can handle the given intent.
   *
   * Can either return a boolean, or an object where the keys represent the parameters that
   * can/can not be handled. This will be used to determine whether or not a tool is the best
   * suited to handle an intent. Note that an object of only `false` values (or an empty object)
   * is treated as `true`, so you want to explicitly return `false` if you know the intent cannot
   * fulfill the intent request.
   *
   * @param intent - The intent to check.
   * @param params - The parameters for the intent.
   * @param payload - The payload for the intent.
   * @returns Boolean: whether it can handle the intent. Object: Values representing what specific parameters can be handled.
   */
  canHandleIntent?: (
    intent: string,
    params: Record<string, unknown>,
    payload: unknown,
  ) => boolean | {[key: string]: boolean}
}

/** @public */
export type ComposableOption<TValue, TContext> = (prev: TValue, context: TContext) => TValue

/** @public */
export interface ConfigContext {
  /**
   * The ID of the project.
   */
  projectId: string
  /**
   * The name of the dataset.
   */
  dataset: string
}

/** @beta */
export interface PluginOptions {
  name: string
  plugins?: PluginOptions[]
  tools?: Tool[] | ComposableOption<Tool[], ConfigContext>
}

/**
 * @hidden
 * @beta */
export type PluginFactory<TOptions> = (options: TOptions) => PluginOptions

/**
 * @hidden
 * @beta */
export function definePlugin<TOptions = void>(
  arg: PluginFactory<TOptions> | PluginOptions,
): Plugin<TOptions> {
  if (typeof arg === 'function') {
    const pluginFactory = arg

    return (options: TOptions) => {
      const result = pluginFactory(options)

      validatePlugin(result)

      return result
    }
  }

  validatePlugin(arg)

  return () => arg
}

function validatePlugin(pluginResult: PluginOptions) {
  return pluginResult
}
