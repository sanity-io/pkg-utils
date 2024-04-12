/**
 * Interface for the {@link route} object.
 *
 * @public
 */
export interface RouteObject {
  /**
   * Creates a new router.
   * Returns {@link Router}
   * See {@link RouteNodeOptions} and {@link RouteChildren}
   */
  create: (
    routeOrOpts: RouteNodeOptions | string,
    childrenOrOpts?: RouteNodeOptions | RouteChildren | null,
    children?: Router | RouteChildren,
  ) => Router
}

/**
 * @public
 */
export interface RouteTransform<T> {
  /**
   * Converts a path string to a state object.
   */
  toState: (value: string) => T

  /**
   * Converts a state object to a path string.
   */
  toPath: (value: T) => string
}

/**
 * @public
 */
export type SearchParam = [key: string, value: string]

/**
 * @public
 */
export type RouterState = Record<string, unknown> & {_searchParams?: SearchParam[]}

/**
 * @public
 */
export type RouteChildren =
  | RouterNode[]
  | ((state: RouterState) => Router | RouterNode | RouterNode[] | undefined | false)

/**
 * @public
 */
export interface RouteSegment {
  /**
   * The name of the segment.
   */
  name: string
  /**
   * The type of the segment.
   * Can be either "dir" or "param".
   */
  type: 'dir' | 'param'
}

/**
 * @public
 */
export interface Route {
  /**
   * The raw string representation of the route.
   */
  raw: string
  /**
   * An array of route segments that make up the route.
   * See {@link RouteSegment}
   */
  segments: RouteSegment[]
  /**
   * An optional object containing route transforms.
   * See {@link RouteTransform} and {@link RouterState}
   */
  transform?: {
    [key: string]: RouteTransform<RouterState>
  }
}

/**
 * @public
 */
export interface RouterNode {
  /**
   * The route information for this node. See {@link Route}
   */
  route: Route
  /**
   * An optional scope for this node.
   */
  scope?: string

  /**
   * Optionally disable scoping of search params
   * Scoped search params will be represented as scope[param]=value in the url
   * Disabling this will still scope search params based on any parent scope unless the parent scope also has disabled search params scoping
   * Caution: enabling this can cause conflicts with multiple plugins defining search params with the same name
   */
  __unsafe_disableScopedSearchParams?: boolean

  /**
   * An optional object containing transforms to apply to this node.
   * See {@link RouteTransform} and {@link RouterState}
   */
  transform?: {
    [key: string]: RouteTransform<RouterState>
  }
  /**
   * The child nodes of this node. See {@link RouteChildren}
   */
  children: RouteChildren
}

/**
 * @public
 */
export interface Router extends RouterNode {
  /**
   * Indicates whether this router is a route.
   * @internal
   */
  _isRoute: boolean
}

/**
 * An object containing functions for creating routers and router scopes.
 * See {@link RouteObject}
 *
 * @public
 *
 * @example
 * ```ts
 * const router = route.create({
 *   path: "/foo",
 *   children: [
 *     route.create({
 *       path: "/bar",
 *       children: [
 *         route.create({
 *           path: "/:baz",
 *           transform: {
 *             baz: {
 *               toState: (id) => ({ id }),
 *               toPath: (state) => state.id,
 *             },
 *           },
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
export const route: RouteObject = {
  create: (routeOrOpts, childrenOrOpts, children) =>
    _createNode(normalizeArgs(routeOrOpts, childrenOrOpts, children)),
}

/**
 * @internal
 * @param options - Route node options
 */
export function _createNode(options: RouteNodeOptions): Router {
  // eslint-disable-next-line no-console
  console.log({options})

  return {
    _isRoute: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    route: null as any,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeArgs(...args: any[]): RouteNodeOptions
function normalizeArgs(
  path: string | RouteNodeOptions,
  childrenOrOpts?: RouteNodeOptions | Router | RouteChildren,
  children?: Router | RouteChildren,
): RouteNodeOptions {
  if (typeof path === 'object') {
    return path
  }

  if (
    Array.isArray(childrenOrOpts) ||
    typeof childrenOrOpts === 'function' ||
    isRoute(childrenOrOpts)
  ) {
    return {path, children: normalizeChildren(childrenOrOpts)}
  }

  if (children) {
    return {path, ...childrenOrOpts, children: normalizeChildren(children)}
  }

  return {path, ...childrenOrOpts}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeChildren(children: any): RouteChildren {
  if (Array.isArray(children) || typeof children === 'function') {
    return children
  }

  return children ? [children] : []
}

function isRoute(val?: RouteNodeOptions | Router | RouteChildren) {
  return val && '_isRoute' in val
}

/**
 * @public
 */
export interface RouteNodeOptions {
  /**
   * The path of the route node.
   */
  path?: string
  /**
   * The children of the route node. See {@link RouteChildren}
   */
  children?: RouteChildren
  /**
   * The transforms to apply to the route node. See {@link RouteTransform}
   */
  transform?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: RouteTransform<any>
  }
  /**
   * The scope of the route node.
   */
  scope?: string

  /**
   * Optionally disable scoping of search params
   * Scoped search params will be represented as scope[param]=value in the url
   * Disabling this will still scope search params based on any parent scope unless the parent scope also has disabled search params scoping
   * Caution: enabling this can cause conflicts with multiple plugins defining search params with the same name
   */
  __unsafe_disableScopedSearchParams?: boolean
}
