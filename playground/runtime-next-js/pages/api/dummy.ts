import * as index from 'dummy-module'
import * as extra from 'dummy-module/extra'
import type {  NextApiResponse } from 'next'


export default function handler(
  _,
  res: NextApiResponse
) {
  res.status(200).json({ index, extra })
}
