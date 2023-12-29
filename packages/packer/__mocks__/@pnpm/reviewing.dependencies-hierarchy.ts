import { resolve } from 'path'

import { vi } from 'vitest'
import { cwd, lps, resolveLocalPkgAbsolutePath } from '../utils'

import type { VirtualPkgNode } from '../utils'

interface MockedPkgNode {
  name: string
  path: string
  version: string
  dependencies?: MockedPkgNode[]
}

const getMockedDeps = (deps: VirtualPkgNode[] = []): MockedPkgNode[] => {
  return deps.map(
    (d) => ({
      name: d.name,
      path: resolve(cwd, 'node_modules/.pnpm', `${d.name}@${d.version}`),
      version: d.version || '1.0.0',
      dependencies: getMockedDeps(d.dependencies || [])
    })
  )
}

export const buildDependenciesHierarchy = vi.fn(
  () =>
    Promise.resolve(
      lps.reduce(
        (acc, p) => {
          acc[resolveLocalPkgAbsolutePath(p.name)] = {
            dependencies: getMockedDeps(p.dependencies)
          }
          return acc
        },
        {} as Record<string, { dependencies: MockedPkgNode[] }>
      )
    )
)
