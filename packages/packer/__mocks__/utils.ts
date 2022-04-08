import { join, resolve } from 'path'

import type { ChangedSource, Meta } from '../src/tasks/project'

export interface VirtualPkgNode {
  name: string
  main?: string
  version: string
  sources?: string[]
  dependencies: VirtualPkgNode[]
}

export type LooseVirtualPkgNode = Partial<Omit<VirtualPkgNode, 'dependencies'>> &
  Pick<VirtualPkgNode, 'name'> & { dependencies?: LooseVirtualPkgNode[] }

const defaultCwd = '/path/to/project'

export let cwd = defaultCwd
export let lps: VirtualPkgNode[] = []

const patchVirtualPkgNode = (source: LooseVirtualPkgNode) =>
  Object.assign({ version: '1.0.0' }, source) as VirtualPkgNode

const getVirtualPkgNode = (source: LooseVirtualPkgNode, dp: LooseVirtualPkgNode[] = []): VirtualPkgNode => {
  return Object.assign(
    patchVirtualPkgNode(source),
    {
      dependencies: source.dependencies
        ? source.dependencies.map(
            (dep) =>
              dp.includes(dep)
                ? Object.assign(patchVirtualPkgNode(dep), { dependencies: [] })
                : getVirtualPkgNode(dep, [...dp, source])
          )
        : []
    }
  )
}

export const resolveLocalPkgPath = (name: string) => join('packages', name)

export const resolveLocalPkgAbsolutePath = (name: string) => resolve(cwd, resolveLocalPkgPath(name))

export const resolveSourcePath = (name: string, sourceRelativePath: string) =>
  join(resolveLocalPkgPath(name), sourceRelativePath)

export const resolveSourceAbsolutePath = (name: string, sourceRelativePath: string) =>
  resolve(cwd, resolveSourcePath(name, sourceRelativePath))

export const setVirtualProject = (_lps: LooseVirtualPkgNode[] = [], _cwd = defaultCwd) => {
  cwd = _cwd
  lps = _lps.map((lp) => getVirtualPkgNode(lp))
}

export let meta: Meta | null = null

export const setMeta = (_meta: Meta | null = null) => {
  meta = _meta
}

const defaultHash = '0123456'

export let hash = defaultHash

export const setHash = (_hash = defaultHash) => {
  hash = _hash
}

export let changed: ChangedSource[] = []

export const setChanged = (_changed: ChangedSource[] = []) => {
  changed = _changed
}
