import type {AgentActionPath} from '@sanity/client/stega'

/**
 * @public
 */
export interface ExternalSubpathImport {
  path: AgentActionPath
}

/**
 * @public
 */
export function identity(path: AgentActionPath): AgentActionPath {
  return path
}
