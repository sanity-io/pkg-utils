import type { InferGetStaticPropsType, GetStaticProps } from 'next'
import {useState, useEffect} from 'react'

import * as _index from 'dummy-module'
import * as _extra from 'dummy-module/extra'

type Props = {
  index: typeof _index
  extra: typeof _extra
}

export const getStaticProps: GetStaticProps<Props> =  () => {
  return { props: JSON.parse(JSON.stringify({ index: _index, extra: _extra })) }
}

export default function IndexPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
  // Because we use conditional exports, the values of `index` and `extra` are
  // different on the server and client. This is a problem for React, because
  // it expects the values to be the same on the server and client.
  const [{index, extra}, setState] = useState(props)
  useEffect(() => setState({ index: _index, extra: _extra }), [])
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
