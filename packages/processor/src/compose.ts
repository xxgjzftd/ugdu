import { TaskOptions } from './task'

import type { UnionToIntersection } from 'type-fest'
import type { BaseHooks } from './hook-driver'

type SatisfyHooks<T> = T extends BaseHooks<T> ? T : never
type ParentHooks<T extends TaskOptions> = UnionToIntersection<T extends TaskOptions<infer U> ? U : never>
type ParentTaskOptions<T extends TaskOptions[]> = TaskOptions<SatisfyHooks<ParentHooks<T[number]>>>

export const rerun = function <T extends TaskOptions>(child: T) {
  const parent = new TaskOptions(
    function () {
      const { manager } = this
      manager.task(child).run(true)
    }
  )
  child.addParent(parent)
  return parent
}

export const series = function <T extends TaskOptions[]>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      for (const child of children) {
        await manager.task(child).run()
      }
    }
  )
  children.forEach((child) => child.addParent(parent))
  return parent
}

export const parallel = function <T extends TaskOptions[]>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      await Promise.all(children.map((child) => manager.task(child).run()))
    }
  )
  children.forEach((child) => child.addParent(parent))
  return parent
}
