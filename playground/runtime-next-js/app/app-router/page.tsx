import * as index from 'dummy-module'
import * as extra from 'dummy-module/extra'
import Leaf from './leaf'

export default function IndexPage() {
  return (
    <div>
      <div>
        path={index.path}, format={index.format}, runtime={index.runtime}
      </div>
      <div>
        path={extra.path}, format={extra.format}, runtime={extra.runtime}
      </div>
      <Leaf />
    </div>
  )
}
