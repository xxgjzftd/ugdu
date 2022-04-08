import { resolve } from 'path'

import { cwd, lps, resolveLocalPkgAbsolutePath } from '../utils'

export default jest.fn(
  () =>
    Promise.resolve(
      [
        {
          dir: resolve(cwd),
          manifest: { private: true }
        },
        ...lps.map((p) => ({ dir: resolveLocalPkgAbsolutePath(p.name), manifest: Object.assign({}, p) }))
      ]
    )
)
