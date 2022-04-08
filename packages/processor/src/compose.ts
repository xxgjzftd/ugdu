import { TaskOptions } from './task'

import type { UnionToIntersection } from 'type-fest'
import type { BaseHooks } from './hook-driver'

type SatisfyHooks<T> = T extends BaseHooks<T> ? T : never
type ParentHooks<T extends TaskOptions<any, any> | TaskOptions<any, never>> = UnionToIntersection<
  T extends TaskOptions<infer U> ? U : {}
>
type ParentTaskOptions<T extends Array<TaskOptions<any, any> | TaskOptions<any, never>>> = TaskOptions<
  SatisfyHooks<ParentHooks<T[number]>>,
  never
>

/**
 * Composes the parent `task options` with children `task options` in series mode.
 *
 * @param children - The `task options` to be wrapped
 * @returns The composed `task options`
 *
 * @public
 */
export const series = function <T extends Array<TaskOptions<any, any> | TaskOptions<any, never>>>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      for (const child of children) {
        // @ts-ignore
        await manager.task(child).run()
      }
    }
  )
  children.forEach((child) => parent.addChild(child))
  return parent
}

/**
 * Composes the parent `task options` with children `task options` in parallel mode.
 *
 * @param children - The `task options` to be wrapped
 * @returns The composed `task options`
 *
 * @public
 */
export const parallel = function <T extends Array<TaskOptions<any, any> | TaskOptions<any, never>>>(...children: T) {
  const parent: ParentTaskOptions<T> = new TaskOptions(
    async function () {
      const { manager } = this
      // @ts-ignore
      await Promise.all(children.map((child) => manager.task(child).run()))
    }
  )
  children.forEach((child) => parent.addChild(child))
  return parent
}
