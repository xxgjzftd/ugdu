import { HookDriver } from '../src/hook-driver'

import type { Promisable } from 'type-fest'

interface Result {
  prop: string
}

interface Hooks {
  hn0(): Promisable<void>
  hn1(arg: string): Promisable<void>
  hn2(arg0: number, arg1: string): Promisable<void>
  hn3(): Promisable<Result>
  hn4(arg: string): Promisable<Result>
  hn5(arg0: number, arg1: string): Promisable<Result>
}

describe('The hfs method', () => {
  const parent = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4'])
  const child = new HookDriver<{ hn5(arg0: number, arg1: string): Promisable<Result> }>(['hn5'])
  parent.children.push(child)
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  const fn50 = jest.fn()
  const fn51 = jest.fn()
  parent.hook('hn0', fn00)
  parent.hook('hn0', fn01)
  parent.hook('hn5', fn50)
  parent.hook('hn5', fn51)

  it('should return the corresponding hook fns', () => {
    expect(parent.hfs('hn0')).toEqual([fn00, fn01])
  })

  it('should return a empty array if there is no corresponding hook fns', () => {
    expect(parent.hfs('hn1')).toEqual([])
  })

  it('should return the corresponding hook fns even if the hook fns are hooked into the children hook driver', () => {
    expect(child.hfs('hn5')).toEqual([fn50, fn51])
    expect(parent.hfs('hn5')).toEqual([fn50, fn51])
  })

  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => child.hfs('hn0')).toThrow()
  })
})

describe('The hook method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.hook('hn0', fn00)
  hd.hook('hn0', fn01)

  it('should be hooked into the hook driver sequentially', () => {
    expect(hd.hfs('hn0')).toEqual([fn00, fn01])
  })

  it('should return the hook driver instance', () => {
    expect(hd.hook('hn0', fn00)).toBe(hd)
  })

  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => hd.hook('hn6')).toThrow()
  })
})

describe('The prepend method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.prepend('hn0', fn00)
  hd.prepend('hn0', fn01)

  it('should be hooked into the hook driver in reverse order', () => {
    expect(hd.hfs('hn0')).toEqual([fn01, fn00])
  })

  it('should return the hook driver instance', () => {
    expect(hd.prepend('hn0', fn00)).toBe(hd)
  })

  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => hd.prepend('hn6')).toThrow()
  })
})

describe('The unhook method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.hook('hn0', fn00)
  hd.hook('hn0', fn01)

  it('should remove the hook fn from the hook driver', () => {
    hd.unhook('hn0', fn00)
    expect(hd.hfs('hn0')).toEqual([fn01])
  })

  it('should return the hook driver instance', () => {
    expect(hd.unhook('hn0', fn00)).toBe(hd)
  })
})

describe('The call method', () => {
  it('should call the hook fns sequentially until a hook fn returns a value other than `null` or `undefined`', async () => {
    const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
    const fn30 = jest.fn()
    const fn31 = jest.fn(() => ({ prop: 'fn01' }))
    const fn32 = jest.fn(() => ({ prop: 'fn02' }))
    hd.hook('hn3', fn30)
    hd.hook('hn3', fn31)
    hd.hook('hn3', fn32)
    expect(await hd.call('hn3', 'first')).toEqual({ prop: 'fn01' })
    expect(fn30).toHaveBeenCalled()
    expect(fn31).toHaveBeenCalled()
    expect(fn32).not.toHaveBeenCalled()
  })

  it('should call the hook fns sequentially', async () => {
    const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
    const fn00 = jest.fn(
      async () => {
        await Promise.resolve()
        expect(fn01).not.toHaveBeenCalled()
      }
    )
    const fn01 = jest.fn()
    hd.hook('hn0', fn00)
    hd.hook('hn0', fn01)
    await hd.call('hn0', 'sequential')
    expect(fn00).toHaveBeenCalled()
    expect(fn01).toHaveBeenCalled()
  })

  it('should call the hook fns in parallel', async () => {
    const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
    const fn00 = jest.fn(
      async () => {
        await Promise.resolve()
        expect(fn01).toHaveBeenCalled()
      }
    )
    const fn01 = jest.fn()
    hd.hook('hn0', fn00)
    hd.hook('hn0', fn01)
    await hd.call('hn0', 'parallel')
    expect(fn00).toHaveBeenCalled()
    expect(fn01).toHaveBeenCalled()
  })

  it('should call the hook fns with the args which are passed to the call method', async () => {
    const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
    const fn20 = jest.fn()
    const fn21 = jest.fn()
    hd.hook('hn2', fn20)
    hd.hook('hn2', fn21)
    await hd.call('hn2', 'parallel', 0, 'foo')
    expect(fn20).toHaveBeenCalledWith(0, 'foo')
    expect(fn21).toHaveBeenCalledWith(0, 'foo')
  })

  it('should throw error if the hook type is illegal', async () => {
    const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
    const fn00 = jest.fn()
    const fn01 = jest.fn()
    hd.hook('hn0', fn00)
    hd.hook('hn0', fn01)
    // @ts-expect-error
    await expect(hd.call('hn0', 'illegal')).rejects.toThrow()
  })
})
