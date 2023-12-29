import { resolve } from 'node:path'

import { vi } from 'vitest'

import { cwd, lps, resolveLocalPkgAbsolutePath } from '../utils'

export const findWorkspacePackages = vi.fn(
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
