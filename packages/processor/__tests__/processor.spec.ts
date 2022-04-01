import { TaskOptions } from '../src/task'
import { Processor } from '../src/processor'

describe('The task method', () => {
  it('should return the same task instance when this method is called multiple times', () => {
    const to = new TaskOptions(function () {})
    const processor = new Processor()
    const task = processor.task(to)
    expect(processor.task(to)).toBe(task)
  })
})
