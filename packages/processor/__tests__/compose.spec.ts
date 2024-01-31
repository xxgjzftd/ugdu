import { describe, expect, it, vi } from 'vitest'

import { TaskOptions } from '../src/task'
import { series, parallel } from '../src/compose'
import { Processor } from '../src/processor'

describe('series', () => {
  it('should return a task options instance whose children are its args', () => {
    const child0 = new TaskOptions(function () {})
    const child1 = new TaskOptions(function () {})
    const child2 = new TaskOptions(function () {})
    const parent = series(child0, child1, child2)
    expect(parent.children).toEqual([child0, child1, child2])
  })

  it('should return a task options instance whose corresponding task will execute its children task sequentially', async () => {
    const fn0 = vi.fn(
      async () => {
        await Promise.resolve()
        expect(fn1).not.toBeCalled()
      }
    )
    const fn1 = vi.fn(
      () => {
        expect(fn2).not.toBeCalled()
      }
    )
    const fn2 = vi.fn()
    const child0 = new TaskOptions(fn0)
    const child1 = new TaskOptions(fn1)
    const child2 = new TaskOptions(fn2)
    const parent = series(child0, child1, child2)
    const processor = new Processor()
    await processor.task(parent).run()
    expect(fn0).toHaveBeenCalled()
    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()
  })
})

describe('parallel', () => {
  it('should return a task options instance whose children are its args', () => {
    const child0 = new TaskOptions(function () {})
    const child1 = new TaskOptions(function () {})
    const child2 = new TaskOptions(function () {})
    const parent = parallel(child0, child1, child2)
    expect(parent.children).toEqual([child0, child1, child2])
  })

  it('should return a task options instance whose corresponding task will execute its children task concurrently', async () => {
    const fn0 = vi.fn(
      async () => {
        await Promise.resolve()
        expect(fn1).toHaveBeenCalled()
        expect(fn2).toHaveBeenCalled()
      }
    )
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const child0 = new TaskOptions(fn0)
    const child1 = new TaskOptions(fn1)
    const child2 = new TaskOptions(fn2)
    const parent = parallel(child0, child1, child2)
    const processor = new Processor()
    await processor.task(parent).run()
    expect(fn0).toHaveBeenCalled()
    expect(fn1).toHaveBeenCalled()
    expect(fn2).toHaveBeenCalled()
  })
})
