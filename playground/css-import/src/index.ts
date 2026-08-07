// oxlint-disable-next-line no-unassigned-import
import './button.css'

/**
 * The stylesheet is imported here rather than exported as its own subpath, so the build merges
 * it into `style.css` and injects the self-referential import into this entry.
 * @public
 */
export const buttonClassName = 'button'
