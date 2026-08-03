import * as index from 'dummy-module'
import * as extra from 'dummy-module/extra'
import Leaf from './leaf'

export default function IndexPage(): React.JSX.Element {
  return (
    <div>
      <div>runtime={index.runtime}</div>
      <div>runtime={extra.runtime}</div>
      <Leaf />
    </div>
  )
}
