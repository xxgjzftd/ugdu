import { TaskOptions } from './task'

import type { UnionToIntersection } from 'type-fest'
import type { BaseHooks } from './hook-driver'

type SatisfyHooks<T> = T extends BaseHooks<T> ? T : never
type ParentHooks<T extends TaskOptions> = UnionToIntersection<T extends TaskOptions<infer U> ? U : never>
type ParentTaskOptions<T extends TaskOptions[]> = TaskOptions<SatisfyHooks<ParentHooks<T[number]>>>

/**
 * Compose the children task options in series mode.
 *
 * @param children - The task options to be wrapped
 * @returns The composed task options
 */
export const series = function <T extends TaskOptions[]>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      for (const child of children) {
        await manager.task(child).run()
      }
    }
  )
  children.forEach((child) => parent.addChild(child))
  return parent
}

/**
 * Compose the children task options in parallel mode.
 *
 * @param children - The task options to be wrapped
 * @returns The composed task options
 */
export const parallel = function <T extends TaskOptions[]>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      await Promise.all(children.map((child) => manager.task(child).run()))
    }
  )
  children.forEach((child) => parent.addChild(child))
  return parent
}
