import * as index from 'exports-dummy'
import * as extra from 'exports-dummy/extra'

export default function IndexPage() {
  return (
    <div>
      <div>
        path={index.path}, format={index.format}, runtime={index.runtime}
      </div>
      <div>
        path={extra.path}, format={extra.format}, runtime={extra.runtime}
      </div>
    </div>
  )
}
