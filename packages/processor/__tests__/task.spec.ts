import { describe, expect, it, vi } from 'vitest'

import { TaskOptions } from '../src/task'
import { Processor } from '../src/processor'

describe('The TaskOptions class', () => {
  describe('The addChild method', () => {
    it('should should work correctly', () => {
      const parent = new TaskOptions(function () {})
      const child = new TaskOptions(function () {})
      expect(parent.children).toEqual([])
      parent.addChild(child)
      expect(parent.children).toEqual([child])
    })

    it('should return the task options instance', () => {
      const parent = new TaskOptions(function () {})
      const child = new TaskOptions(function () {})
      expect(parent.addChild(child)).toBe(parent)
    })
  })

  describe('The setHooks method', () => {
    it('should should work correctly', () => {
      const to = new TaskOptions<{ 'hook'(): void }>(
        function () {
          this.call('hook', 'parallel')
        },
        ['hook']
      )
      expect(to.hooks).toEqual({})
      const hooks = { hook: vi.fn() }
      to.setHooks(hooks)
      expect(to.hooks).toBe(hooks)
    })

    it('should return the task options instance', () => {
      const to = new TaskOptions(function () {})
      const hooks = { hook: vi.fn() }
      expect(to.setHooks(hooks)).toBe(to)
    })
  })
})

describe('The Task class', () => {
  it.skip('should respect the force args', () => {
    const to = new TaskOptions(function () {})
    const processor = new Processor()
    const task = processor.task(to)
    const action = vi.spyOn(task, 'action')
    task.run()
    task.run()
    task.run()
    expect(action).toHaveBeenCalledTimes(1)
    task.run(true)
    task.run(true)
    task.run(true)
    expect(action).toHaveBeenCalledTimes(4)
  })
})
