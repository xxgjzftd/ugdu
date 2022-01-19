import { Task } from './task'

import type { TaskOptions, TaskManager, Context } from './task'
import type { BaseHooks } from './hook-driver'

/**
 * The processor maintain tasks.
 *
 * @public
 */
export class Processor implements TaskManager {
  /**
   * Holds all tasks created by this processor.
   */
  private readonly _tasks: Task<any, any>[] = []

  /**
   * The context of {@link Task.action}.
   */
  readonly context: Context = {}

  /**
   * Get the task instance of this task options in this processor.
   *
   * @param to - task options
   * @returns A task instance
   */
  task <Hooks extends BaseHooks<Hooks>, HookName extends keyof Hooks>(
    to: TaskOptions<Hooks, HookName>
  ): Task<Hooks, HookName> {
    let task = this._tasks.find((task) => task.isCreatedBy(to))
    if (!task) {
      task = new Task(to, this)
      this._tasks.push(task)
    }
    return task
  }
}
