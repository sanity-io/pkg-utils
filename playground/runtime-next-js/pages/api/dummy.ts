import * as index from 'dummy-module'
import * as extra from 'dummy-module/extra'
import type {NextApiRequest, NextApiResponse} from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({index, extra})
}
